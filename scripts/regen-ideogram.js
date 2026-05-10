/**
 * Regenerate product images using Ideogram (text-specialist AI).
 * Ideogram is the best AI for rendering specific text accurately on products.
 *
 * Setup:
 *   1. Get API key from https://ideogram.ai/manage-api
 *   2. Add to .env.local: IDEOGRAM_API_KEY="your_key_here"
 *
 * Usage:
 *   node scripts/regen-ideogram.js <productId>          # one
 *   node scripts/regen-ideogram.js --ai-only            # all 130 without real photos
 *   node scripts/regen-ideogram.js --ids id1,id2,id3
 *
 * Pricing (V_2_TURBO model): ~$0.05/image. 130 images ≈ $6.50.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const postgres = require('postgres');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const PUBLIC_DIR = path.join(__dirname, '../public/images/products');
const API_URL = 'https://api.ideogram.ai/generate';
const API_KEY = process.env.IDEOGRAM_API_KEY;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Same brand visual cues as before — Ideogram will render the brand name accurately
const BRAND_VISUAL_CUES = {
  'La Roche-Posay': 'minimalist white packaging with blue accents',
  'Avène': 'pale blue and white packaging',
  'Caudalie': 'deep emerald green glass with gold accents',
  'Bioderma': 'white packaging with bold colored caps',
  'Vichy': 'silver, blue, and red packaging',
  'Nuxe': 'amber rose-gold packaging',
  'Klorane': 'pastel packaging with botanical illustrations',
  'Embryolisse': 'white aluminum tube with thin blue band',
  'Filorga': 'sleek black and silver clinical packaging',
  'SVR': 'minimalist white and pastel packaging',
  'Ducray': 'orange and beige medical-pharmacy packaging',
  'A-Derma': 'green and beige soft natural packaging',
  'Lierac': 'pastel pink and silver luxury packaging',
  'Phyto': 'green botanical-themed packaging',
  'René Furterer': 'cream and gold luxury salon packaging',
  'Uriage': 'white and blue mountain-spring packaging',
  'Institut Esthederm': 'white and orange clinical packaging',
  'Cattier': 'cream and green organic packaging',
  'Melvita': 'green and amber organic packaging',
  'Sanoflore': 'green and white organic French packaging',
  'Mustela': 'soft pastel pink, blue, and white baby-care packaging',
  'Galenic': 'minimalist white and gold packaging',
  'Roger & Gallet': 'amber-tan classical apothecary packaging',
  'Noreva': 'white and silver clinical packaging',
  'Payot': 'pale blue and white classic French packaging',
  'Clarins': 'red and white iconic packaging',
  'Eucerin': 'navy blue and white clinical-pharmacy packaging',
  'Topicrem': 'soft pastel pharmacy packaging',
  'Patyka': 'amber glass with cream label',
  'Christophe Robin': 'minimalist white glass jars',
  'La Rosée': 'soft pink and white delicate packaging',
  'Weleda': 'iconic forest-green metal tubes',
  'Manucurist': 'translucent glass nail polish bottles',
  'Marvis': 'silver toothpaste tubes vintage-modern',
  'Puressentiel': 'fresh green and white essential-oil packaging',
  'Voltaren': 'red and yellow medical packaging',
  'Panier des Sens': 'vintage Provençal soap packaging',
  'Mediceutics': 'minimalist clinical white packaging',
  'Biotherm': 'turquoise and silver thermal-spa packaging',
  'Darphin': 'amber glass dropper bottles with pastel labels',
  'Biologique Recherche': 'iconic clinical white bottle with bold typography',
  'By Terry': 'rose-gold and pastel luxury packaging',
  'Cosmetics 27': 'small green and white minimalist apothecary jars',
  'Apivita': 'amber-honey and gold beehive-themed packaging',
  'Yon-Ka': 'green spa-aromatherapy packaging',
  'Garancia': 'whimsical fairy-tale colorful packaging',
  'Hexomedine': 'classic yellow medical bottle',
  'Ialuset': 'simple white medical tube with red accents',
  'Boiron': 'classic French pharmacy white-and-blue packaging',
  'Biafine': 'iconic white tube',
  'Talika': 'sleek white-and-pastel modern packaging',
};

const CATEGORY_PACKAGING = {
  'Moisturizer': 'a smooth tube or jar',
  'Serum': 'a glass dropper bottle',
  'Sunscreen': 'a smooth squeeze tube',
  'Cleanser': 'a smooth pump bottle',
  'Toner': 'a slim plastic bottle',
  'Mist': 'an aluminum spray can',
  'Mask': 'a smooth tube or jar',
  'Eye Care': 'a small tube',
  'Lip Care': 'a small lip balm tube or pot',
  'Hair Care': 'a tall plastic bottle',
  'Body Care': 'a tall pump bottle',
  'Body Oil': 'a clear glass bottle',
  'Treatment': 'a small smooth tube',
  'Makeup': 'a small bottle or compact',
};

function buildPrompt(p) {
  const cue = BRAND_VISUAL_CUES[p.brand] || 'clean French pharmacy packaging';
  const pkg = CATEGORY_PACKAGING[p.category] || 'clean packaging';
  // Ideogram is great at text — explicitly ask for the brand and product name printed
  return `Studio product photography of ${pkg} for a French pharmacy ${p.category.toLowerCase()}. ${cue}. The packaging clearly displays the brand name "${p.brand}" in bold modern typography, with the product name "${p.name}" in smaller text below. Single product centered on a soft warm cream background with strong directional natural light casting a long crisp shadow. Photorealistic, clean editorial aesthetic, minimalist. No people, no hands, no extra props.`;
}

function postJson(url, body, headers) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(body));
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        ...headers,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        if (res.statusCode >= 400) {
          return reject(Object.assign(new Error(`HTTP ${res.statusCode}: ${text.slice(0, 200)}`), { status: res.statusCode }));
        }
        try { resolve(JSON.parse(text)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function downloadToFile(url, outPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outPath);
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close(); try { fs.unlinkSync(outPath); } catch {}
        return downloadToFile(res.headers.location, outPath).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        file.close(); try { fs.unlinkSync(outPath); } catch {}
        return reject(new Error(`download HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

async function regenOne(p) {
  const prompt = buildPrompt(p);
  const resp = await postJson(API_URL, {
    image_request: {
      prompt,
      model: 'V_2_TURBO',
      magic_prompt_option: 'ON',
      aspect_ratio: 'ASPECT_1_1',
      style_type: 'REALISTIC',
    },
  }, { 'Api-Key': API_KEY });

  const img = resp?.data?.[0];
  const imgUrl = img?.url;
  if (!imgUrl) throw new Error(`no url in response: ${JSON.stringify(resp).slice(0, 200)}`);

  const filename = path.basename(p.image_url);
  const outPath = path.join(PUBLIC_DIR, filename);
  await downloadToFile(imgUrl, outPath);
  return { filename, outPath };
}

async function main() {
  if (!API_KEY) {
    console.error('Missing IDEOGRAM_API_KEY in .env.local');
    console.error('Get one at https://ideogram.ai/manage-api and add to .env.local:');
    console.error('  IDEOGRAM_API_KEY="your_key_here"');
    process.exit(1);
  }
  const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
  let products = [];
  try {
    const args = process.argv.slice(2);
    if (args[0] === '--ai-only') {
      // Products that still have AI placeholder images (no scraped real photo yet)
      // Identified by image_url pointing to /images/products/ AND not in the scrape success list
      const reportPath = path.join(__dirname, 'data/scrape-report.json');
      const scrapedOk = fs.existsSync(reportPath)
        ? new Set(JSON.parse(fs.readFileSync(reportPath, 'utf8')).filter(r => r.ok).map(r => r.id))
        : new Set();
      products = await sql`
        SELECT p.id, p.name, p.category, p.image_url, b.name AS brand
        FROM products p JOIN brands b ON b.id = p.brand_id
        WHERE p.image_url LIKE '/images/products/%'
        ORDER BY b.name, p.name
      `;
      products = products.filter(p => !scrapedOk.has(p.id));
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
      const r = await regenOne(products[0]);
      console.log(`✓ ${products[0].brand} - ${products[0].name} → ${r.filename}`);
      return;
    } else {
      console.error('Usage: regen-ideogram.js <productId> | --ai-only | --ids id1,id2');
      process.exit(1);
    }
  } finally { await sql.end(); }

  console.log(`Regenerating ${products.length} products via Ideogram V_2_TURBO (~$0.05/image)...`);
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
