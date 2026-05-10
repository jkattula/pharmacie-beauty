/**
 * Regenerate a single product image with a custom or default targeted prompt.
 *
 * Usage:
 *   node scripts/regen-one.js <productId>
 *   node scripts/regen-one.js <productId> "custom DALL-E prompt"
 *
 * Reuses image_url filename from DB so no DB update needed.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const postgres = require('postgres');
const OpenAI = require('openai');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const PUBLIC_DIR = path.join(__dirname, '../public/images/products');

// More targeted than the generic regenerate-flagged script — describes packaging concretely
// and explicitly forbids any text/labels (DALL-E's main failure mode).
function defaultPrompt(p) {
  const cat = (p.category || 'skincare').toLowerCase();
  return `Studio product photography of a single ${cat} product on a soft warm off-white #F6F4F1 background, centered with a soft natural shadow. Photorealistic, clean editorial aesthetic, square 1024x1024.

The packaging is plain and untextured — no words, no letters, no numbers, no logos, no symbols, no labels of any kind anywhere on the product. Just clean colored packaging with subtle natural surface details. No people, no hands, no extra props.`;
}

function downloadToFile(url, outPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outPath);
    https.get(url, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

async function main() {
  const productId = process.argv[2];
  const customPrompt = process.argv[3];
  if (!productId) {
    console.error('Usage: node scripts/regen-one.js <productId> [optional custom prompt]');
    process.exit(1);
  }

  const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
  let p;
  try {
    const rows = await sql`
      SELECT p.id, p.name, p.category, p.image_url, b.name AS brand
      FROM products p JOIN brands b ON b.id = p.brand_id
      WHERE p.id = ${productId}
    `;
    if (!rows.length) {
      console.error(`No product found with id ${productId}`);
      process.exit(1);
    }
    p = rows[0];
  } finally {
    await sql.end();
  }

  console.log(`Regenerating: ${p.brand} — ${p.name}`);
  const prompt = customPrompt || defaultPrompt(p);
  console.log(`Prompt: ${prompt.slice(0, 200)}${prompt.length > 200 ? '...' : ''}`);

  const resp = await openai.images.generate({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size: '1024x1024',
    quality: 'standard',
    response_format: 'url',
  });
  const url = resp.data[0]?.url;
  if (!url) throw new Error('No image URL returned');

  const filename = path.basename(p.image_url);
  const outPath = path.join(PUBLIC_DIR, filename);
  await downloadToFile(url, outPath);
  console.log(`✓ Saved to ${outPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
