/**
 * Read qa-report.json and re-generate every image where regenerate=true.
 * Uses a stronger prompt template that emphasizes exact brand spelling and
 * tells the model not to invent extra text.
 *
 * Up to 3 attempts per image — keeps the result whose returned bytes are
 * largest (heuristic for "richest detail"). Saves over the existing JPG.
 *
 * Run: node scripts/reroll-qa-failures.js
 *      node scripts/reroll-qa-failures.js --dry
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const KEY = process.env.GEMINI_API_KEY;
const REPORT_FILE = path.join(__dirname, 'data/qa-report.json');
const OUT_DIR = path.join(__dirname, '../public/images/products');
const LOG_FILE = path.join(__dirname, 'data/reroll-log.json');
const MODEL = 'gemini-2.5-flash-image';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`;
const DRY = process.argv.includes('--dry');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function strongPrompt(brand, productName) {
  return `Studio product photograph of ${brand} ${productName}. The product's label clearly displays the brand wordmark spelled EXACTLY as "${brand}" — do not alter, abbreviate, or invent any other brand name or text on the package. Below the brand wordmark, the product name "${productName}" appears in clean clinical typography, readable. Single product, centered, no people, no hands, no extra props. Soft cream off-white background, gentle directional side lighting, soft shadow, photorealistic 8k product advertisement style. --ar 4:5`;
}

async function generateImage(prompt) {
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
  });
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`), { status: r.status });
  const data = await r.json();
  const img = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!img) throw new Error('No image in response');
  return Buffer.from(img.inlineData.data, 'base64');
}

async function main() {
  if (!KEY) { console.error('Missing GEMINI_API_KEY'); process.exit(1); }
  if (!fs.existsSync(REPORT_FILE)) { console.error('No QA report at', REPORT_FILE); process.exit(1); }

  const report = JSON.parse(fs.readFileSync(REPORT_FILE, 'utf8'));
  const flagged = report.filter((r) => r.regenerate === true);
  console.log(`QA flagged for regen: ${flagged.length}`);

  if (DRY) {
    flagged.forEach((r) => console.log(`  ${r.brand} | ${r.name}  — ${r.notes || ''}`));
    console.log('\n[dry — exiting]');
    return;
  }

  let log = fs.existsSync(LOG_FILE) ? JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')) : [];
  let ok = 0, fail = 0;
  for (let i = 0; i < flagged.length; i++) {
    const r = flagged[i];
    process.stdout.write(`[${i + 1}/${flagged.length}] ${r.brand} | ${r.name.slice(0, 50)} ... `);
    let best = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const buf = await generateImage(strongPrompt(r.brand, r.name));
        if (!best || buf.length > best.length) best = buf;
      } catch (e) {
        if (e.status === 429) await sleep(20_000);
      }
      await sleep(800);
    }
    if (!best) { console.log('FAIL all 3 attempts'); fail++; log.push({ ...r, ok: false, at: new Date().toISOString() }); continue; }
    const out = path.join(OUT_DIR, r.filename);
    const pngTmp = out.replace(/\.jpg$/, '.tmp.png');
    fs.writeFileSync(pngTmp, best);
    execSync(`sips -s format jpeg -s formatOptions 85 "${pngTmp}" --out "${out}" >/dev/null 2>&1`);
    fs.unlinkSync(pngTmp);
    const sz = fs.statSync(out).size;
    console.log(`OK (${(sz / 1024).toFixed(0)}KB)`);
    log.push({ ...r, ok: true, bytes: sz, at: new Date().toISOString() });
    ok++;
    fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
  }
  console.log(`\nReroll done. ok=${ok} fail=${fail}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
