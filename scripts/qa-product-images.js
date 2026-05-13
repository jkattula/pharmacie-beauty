/**
 * QA every product image using GPT-4o-mini vision. Scores against a 5-axis
 * rubric and produces a report + a list of products to regenerate.
 *
 *   1. brand_spelling_correct   (pass/fail)
 *   2. product_type_matches     (pass/fail)
 *   3. aesthetic_score          (1-5)
 *   4. label_legible            (pass/fail)
 *   5. has_hallucinated_text    (pass/fail) - pass means clean
 *
 * regenerate = true if any of 1/2/5 fail OR aesthetic_score <= 3
 *
 * Run: node scripts/qa-product-images.js
 *      node scripts/qa-product-images.js --limit=20  (small smoke test)
 */
const fs = require('fs');
const path = require('path');
const postgres = require('postgres');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error('Missing OPENAI_API_KEY'); process.exit(1); }

const OUT_DIR = path.join(__dirname, '../public/images/products');
const REPORT = path.join(__dirname, 'data/qa-report.json');
const MODEL = 'gpt-4o-mini';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LIMIT = (() => {
  const a = process.argv.find((x) => x.startsWith('--limit='));
  return a ? parseInt(a.split('=')[1]) : null;
})();

const SYSTEM = `You are evaluating a product image against the product name and brand. Reply ONLY with a JSON object matching this exact schema:
{
  "brand_spelling_correct": boolean,
  "product_type_matches": boolean,
  "aesthetic_score": 1|2|3|4|5,
  "label_legible": boolean,
  "has_hallucinated_text": boolean,
  "notes": "max 12 words"
}

Rules:
- brand_spelling_correct: the wordmark on the package must spell the brand EXACTLY. Catch typos like "Euerin" for "Eucerin" or invented words.
- product_type_matches: packaging plausibly matches the product name (e.g. "Lip Balm" → small tube/pot; "Shampoo" → bottle).
- aesthetic_score: 5 = clean studio cream background, single product, soft side lighting. 1 = chaotic, multiple objects, dark/dirty.
- label_legible: can you read what the product claims to be?
- has_hallucinated_text: TRUE if there's nonsense text/random extra brand names. FALSE means the text is clean.

Return only the JSON. No prose.`;

async function score(filename, brand, productName) {
  const filePath = path.join(OUT_DIR, filename);
  if (!fs.existsSync(filePath)) return { error: 'file not found' };
  const b64 = fs.readFileSync(filePath).toString('base64');
  const dataUrl = `data:image/jpeg;base64,${b64}`;
  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: [
          { type: 'text', text: `Brand: ${brand}\nProduct: ${productName}` },
          { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
  };
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  return JSON.parse(data.choices[0].message.content);
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 });
  try {
    let rows = await sql`SELECT p.id, p.name, b.name AS brand, p.image_url FROM products p JOIN brands b ON b.id = p.brand_id WHERE p.image_url LIKE '/images/products/%' ORDER BY b.name, p.name`;
    if (LIMIT) rows = rows.slice(0, LIMIT);
    console.log(`Scoring ${rows.length} images via ${MODEL} (low detail)...`);

    let report = [];
    let pass = 0, regen = 0, err = 0;
    for (let i = 0; i < rows.length; i++) {
      const p = rows[i];
      const filename = p.image_url.replace('/images/products/', '');
      try {
        const s = await score(filename, p.brand, p.name);
        if (s.error) throw new Error(s.error);
        const regenerate =
          s.brand_spelling_correct === false ||
          s.product_type_matches === false ||
          s.has_hallucinated_text === true ||
          (typeof s.aesthetic_score === 'number' && s.aesthetic_score <= 3);
        report.push({ id: p.id, brand: p.brand, name: p.name, filename, ...s, regenerate });
        if (regenerate) regen++;
        else pass++;
        process.stdout.write(`[${i + 1}/${rows.length}] ${regenerate ? 'REGEN' : 'pass '} | ${p.brand} | ${p.name.slice(0, 50)}${s.notes ? ' — ' + s.notes : ''}\n`);
      } catch (e) {
        report.push({ id: p.id, brand: p.brand, name: p.name, filename, error: e.message });
        err++;
        console.log(`[${i + 1}/${rows.length}] ERR | ${p.brand} | ${p.name}: ${e.message.slice(0, 80)}`);
      }
      if (i % 10 === 9) fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
      await sleep(200);
    }
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
    console.log(`\nDone. pass=${pass} regen=${regen} err=${err}. Report: ${REPORT}`);
  } finally {
    await sql.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
