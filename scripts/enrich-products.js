/**
 * Enrich the new-products-seed.json with full schema fields via GPT-4o-mini.
 * Output: scripts/data/new-products-enriched.json
 *
 * Run: node scripts/enrich-products.js
 */
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const NAME_ARG = process.argv[2] || 'new-products';
const SEED_PATH = path.join(__dirname, `data/${NAME_ARG}-seed.json`);
const OUT_PATH = path.join(__dirname, `data/${NAME_ARG}-enriched.json`);

const SYSTEM_PROMPT = `You are a French pharmacy beauty expert. Given a brand + product name + category + packaging hint,
return realistic, accurate product details for a US-traveler shopping guide.

Voice: warm, expert, concise. Mirror this style: "Iconic French pharmacy moisturizer beloved by makeup artists.
Multi-purpose hydrator that doubles as a primer."

Return STRICT JSON with this exact shape (no markdown, no prose):
{
  "description": "1-2 sentence product description",
  "whatItsGoodFor": "comma-separated skin concerns / use-cases (e.g., 'Dehydrated skin, fine lines, post-cleansing prep')",
  "whyBuyInFrance": "1 sentence with concrete reason: price savings, EU-only formula, larger pharmacy size, French staple",
  "cultFavoriteFlag": boolean,
  "franceOnlyFlag": boolean,
  "tiktokTrendingFlag": boolean,
  "dealFlag": boolean,
  "priceEurMin": number (realistic EUR price at French pharmacy),
  "priceEurMax": number or null,
  "priceUsdEstimate": number or null (US retail price if sold there),
  "availabilityStatus": "same_formula" | "reformulated" | "not_available",
  "availabilityNotes": "1 sentence on US availability nuance",
  "ingredients": ["3-6 key ingredients", "..."],
  "euOnlyIngredients": ["any ingredients only in EU formula", "..."],
  "aiSummaryText": "1 sentence editorial review summary",
  "imagePromptDetails": "short visual description of the product packaging for image generation"
}

Rules:
- Be accurate about real product info — don't invent prices wildly off market.
- franceOnlyFlag = true only if the exact product/formula isn't sold in US.
- dealFlag = true if French price is materially lower than US (>20%).
- cultFavoriteFlag = true for iconic, decades-loved staples.
- tiktokTrendingFlag = true for viral 2024-2026 picks.`;

async function enrichOne(item) {
  const userPrompt = `Brand: ${item.brand}
Product: ${item.name}
Category: ${item.category}
Packaging hint: ${item.packaging}

Return only the JSON object.`;

  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.5,
    response_format: { type: 'json_object' },
    max_tokens: 700,
  });

  const content = resp.choices[0]?.message?.content || '{}';
  const parsed = JSON.parse(content);
  return { ...item, ...parsed };
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('Missing OPENAI_API_KEY');
    process.exit(1);
  }

  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  const products = seed.products;
  console.log(`Enriching ${products.length} products with GPT-4o-mini...`);

  // Resume support: if output file exists, skip already-done items
  let existing = [];
  if (fs.existsSync(OUT_PATH)) {
    existing = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8'));
    console.log(`Resuming — ${existing.length} already enriched.`);
  }
  const doneKeys = new Set(existing.map(p => `${p.brand}::${p.name}`));

  const results = [...existing];
  const concurrency = 6;
  let idx = 0;

  async function worker() {
    while (idx < products.length) {
      const myIdx = idx++;
      const item = products[myIdx];
      const key = `${item.brand}::${item.name}`;
      if (doneKeys.has(key)) continue;
      try {
        const enriched = await enrichOne(item);
        results.push(enriched);
        doneKeys.add(key);
        console.log(`[${results.length}/${products.length}] ${item.brand} - ${item.name}`);
        // Persist after each success so we can resume on failure
        fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2));
      } catch (e) {
        console.error(`FAIL ${item.brand} - ${item.name}:`, e.message);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));

  console.log(`\nDone. ${results.length} products enriched → ${OUT_PATH}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
