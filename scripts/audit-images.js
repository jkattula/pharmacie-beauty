/**
 * Visual audit of product images.
 * For each product, send the local image to GPT-4o vision and ask:
 *   - Is this a credible photo of the named product?
 *   - Is the packaging type plausible (tube/bottle/jar/etc)?
 *   - Confidence score 1-5
 *
 * Output: scripts/data/image-audit.json with flags
 *
 * Run: node scripts/audit-images.js
 */
const fs = require('fs');
const path = require('path');
const postgres = require('postgres');
const OpenAI = require('openai');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PUBLIC_DIR = path.join(__dirname, '../public');
const OUT = path.join(__dirname, 'data/image-audit.json');

const SYSTEM = `You are auditing product photography for a French pharmacy beauty guide.
Given a brand + product name + category, judge the attached image.
Return STRICT JSON:
{
  "credible": boolean,            // true if the image plausibly represents this product (right packaging type, on-brand colors, no obviously wrong elements)
  "confidence": 1 | 2 | 3 | 4 | 5, // 1 = clearly wrong; 5 = looks correct
  "issues": string[]              // short specific problems, e.g. ["wrong color (should be green)", "looks like generic tube, not iconic glass bottle"]
}
Only flag credibility=false if the image is materially misleading. AI-generated stand-ins of plausible packaging are acceptable as long as they don't contradict known iconic product visuals.`;

function dbUrlToFile(imageUrl) {
  if (!imageUrl) return null;
  let filename = imageUrl;
  if (filename.includes('/attached_assets/generated_images/')) {
    filename = filename.split('/attached_assets/generated_images/').pop();
  } else if (filename.includes('/product-images/')) {
    filename = filename.split('/product-images/').pop();
  } else if (filename.startsWith('/images/products/')) {
    return path.join(PUBLIC_DIR, filename);
  } else {
    filename = filename.split('/').pop();
  }
  if (!filename) return null;
  filename = decodeURIComponent(filename);
  const normalized = filename
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\+/g, '_plus_')
    .replace(/[^a-zA-Z0-9_.\-]/g, '_');
  return path.join(PUBLIC_DIR, 'images', 'products', normalized);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function auditOne(p) {
  const file = dbUrlToFile(p.image_url);
  if (!file || !fs.existsSync(file)) {
    return { credible: false, confidence: 1, issues: ['image file missing'] };
  }
  const b64 = fs.readFileSync(file).toString('base64');
  const dataUrl = `data:image/png;base64,${b64}`;

  let attempt = 0;
  while (true) {
    try {
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: [
            { type: 'text', text: `Brand: ${p.brand}\nProduct: ${p.name}\nCategory: ${p.category}\n\nReturn only the JSON.` },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } }
          ]},
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
        max_tokens: 200,
      });
      return JSON.parse(resp.choices[0]?.message?.content || '{}');
    } catch (e) {
      attempt++;
      if (e.status === 429 && attempt < 6) {
        const wait = Math.min(60000, 2000 * Math.pow(2, attempt));
        console.log(`  [retry ${attempt}] 429 — waiting ${wait}ms`);
        await sleep(wait);
        continue;
      }
      throw e;
    }
  }
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
  try {
    const products = await sql`
      SELECT p.id, p.name, p.category, p.image_url, b.name AS brand
      FROM products p JOIN brands b ON b.id = p.brand_id
      WHERE p.image_url IS NOT NULL
      ORDER BY b.name, p.name
    `;
    console.log(`Auditing ${products.length} images...`);

    let results = [];
    if (fs.existsSync(OUT)) {
      results = JSON.parse(fs.readFileSync(OUT, 'utf8'));
      console.log(`Resuming — ${results.length} already done.`);
    }
    const doneIds = new Set(results.map(r => r.id));

    let idx = 0;
    const concurrency = 2;
    async function worker() {
      while (idx < products.length) {
        const myIdx = idx++;
        const p = products[myIdx];
        if (doneIds.has(p.id)) continue;
        try {
          const r = await auditOne(p);
          results.push({ id: p.id, brand: p.brand, name: p.name, image_url: p.image_url, ...r });
          doneIds.add(p.id);
          if (results.length % 10 === 0) {
            fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
            const flagged = results.filter(r => !r.credible).length;
            console.log(`  [${results.length}/${products.length}] flagged=${flagged}`);
          }
        } catch (e) {
          console.error(`FAIL ${p.brand} - ${p.name}:`, e.message);
        }
      }
    }
    await Promise.all(Array.from({ length: concurrency }, worker));
    fs.writeFileSync(OUT, JSON.stringify(results, null, 2));

    const flagged = results.filter(r => !r.credible);
    const lowConf = results.filter(r => (r.confidence || 0) <= 2);
    console.log(`\nDone. Total: ${results.length}, flagged: ${flagged.length}, low-confidence: ${lowConf.length}`);
  } finally {
    await sql.end();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
