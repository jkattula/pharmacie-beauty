/**
 * Regenerate product images using Google Imagen 3 (via Gemini API).
 * Same model Replit Agent uses — best-in-class for branded product photography.
 *
 * Setup:
 *   1. Get free API key at https://aistudio.google.com/app/apikey
 *   2. Add to .env.local: GEMINI_API_KEY="AIza..."
 *
 * Usage:
 *   node scripts/regen-imagen.js <productId>          # one
 *   node scripts/regen-imagen.js --ai-only            # all 130 without real photos
 *   node scripts/regen-imagen.js --ids id1,id2,id3
 *
 * Pricing: ~$0.03/image. 130 images ≈ $4.
 */
const fs = require('fs');
const path = require('path');
const postgres = require('postgres');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const PUBLIC_DIR = path.join(__dirname, '../public/images/products');
const API_KEY = process.env.GEMINI_API_KEY;
// Gemini Flash Image — free tier, great at branded product photos
const MODEL = 'gemini-2.5-flash-image';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Simple prompt template — model uses its own product knowledge from training
function buildPrompt(p) {
  return `${p.brand} ${p.name} on a clean cream background, studio product photography, photorealistic.`;
}

async function generateImage(prompt) {
  const resp = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['IMAGE'],
      },
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw Object.assign(new Error(`HTTP ${resp.status}: ${text.slice(0, 300)}`), { status: resp.status });
  }
  const data = await resp.json();
  // Find the inlineData part with image bytes
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find(p => p.inlineData?.data);
  if (!imgPart) throw new Error(`No image in response: ${JSON.stringify(data).slice(0, 300)}`);
  return Buffer.from(imgPart.inlineData.data, 'base64');
}

async function regenOne(p, customPrompt) {
  const prompt = customPrompt || buildPrompt(p);
  let attempt = 0;
  while (true) {
    try {
      const buf = await generateImage(prompt);
      const filename = path.basename(p.image_url);
      const outPath = path.join(PUBLIC_DIR, filename);
      fs.writeFileSync(outPath, buf);
      return { filename, outPath, bytes: buf.length };
    } catch (e) {
      attempt++;
      if (e.status === 429 && attempt < 5) {
        const wait = 5000 * attempt;
        console.log(`    [429 attempt ${attempt}] backoff ${wait}ms`);
        await sleep(wait);
        continue;
      }
      throw e;
    }
  }
}

async function main() {
  if (!API_KEY) {
    console.error('Missing GEMINI_API_KEY in .env.local');
    process.exit(1);
  }
  const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
  let products = [];
  try {
    const args = process.argv.slice(2);
    if (args[0] === '--ai-only') {
      products = await sql`
        SELECT p.id, p.name, p.category, p.image_url, b.name AS brand
        FROM products p JOIN brands b ON b.id = p.brand_id
        WHERE p.image_url LIKE '/images/products/%'
        ORDER BY b.name, p.name
      `;
    } else if (args[0] === '--ids') {
      const ids = (args[1] || '').split(',').filter(Boolean);
      products = await sql`
        SELECT p.id, p.name, p.category, p.image_url, b.name AS brand
        FROM products p JOIN brands b ON b.id = p.brand_id
        WHERE p.id = ANY(${ids})
      `;
    } else if (args[0]) {
      products = await sql`
        SELECT p.id, p.name, p.category, p.image_url, b.name AS brand
        FROM products p JOIN brands b ON b.id = p.brand_id
        WHERE p.id = ${args[0]}
      `;
      if (!products.length) { console.error('No product'); process.exit(1); }
      const customPrompt = args[1];
      const r = await regenOne(products[0], customPrompt);
      console.log(`✓ ${products[0].brand} - ${products[0].name} → ${r.filename} (${r.bytes}b)`);
      return;
    } else {
      console.error('Usage: regen-imagen.js <productId> [prompt] | --ai-only | --ids id1,id2');
      process.exit(1);
    }
  } finally { await sql.end(); }

  console.log(`Regenerating ${products.length} products via Imagen 3 (~$0.03 each)...`);
  let ok = 0, fail = 0;
  let idx = 0;
  const concurrency = 3;
  async function worker() {
    while (idx < products.length) {
      const myIdx = idx++;
      const p = products[myIdx];
      try {
        await regenOne(p);
        ok++;
        console.log(`  [${myIdx + 1}/${products.length}] ✓ ${p.brand} - ${p.name}`);
      } catch (e) {
        fail++;
        console.error(`  [${myIdx + 1}/${products.length}] ✗ ${p.brand} - ${p.name}: ${e.message}`);
      }
      await sleep(500);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  console.log(`\nDone. ok=${ok} fail=${fail}`);
}

main().catch(e => { console.error(e); process.exit(1); });
