/**
 * Generate every product image with gpt-image-1 at HIGH quality, using
 * the validated "in situ" short prompt pattern.
 *
 *   prompt: create an elegant image of {Brand} {Product} product in situ, clean background
 *   model:  gpt-image-1
 *   size:   1024x1536 (portrait)
 *   quality: high  (~$0.25/image, ~$72 for the full 287-product catalog)
 *
 * Saves each to public/images/products/{slug}.jpg and updates products.image_url.
 * Idempotent — skips any product whose entry is already ok=true in the log.
 *
 * Run: node scripts/gen-all-gpt-image.js              (full run)
 *      node scripts/gen-all-gpt-image.js --limit=10   (smoke test)
 *      node scripts/gen-all-gpt-image.js --resume     (skip products already done)
 *      node scripts/gen-all-gpt-image.js --brands=Caudalie,Vichy  (filter)
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const postgres = require('postgres');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const KEY = process.env.OPENAI_API_KEY;
const OUT_DIR = path.join(__dirname, '../public/images/products');
const LOG_FILE = path.join(__dirname, 'data/gpt-image-log.json');
const COST_PER_IMAGE = 0.25; // 1024x1536 high
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const LIMIT = (() => { const a = process.argv.find(x => x.startsWith('--limit=')); return a ? parseInt(a.split('=')[1]) : null; })();
const RESUME = process.argv.includes('--resume');
const BRANDS_FILTER = (() => {
  const a = process.argv.find(x => x.startsWith('--brands='));
  return a ? a.split('=')[1].split(',').map(s => s.trim().toLowerCase()) : null;
})();

function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

async function genImage(brand, product) {
  const prompt = `create an elegant image of ${brand} ${product} product in situ, clean background`;
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      size: '1024x1536',
      quality: 'high',
      n: 1,
    }),
  });
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`), { status: r.status });
  const data = await r.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error('no image in response');
  return Buffer.from(b64, 'base64');
}

async function main() {
  if (!KEY) { console.error('Missing OPENAI_API_KEY'); process.exit(1); }
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  if (!fs.existsSync(path.dirname(LOG_FILE))) fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });

  const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 });
  try {
    let rows = await sql`SELECT p.id, p.name, b.name AS brand FROM products p JOIN brands b ON b.id = p.brand_id ORDER BY b.name, p.name`;
    if (BRANDS_FILTER) rows = rows.filter(r => BRANDS_FILTER.includes(r.brand.toLowerCase()));
    if (LIMIT) rows = rows.slice(0, LIMIT);

    let log = fs.existsSync(LOG_FILE) ? JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')) : [];
    const doneIds = new Set(log.filter(l => l.ok).map(l => l.id));
    const todo = RESUME ? rows.filter(r => !doneIds.has(r.id)) : rows;

    const estCost = (todo.length * COST_PER_IMAGE).toFixed(2);
    console.log(`Products: ${rows.length} total, ${todo.length} to generate. Est cost: $${estCost}`);

    let ok = 0, fail = 0, spent = 0;
    for (let i = 0; i < todo.length; i++) {
      const p = todo[i];
      const filename = `${slug(p.brand)}_${slug(p.name)}.jpg`;
      const outPath = path.join(OUT_DIR, filename);
      const tag = `[${i + 1}/${todo.length}] ${p.brand} | ${p.name.slice(0, 60)}`;

      try {
        process.stdout.write(`${tag} ... `);
        const buf = await genImage(p.brand, p.name);
        const pngTmp = outPath.replace(/\.jpg$/, '.tmp.png');
        fs.writeFileSync(pngTmp, buf);
        execSync(`sips -s format jpeg -s formatOptions 92 "${pngTmp}" --out "${outPath}" >/dev/null 2>&1`);
        fs.unlinkSync(pngTmp);
        const sz = fs.statSync(outPath).size;
        await sql`UPDATE products SET image_url = ${'/images/products/' + filename} WHERE id = ${p.id}`;
        spent += COST_PER_IMAGE;
        console.log(`OK ${(sz / 1024).toFixed(0)}KB  ($${spent.toFixed(2)})`);
        log.push({ id: p.id, brand: p.brand, name: p.name, filename, bytes: sz, ok: true, at: new Date().toISOString() });
        ok++;
      } catch (e) {
        console.log(`FAIL ${e.message.slice(0, 100)}`);
        log.push({ id: p.id, brand: p.brand, name: p.name, filename, ok: false, error: e.message.slice(0, 200), at: new Date().toISOString() });
        fail++;
        if (e.status === 429) { console.log('  rate limit — sleep 30s'); await sleep(30_000); }
        if (e.status === 400 && /billing/i.test(e.message)) { console.error('Billing limit reached — stopping.'); break; }
      }
      if (i % 3 === 2) fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
      await sleep(500);
    }
    fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
    console.log(`\nDone. ok=${ok} fail=${fail}.  Spent ~$${spent.toFixed(2)}.  Log: ${LOG_FILE}`);
  } finally {
    await sql.end();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
