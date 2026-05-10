/**
 * Regenerate DALL-E images for products flagged by the image audit.
 * Uses brand-specific visual cues + explicit no-text instructions to reduce hallucination.
 *
 * Run: node scripts/regenerate-flagged-images.js
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const postgres = require('postgres');
const OpenAI = require('openai');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const AUDIT = path.join(__dirname, 'data/image-audit.json');
const PUBLIC_DIR = path.join(__dirname, '../public/images/products');

// Brand-specific visual cues to ground DALL-E. Conservative — only describe well-known design.
const BRAND_VISUAL_CUES = {
  'La Roche-Posay': 'minimalist white packaging with blue accents and clinical typography',
  'Avène': 'pale blue and white packaging with clean medical aesthetic',
  'Caudalie': 'deep emerald green glass with gold caps, frosted-glass spa aesthetic',
  'Bioderma': 'white packaging with bold colored caps (pink for Sensibio, green for Atoderm, blue for Hydrabio)',
  'Vichy': 'silver, blue, and red packaging, minimalist Swiss-pharmacy aesthetic',
  'Nuxe': 'rose gold and amber-honey packaging, soft botanical aesthetic',
  'Klorane': 'pastel packaging with botanical illustrations, soft natural style',
  'Embryolisse': 'classic white aluminum tube with a thin blue band',
  'Filorga': 'sleek black and silver packaging, clinical anti-aging aesthetic',
  'SVR': 'minimalist white and pastel packaging with clean typography',
  'Ducray': 'orange and beige medical-pharmacy packaging',
  'A-Derma': 'green and beige soft natural packaging with oat-themed branding',
  'Lierac': 'pastel pink and silver luxury skincare aesthetic',
  'Phyto': 'green botanical-themed packaging',
  'René Furterer': 'cream and gold luxury salon hair care aesthetic',
  'Uriage': 'white and blue mountain-spring-water themed packaging',
  'Institut Esthederm': 'white and orange clinical aesthetic',
  'Cattier': 'cream and green organic-natural aesthetic',
  'Melvita': 'green and amber organic-honey aesthetic with botanical illustrations',
  'Sanoflore': 'green and white organic French pharmacy aesthetic',
  'Mustela': 'soft pastel pink, blue, and white baby-care aesthetic',
  'Galenic': 'minimalist white and gold pharmacy aesthetic',
  'Roger & Gallet': 'amber-tan classical apothecary aesthetic with vintage typography',
  'Noreva': 'white and silver clinical pharmacy aesthetic',
  'Payot': 'pale blue and white classic French skincare aesthetic',
  'Clarins': 'red and white iconic Clarins aesthetic',
  'Eucerin': 'navy blue and white clinical-pharmacy aesthetic',
  'Topicrem': 'soft pastel and white medical-skincare aesthetic',
  'Patyka': 'amber glass with cream label, organic-luxury aesthetic',
  'Christophe Robin': 'minimalist white glass jars with elegant black typography',
  'La Rosée': 'soft pink and white delicate pastel aesthetic',
  'Weleda': 'iconic forest-green metal tubes with white text',
  'Manucurist': 'translucent glass nail polish bottles with minimalist labels',
  'Marvis': 'silver collectible toothpaste tubes with vintage-modern typography',
  'Puressentiel': 'fresh green and white essential-oil pharmacy aesthetic',
  'Voltaren': 'red and yellow pain-relief medical packaging',
  'Panier des Sens': 'vintage Provençal soap-pharmacy aesthetic with pastel labels',
  'Mediceutics': 'minimalist clinical white packaging',
  'Biotherm': 'turquoise and silver thermal-spa aesthetic',
  'Darphin': 'amber glass dropper bottles with pastel paper labels',
  'Biologique Recherche': 'iconic clinical white plastic bottle with bold black serif typography',
  'By Terry': 'rose-gold and pastel luxury aesthetic',
  'Cosmetics 27': 'small green and white minimalist apothecary jars',
  'Apivita': 'amber-honey and gold beehive-themed aesthetic',
  'Yon-Ka': 'green spa-aromatherapy aesthetic',
  'Garancia': 'whimsical fairy-tale colorful illustrated packaging',
  'Topicrem': 'soft pastel pharmacy aesthetic',
  'Hexomedine': 'classic yellow medical bottle, vintage pharmacy aesthetic',
  'Ialuset': 'simple white medical tube with red accents',
  'Boiron': 'classic French pharmacy white-and-blue aesthetic',
  'Biafine': 'iconic white tube with bold red BIAFINE wordmark',
  'Talika': 'sleek white-and-pastel modern beauty-tech aesthetic',
};

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/(^_|_$)/g, '');
}

function buildPrompt(p) {
  const cue = BRAND_VISUAL_CUES[p.brand] || `clean French pharmacy packaging`;
  const category = (p.category || 'skincare product').toLowerCase();
  return `A single ${category} product from a French pharmacy, on a soft warm off-white #F6F4F1 background, centered with subtle natural shadow. The packaging should reflect: ${cue}. Photorealistic studio product photography, square 1024x1024.

CRITICAL: do NOT render any text, words, letters, or logos on the packaging — keep the label area blank or abstract. No people, no hands, no extra props. Just the product on a clean surface.`;
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

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function regenOne(p) {
  let attempt = 0;
  while (true) {
    try {
      const resp = await openai.images.generate({
        model: 'dall-e-3',
        prompt: buildPrompt(p),
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        response_format: 'url',
      });
      const url = resp.data[0]?.url;
      if (!url) throw new Error('no url');
      // Filename derived from the existing image_url so DB doesn't need updating
      const filename = path.basename(p.image_url || `${slugify(p.brand)}_${slugify(p.name)}.png`);
      const outPath = path.join(PUBLIC_DIR, filename);
      await downloadToFile(url, outPath);
      return { ok: true, file: filename };
    } catch (e) {
      attempt++;
      if ((e.status === 429 || /rate/i.test(e.message)) && attempt < 5) {
        const wait = 5000 * attempt;
        await sleep(wait);
        continue;
      }
      throw e;
    }
  }
}

async function main() {
  if (!fs.existsSync(AUDIT)) {
    console.error('Run audit-images.js first');
    process.exit(1);
  }
  const audit = JSON.parse(fs.readFileSync(AUDIT, 'utf8'));
  const flaggedAudit = audit.filter(a => (a.confidence || 0) <= 2);

  // Fetch category for each flagged product so the prompt is grounded
  const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
  const flaggedIds = flaggedAudit.map(a => a.id);
  const rows = await sql`SELECT id, category FROM products WHERE id = ANY(${flaggedIds})`;
  await sql.end();
  const catById = new Map(rows.map(r => [r.id, r.category]));
  const flagged = flaggedAudit.map(a => ({ ...a, category: catById.get(a.id) }));
  console.log(`Regenerating ${flagged.length} flagged images...`);

  let idx = 0;
  let ok = 0, fail = 0;
  const concurrency = 2;

  async function worker() {
    while (idx < flagged.length) {
      const myIdx = idx++;
      const p = flagged[myIdx];
      try {
        const r = await regenOne(p);
        ok++;
        console.log(`  [${myIdx + 1}/${flagged.length}] ✓ ${p.brand} - ${p.name}`);
      } catch (e) {
        fail++;
        console.error(`  [${myIdx + 1}/${flagged.length}] ✗ ${p.brand} - ${p.name}: ${e.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));

  console.log(`\nDone. ok=${ok} fail=${fail}`);
}
main().catch(e => { console.error(e); process.exit(1); });
