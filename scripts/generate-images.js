/**
 * Generate product images via DALL-E 3 for each enriched product.
 * Saves to public/images/products/{slug}.png and writes URLs back to JSON.
 *
 * Run: node scripts/generate-images.js
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const OpenAI = require('openai');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ENRICHED_PATH = path.join(__dirname, 'data/new-products-enriched.json');
const IMAGES_DIR = path.join(__dirname, '../public/images/products');

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/(^_|_$)/g, '');
}

function buildPrompt(p) {
  const detail = p.imagePromptDetails || `${p.category} in ${p.packaging || 'standard pharmacy packaging'}`;
  return `Studio product photography of a single ${p.brand} ${p.name} ${p.category}, shown as ${detail}. Centered on a soft warm off-white #F6F4F1 background with subtle shadow. Photorealistic, clean editorial style, no text overlays, no logos visible, no people, square 1024x1024.`;
}

function downloadToFile(url, outPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outPath);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

async function generateOne(p) {
  const slug = `${slugify(p.brand)}_${slugify(p.name)}`;
  const filename = `${slug}.png`;
  const outPath = path.join(IMAGES_DIR, filename);
  const localUrl = `/images/products/${filename}`;

  if (fs.existsSync(outPath)) {
    return { ...p, imageSlug: slug, imageUrl: localUrl, imageGenerated: 'skipped' };
  }

  const resp = await openai.images.generate({
    model: 'dall-e-3',
    prompt: buildPrompt(p),
    n: 1,
    size: '1024x1024',
    quality: 'standard',
    response_format: 'url',
  });

  const imgUrl = resp.data[0]?.url;
  if (!imgUrl) throw new Error('No image URL returned');
  await downloadToFile(imgUrl, outPath);

  return { ...p, imageSlug: slug, imageUrl: localUrl, imageGenerated: 'created' };
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('Missing OPENAI_API_KEY');
    process.exit(1);
  }
  if (!fs.existsSync(ENRICHED_PATH)) {
    console.error(`Missing ${ENRICHED_PATH} — run enrich-products.js first.`);
    process.exit(1);
  }
  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

  const products = JSON.parse(fs.readFileSync(ENRICHED_PATH, 'utf8'));
  console.log(`Generating images for ${products.length} products...`);

  // Mutate-in-place: each slot starts as the original product, gets replaced with the result
  const results = [...products];
  let idx = 0;
  const concurrency = 2;

  async function worker() {
    while (idx < products.length) {
      const myIdx = idx++;
      const p = products[myIdx];
      try {
        const out = await generateOne(p);
        results[myIdx] = out;
        console.log(`[${myIdx + 1}/${products.length}] ${out.imageGenerated}: ${p.brand} - ${p.name}`);
        fs.writeFileSync(ENRICHED_PATH, JSON.stringify(results, null, 2));
      } catch (e) {
        console.error(`FAIL [${myIdx + 1}] ${p.brand} - ${p.name}:`, e.message);
        results[myIdx] = { ...p, imageGenerated: 'failed', imageError: e.message };
        fs.writeFileSync(ENRICHED_PATH, JSON.stringify(results, null, 2));
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));

  fs.writeFileSync(ENRICHED_PATH, JSON.stringify(results, null, 2));
  const created = results.filter(p => p.imageGenerated === 'created').length;
  const skipped = results.filter(p => p.imageGenerated === 'skipped').length;
  const failed = results.filter(p => p.imageGenerated === 'failed').length;
  console.log(`\nDone. created=${created} skipped=${skipped} failed=${failed}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
