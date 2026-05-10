/**
 * Regenerate product images using Pollinations.ai (free, FLUX-based).
 * No API key needed — just a URL with the prompt encoded.
 *
 * Usage:
 *   node scripts/regen-pollinations.js <productId> [custom prompt]   # single product
 *   node scripts/regen-pollinations.js --all-dalle                    # all 130 DALL-E products
 *   node scripts/regen-pollinations.js --ids id1,id2,id3              # specific list
 *
 * Reuses image_url filename from DB so no schema change needed.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const postgres = require('postgres');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const PUBLIC_DIR = path.join(__dirname, '../public/images/products');

// Brand-specific visual cues — same dictionary as the DALL-E version, refined for FLUX.
const BRAND_VISUAL_CUES = {
  'La Roche-Posay': 'minimalist white packaging with blue accents, clinical pharmacy aesthetic',
  'Avène': 'pale blue and white packaging with calm medical aesthetic',
  'Caudalie': 'deep emerald green glass with gold accents, frosted-glass aesthetic',
  'Bioderma': 'white packaging with bold colored caps, clinical pharmacy aesthetic',
  'Vichy': 'silver, blue, and red packaging, minimalist Swiss-pharmacy aesthetic',
  'Nuxe': 'amber rose-gold packaging with botanical aesthetic',
  'Klorane': 'pastel packaging with botanical illustrations',
  'Embryolisse': 'white aluminum tube with thin blue band',
  'Filorga': 'sleek black and silver clinical anti-aging packaging',
  'SVR': 'minimalist white and pastel packaging',
  'Ducray': 'orange and beige medical-pharmacy packaging',
  'A-Derma': 'green and beige soft natural packaging',
  'Lierac': 'pastel pink and silver luxury skincare aesthetic',
  'Phyto': 'green botanical-themed packaging',
  'René Furterer': 'cream and gold luxury salon hair care aesthetic',
  'Uriage': 'white and blue mountain-spring-water themed packaging',
  'Institut Esthederm': 'white and orange clinical aesthetic',
  'Cattier': 'cream and green organic-natural aesthetic',
  'Melvita': 'green and amber organic-honey aesthetic',
  'Sanoflore': 'green and white organic French pharmacy aesthetic',
  'Mustela': 'soft pastel pink, blue, and white baby-care aesthetic',
  'Galenic': 'minimalist white and gold pharmacy aesthetic',
  'Roger & Gallet': 'amber-tan classical apothecary aesthetic',
  'Noreva': 'white and silver clinical pharmacy aesthetic',
  'Payot': 'pale blue and white classic French skincare aesthetic',
  'Clarins': 'red and white iconic Clarins aesthetic',
  'Eucerin': 'navy blue and white clinical-pharmacy aesthetic',
  'Topicrem': 'soft pastel pharmacy aesthetic',
  'Patyka': 'amber glass with cream label, organic-luxury aesthetic',
  'Christophe Robin': 'minimalist white glass jars',
  'La Rosée': 'soft pink and white delicate pastel aesthetic',
  'Weleda': 'iconic forest-green metal tubes',
  'Manucurist': 'translucent glass nail polish bottles',
  'Marvis': 'silver toothpaste tubes vintage-modern aesthetic',
  'Puressentiel': 'fresh green and white essential-oil packaging',
  'Voltaren': 'red and yellow medical packaging',
  'Panier des Sens': 'vintage Provençal soap-pharmacy aesthetic',
  'Mediceutics': 'minimalist clinical white packaging',
  'Biotherm': 'turquoise and silver thermal-spa aesthetic',
  'Darphin': 'amber glass dropper bottles with pastel labels',
  'Biologique Recherche': 'iconic clinical white bottle with bold typography',
  'By Terry': 'rose-gold and pastel luxury aesthetic',
  'Cosmetics 27': 'small green and white minimalist apothecary jars',
  'Apivita': 'amber-honey and gold beehive-themed aesthetic',
  'Yon-Ka': 'green spa-aromatherapy aesthetic',
  'Garancia': 'whimsical fairy-tale colorful illustrated packaging',
  'Hexomedine': 'classic yellow medical bottle, vintage pharmacy aesthetic',
  'Ialuset': 'simple white medical tube with red accents',
  'Boiron': 'classic French pharmacy white-and-blue aesthetic',
  'Biafine': 'iconic white tube',
  'Talika': 'sleek white-and-pastel modern beauty-tech aesthetic',
};

// Map category to a concrete packaging archetype to ground the model
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
  // House style: clean editorial, strong directional shadow, warm neutral background.
  // Brand name and product name MUST appear clearly on the packaging — these are
  // pharmacy products and the user wants the label readable so the catalog is useful.
  return `Studio product photography of ${pkg} for a French pharmacy ${p.category.toLowerCase()}. ${cue}. The brand name "${p.brand}" is printed clearly and prominently on the front of the packaging in clean modern typography. The product label area is filled with the brand wordmark. Single product centered on a soft warm cream background with strong directional natural light casting a long crisp shadow. Photorealistic, clean editorial aesthetic, minimalist, square 1024x1024. No people, no hands, no extra props.`;
}

function pollinationsUrl(prompt, seed) {
  const params = new URLSearchParams({
    model: 'flux',
    width: '1024',
    height: '1024',
    nologo: 'true',
    enhance: 'true',
    seed: String(seed),
  });
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params}`;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function downloadOnce(url, outPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outPath);
    https.get(url, { timeout: 180000 }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        try { fs.unlinkSync(outPath); } catch {}
        return downloadOnce(res.headers.location, outPath).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(outPath); } catch {}
        return reject(Object.assign(new Error(`HTTP ${res.statusCode}`), { status: res.statusCode }));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (e) => {
      try { fs.unlinkSync(outPath); } catch {}
      reject(e);
    });
  });
}

async function downloadWithRetry(url, outPath, maxAttempts = 12) {
  let attempt = 0;
  while (true) {
    try {
      return await downloadOnce(url, outPath);
    } catch (e) {
      attempt++;
      if (e.status === 429 && attempt < maxAttempts) {
        // Long patient backoff — Pollinations free-tier cooldown can be 30+ min
        const wait = Math.min(300000, 10000 * Math.pow(1.6, attempt - 1));
        console.log(`    [429 attempt ${attempt}] backoff ${Math.round(wait/1000)}s`);
        await sleep(wait);
        continue;
      }
      throw e;
    }
  }
}

async function regenOne(p, customPrompt) {
  const prompt = customPrompt || buildPrompt(p);
  const seed = Math.floor(Math.random() * 1_000_000);
  const url = pollinationsUrl(prompt, seed);
  const filename = path.basename(p.image_url || `${p.brand}_${p.name}`.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '.png');
  const outPath = path.join(PUBLIC_DIR, filename);
  await downloadWithRetry(url, outPath);
  return { filename, outPath };
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
  try {
    let products = [];
    const args = process.argv.slice(2);

    if (args[0] === '--all') {
      products = await sql`
        SELECT p.id, p.name, p.category, p.image_url, b.name AS brand
        FROM products p JOIN brands b ON b.id = p.brand_id
        ORDER BY b.name, p.name
      `;
      const SINCE = new Date('2026-05-09T22:00:00Z');
      const before = products.length;
      products = products.filter(p => {
        const filename = path.basename(p.image_url || '');
        if (!filename) return true;
        const fp = path.join(PUBLIC_DIR, filename);
        try {
          const stat = fs.statSync(fp);
          return stat.mtime < SINCE;
        } catch { return true; }
      });
      console.log(`Resume: skipping ${before - products.length} already-regenerated products`);
    } else if (args[0] === '--all-dalle') {
      products = await sql`
        SELECT p.id, p.name, p.category, p.image_url, b.name AS brand
        FROM products p JOIN brands b ON b.id = p.brand_id
        WHERE p.image_url LIKE '/images/products/%'
        ORDER BY b.name, p.name
      `;
      // Resume: skip products whose local image was modified after a recent threshold
      // (i.e. already regenerated this session). Compare against the Weleda test time.
      const SINCE = new Date('2026-05-09T22:00:00Z'); // after the throttled run started
      const before = products.length;
      products = products.filter(p => {
        const filename = path.basename(p.image_url);
        const fp = path.join(PUBLIC_DIR, filename);
        try {
          const stat = fs.statSync(fp);
          return stat.mtime < SINCE;
        } catch { return true; }
      });
      console.log(`Resume: skipping ${before - products.length} already-regenerated products`);
    } else if (args[0] === '--ids') {
      const ids = (args[1] || '').split(',').filter(Boolean);
      products = await sql`
        SELECT p.id, p.name, p.category, p.image_url, b.name AS brand
        FROM products p JOIN brands b ON b.id = p.brand_id
        WHERE p.id = ANY(${ids})
      `;
    } else if (args[0]) {
      const productId = args[0];
      const customPrompt = args[1];
      products = await sql`
        SELECT p.id, p.name, p.category, p.image_url, b.name AS brand
        FROM products p JOIN brands b ON b.id = p.brand_id
        WHERE p.id = ${productId}
      `;
      if (!products.length) { console.error('No product with that id'); process.exit(1); }
      const r = await regenOne(products[0], customPrompt);
      console.log(`✓ ${products[0].brand} - ${products[0].name} → ${r.filename}`);
      return;
    } else {
      console.error('Usage: regen-pollinations.js <productId> [prompt] | --all-dalle | --ids id1,id2');
      process.exit(1);
    }

    console.log(`Regenerating ${products.length} products via Pollinations.ai (sequential, 10s gap)...`);
    let ok = 0, fail = 0;
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      try {
        await regenOne(p);
        ok++;
        console.log(`  [${i + 1}/${products.length}] ✓ ${p.brand} - ${p.name}`);
      } catch (e) {
        fail++;
        console.error(`  [${i + 1}/${products.length}] ✗ ${p.brand} - ${p.name}: ${e.message}`);
      }
      await sleep(10000);
    }
    console.log(`\nDone. ok=${ok} fail=${fail}`);
  } finally {
    await sql.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
