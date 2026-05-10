/**
 * Recover real product photos from Supabase Storage.
 * For every product whose image_url is a Supabase Storage URL, download the file
 * back into public/images/products/{filename} so the local app serves the real photo.
 *
 * Safe to re-run — overwrites local file with the canonical Supabase copy.
 *
 * Run: node scripts/recover-real-images.js
 *      node scripts/recover-real-images.js --force  (overwrite even if recently modified)
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const postgres = require('postgres');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const PUBLIC_DIR = path.join(__dirname, '../public/images/products');
const FORCE = process.argv.includes('--force');

function urlToLocalFilename(url) {
  if (!url || !url.includes('/product-images/')) return null;
  const filename = url.split('/product-images/').pop();
  if (!filename) return null;
  // Mirror the helper's normalization for consistent local filename
  const decoded = decodeURIComponent(filename);
  const normalized = decoded
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\+/g, '_plus_')
    .replace(/[^a-zA-Z0-9_.\-]/g, '_');
  return normalized;
}

function download(url, outPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outPath);
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(outPath);
        return download(res.headers.location, outPath).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(outPath);
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
  try {
    const rows = await sql`
      SELECT id, name, image_url
      FROM products
      WHERE image_url LIKE '%supabase.co%/product-images/%'
      ORDER BY name
    `;
    console.log(`Found ${rows.length} products with Supabase Storage URLs.`);

    let recovered = 0, skipped = 0, failed = 0;
    let idx = 0;
    const concurrency = 8;

    async function worker() {
      while (idx < rows.length) {
        const myIdx = idx++;
        const p = rows[myIdx];
        const filename = urlToLocalFilename(p.image_url);
        if (!filename) { skipped++; continue; }
        const outPath = path.join(PUBLIC_DIR, filename);
        try {
          await download(p.image_url, outPath);
          recovered++;
          if (recovered % 20 === 0) console.log(`  recovered ${recovered}/${rows.length}`);
        } catch (e) {
          failed++;
          console.error(`  ✗ ${p.name}: ${e.message}`);
        }
      }
    }
    await Promise.all(Array.from({ length: concurrency }, worker));

    console.log(`\nDone. recovered=${recovered} skipped=${skipped} failed=${failed}`);
  } finally {
    await sql.end();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
