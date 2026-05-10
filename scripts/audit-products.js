/**
 * Quality audit of every product:
 *   - Verify description accuracy for real product
 *   - Replace ingredients list with the actual key actives + skin-benefit notes
 *   - Output a JSON audit log of changes; apply on confirm
 *
 * Run: node scripts/audit-products.js          (dry-run, writes audit log)
 *      node scripts/audit-products.js --apply  (applies changes to DB)
 */
const fs = require('fs');
const path = require('path');
const postgres = require('postgres');
const OpenAI = require('openai');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const APPLY = process.argv.includes('--apply');
const AUDIT_OUT = path.join(__dirname, 'data/audit-log.json');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a French pharmacy beauty expert auditing a product database.
Given a product (brand, name, category, current description, current ingredients), return STRICT JSON:

{
  "description_ok": boolean,                  // true if current description is accurate enough; false if materially wrong
  "description_new": string | null,           // 1-2 sentence rewrite ONLY if description_ok is false
  "ingredients": [                             // 3-6 KEY actives in the actual product
    {
      "name": string,                          // canonical name (e.g., "Niacinamide", "Salicylic Acid")
      "skin_benefit": string,                  // 1 short sentence: what it does for skin (e.g., "Reduces blemishes and minimizes pore appearance")
      "eu_only": boolean                       // true only if this active is restricted to EU formulations (e.g., Mexoryl, Tinosorb)
    }
  ]
}

Rules:
- For ingredients, list the *real* key actives that drive the product's claims, not filler. Skip generic things like "Water", "Glycerin" unless they are explicitly the hero (rare).
- Skin_benefit must explain what the ingredient does for the skin — not where it's sourced from.
- If you don't know the product confidently, use the brand+name+category to make accurate assumptions about typical formulation, but be conservative.
- Be precise on EU-only flags: only true sunscreen UV filters (Mexoryl SX/XL, Tinosorb S/M, Uvinul T/A Plus) and a few dermatological actives qualify; common things like niacinamide, salicylic acid, hyaluronic acid are NOT EU-only.
- Return ONLY valid JSON, no markdown.`;

async function auditOne(p) {
  const userPrompt = `Brand: ${p.brand}
Product: ${p.name}
Category: ${p.category}
Current description: ${p.description}
Current ingredients: ${(p.ingredients || []).map(i => i.name).join(', ') || '(none)'}

Audit this product. Return only the JSON object.`;

  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
    max_tokens: 700,
  });

  return JSON.parse(resp.choices[0]?.message?.content || '{}');
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('Missing OPENAI_API_KEY');
    process.exit(1);
  }
  const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

  try {
    console.log(`Mode: ${APPLY ? 'APPLY (will update DB)' : 'DRY-RUN (writes audit log only)'}`);

    // Load products with current ingredients
    const products = await sql`
      SELECT p.id, p.name, p.description, p.category,
             b.name AS brand,
             COALESCE(json_agg(json_build_object('id', ing.id, 'name', ing.name) ORDER BY ing.name) FILTER (WHERE ing.id IS NOT NULL), '[]') AS ingredients
      FROM products p
      JOIN brands b ON b.id = p.brand_id
      LEFT JOIN product_ingredients pi ON pi.product_id = p.id
      LEFT JOIN ingredients ing ON ing.id = pi.ingredient_id
      GROUP BY p.id, b.name
      ORDER BY b.name, p.name
    `;
    console.log(`Auditing ${products.length} products...`);

    // Resume support
    let audit = [];
    if (fs.existsSync(AUDIT_OUT)) {
      audit = JSON.parse(fs.readFileSync(AUDIT_OUT, 'utf8'));
      console.log(`Resuming — ${audit.length} already audited.`);
    }
    const doneIds = new Set(audit.map(a => a.id));

    const concurrency = 6;
    let idx = 0;
    let descChanged = 0;

    async function worker() {
      while (idx < products.length) {
        const myIdx = idx++;
        const p = products[myIdx];
        if (doneIds.has(p.id)) continue;
        try {
          const result = await auditOne(p);
          audit.push({ id: p.id, brand: p.brand, name: p.name, ...result });
          doneIds.add(p.id);
          if (!result.description_ok) descChanged++;
          if (audit.length % 10 === 0) {
            fs.writeFileSync(AUDIT_OUT, JSON.stringify(audit, null, 2));
            console.log(`  [${audit.length}/${products.length}] desc-rewrites=${descChanged}`);
          }
        } catch (e) {
          console.error(`FAIL ${p.brand} - ${p.name}:`, e.message);
        }
      }
    }
    await Promise.all(Array.from({ length: concurrency }, worker));
    fs.writeFileSync(AUDIT_OUT, JSON.stringify(audit, null, 2));

    const summary = {
      total: audit.length,
      desc_to_rewrite: audit.filter(a => !a.description_ok).length,
      avg_ingredients: (audit.reduce((s, a) => s + (a.ingredients?.length || 0), 0) / audit.length).toFixed(1),
    };
    console.log('\nAudit summary:', summary);

    if (!APPLY) {
      console.log(`\nDry-run complete. Re-run with --apply to update DB.`);
      return;
    }

    // ============================ APPLY ============================
    console.log('\nApplying updates...');

    // 1. Description rewrites
    let descUpdated = 0;
    for (const a of audit) {
      if (!a.description_ok && a.description_new) {
        await sql`UPDATE products SET description = ${a.description_new} WHERE id = ${a.id}`;
        descUpdated++;
      }
    }
    console.log(`  Updated descriptions: ${descUpdated}`);

    // 2. Ingredients rebuild — for each product, replace its ingredient list
    //    Strategy: clear product_ingredients for that product, find/create each ingredient,
    //    insert link, update notes with skin_benefit and eu_only flag if missing.
    let ingLinks = 0;
    let ingCreated = 0;
    let ingUpdated = 0;
    for (const a of audit) {
      if (!Array.isArray(a.ingredients) || a.ingredients.length === 0) continue;
      await sql`DELETE FROM product_ingredients WHERE product_id = ${a.id}`;

      for (const ing of a.ingredients) {
        if (!ing.name) continue;
        const name = ing.name.trim();
        const benefit = (ing.skin_benefit || '').trim() || null;
        const euOnly = !!ing.eu_only;

        // Find existing or create
        const existing = await sql`SELECT id, notes, eu_only_flag FROM ingredients WHERE LOWER(name) = LOWER(${name}) LIMIT 1`;
        let ingId;
        if (existing.length) {
          ingId = existing[0].id;
          // Update notes/eu_only if missing or improvable
          const needsNoteUpdate = !existing[0].notes && benefit;
          const needsEuUpdate = !existing[0].eu_only_flag && euOnly;
          if (needsNoteUpdate || needsEuUpdate) {
            await sql`
              UPDATE ingredients
              SET notes = COALESCE(${needsNoteUpdate ? benefit : null}, notes),
                  eu_only_flag = ${euOnly || existing[0].eu_only_flag}
              WHERE id = ${ingId}
            `;
            ingUpdated++;
          }
        } else {
          const [row] = await sql`
            INSERT INTO ingredients (name, notes, eu_only_flag)
            VALUES (${name}, ${benefit}, ${euOnly})
            RETURNING id
          `;
          ingId = row.id;
          ingCreated++;
        }

        try {
          await sql`
            INSERT INTO product_ingredients (product_id, ingredient_id, highlight_flag)
            VALUES (${a.id}, ${ingId}, true)
            ON CONFLICT DO NOTHING
          `;
          ingLinks++;
        } catch (e) { /* unique constraint fine */ }
      }
    }
    console.log(`  Ingredient links created: ${ingLinks}`);
    console.log(`  New ingredients created: ${ingCreated}`);
    console.log(`  Existing ingredients updated: ${ingUpdated}`);

    console.log('\nApplied successfully.');
  } finally {
    await sql.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
