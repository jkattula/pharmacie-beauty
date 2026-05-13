/**
 * Generate Nano Banana images for every product whose image_url is currently
 * on Supabase Storage (or any other not-yet-local source). Builds a prompt on
 * the fly from brand + product name using the LRP Pure Niacinamide template,
 * generates via Gemini 2.5 Flash Image, converts PNG→JPG, saves to
 * public/images/products, and updates products.image_url.
 *
 * Idempotent — skips products whose computed filename already exists on disk
 * with size > 50KB.
 *
 * Run: node scripts/gen-remaining-images.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const postgres = require('postgres');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const KEY = process.env.GEMINI_API_KEY;
const OUT_DIR = path.join(__dirname, '../public/images/products');
const LOG_FILE = path.join(__dirname, 'data/gen-remaining-log.json');
const MODEL = 'gemini-2.5-flash-image';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function slug(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildPrompt(brand, name) {
  return `Professional studio product photography of ${brand} ${name}. The product packaging with the ${brand} wordmark clearly readable on the label in clean clinical typography. Minimalist pharmacy-luxury aesthetic. Clean, matte, soft cream background. Soft directional lighting with elegant rim highlights. High resolution, 8k, macro lens, shallow depth of field, luxury skincare advertisement style, sharp focus on the label. --ar 4:5`;
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
  if (!fs.existsSync(path.dirname(LOG_FILE))) fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });

  const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 });
  try {
    const rows = await sql`SELECT p.id, p.name, b.name AS brand, p.image_url FROM products p JOIN brands b ON b.id = p.brand_id WHERE p.image_url NOT LIKE '/images/products/%' OR p.image_url IS NULL ORDER BY b.name, p.name`;
    console.log(`Products needing regeneration: ${rows.length}`);

    let log = fs.existsSync(LOG_FILE) ? JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')) : [];
    let ok = 0, skip = 0, fail = 0;

    for (let i = 0; i < rows.length; i++) {
      const p = rows[i];
      const filename = `${slug(p.brand)}_${slug(p.name)}.jpg`;
      const outPath = path.join(OUT_DIR, filename);

      // Skip if already on disk with reasonable size
      if (fs.existsSync(outPath) && fs.statSync(outPath).size > 50_000) {
        await sql`UPDATE products SET image_url = ${'/images/products/' + filename} WHERE id = ${p.id}`;
        process.stdout.write(`[${i+1}/${rows.length}] ${filename} ... SKIP (exists)\n`);
        skip++;
        continue;
      }

      process.stdout.write(`[${i+1}/${rows.length}] ${p.brand} | ${p.name} → ${filename} ... `);
      try {
        const buf = await generateImage(buildPrompt(p.brand, p.name));
        const pngPath = outPath.replace(/\.jpg$/, '.tmp.png');
        fs.writeFileSync(pngPath, buf);
        execSync(`sips -s format jpeg -s formatOptions 85 "${pngPath}" --out "${outPath}" >/dev/null 2>&1`);
        fs.unlinkSync(pngPath);
        const sz = fs.statSync(outPath).size;
        await sql`UPDATE products SET image_url = ${'/images/products/' + filename} WHERE id = ${p.id}`;
        console.log(`OK (${(sz/1024).toFixed(0)}KB)`);
        log.push({ id: p.id, filename, ok: true, bytes: sz, at: new Date().toISOString() });
        ok++;
      } catch (e) {
        console.log(`FAIL ${e.message.slice(0, 100)}`);
        log.push({ id: p.id, filename, ok: false, error: e.message.slice(0, 200), at: new Date().toISOString() });
        fail++;
        if (e.status === 429) { console.log('  rate limit — sleeping 30s'); await sleep(30_000); }
      }
      fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
      await sleep(1200);
    }
    console.log(`\nDone. ok=${ok} skip=${skip} fail=${fail}`);
  } finally {
    await sql.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
