/**
 * Generate sample product images by pulling REAL product photos from retailer
 * pages and using Nano Banana image-to-image to restyle the background while
 * preserving the product's actual packaging.
 *
 * Outputs to /tmp/sample2-*.jpg — never overwrites real images.
 *
 * Run: node scripts/gen-reference-samples.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const KEY = process.env.GEMINI_API_KEY;
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${KEY}`;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

const SAMPLES = [
  { brand: 'Caudalie', product: 'Beauty Elixir Face Mist',
    page: 'https://us.caudalie.com/p/319C/319c-beauty-elixir-prep-set-glow-face-mist.html' },
  { brand: 'Weleda', product: 'Skin Food Original',
    page: 'https://www.weleda.com/product/skin-food-original-ultra-rich-cream-g009398' },
  { brand: 'Nuxe', product: 'Huile Prodigieuse Multi-Purpose Dry Oil',
    page: 'https://us.nuxe.com/products/huile-prodigieuse-100ml' },
  { brand: 'Marvis', product: 'Strong Mint Toothpaste',
    page: 'https://www.marvis.com/en/toothpastes/classic-strong/' },
  { brand: 'Roger & Gallet', product: "Bois d'Orange Eau Fraiche",
    page: 'https://us.roger-gallet.com/Product/orange-wood-wellbeing-fragrant-water-1-oz' },
  { brand: 'Eucerin', product: 'Replenishing Skin Relief Face Cream with 5% Urea',
    page: 'https://www.walmart.com/ip/Eucerin-Dry-Skin-Replenishing-Face-Cream-Night-5-Urea-With-Lactate-50Ml/793440287' },
  { brand: 'Clarins', product: 'Double Serum',
    page: 'https://www.target.com/p/clarins-double-serum-anti-aging-firming-serum-1-oz-ulta-beauty/-/A-87884918' },
  { brand: 'Apivita', product: 'Express Beauty Honey Hydrating Mask',
    page: 'https://www.apivita.com/usa/face-care/facial-masks' },
];

const BACKGROUNDS = [
  'a sun-lit white marble bathroom shelf, soft natural side-light from a window, gentle shadow',
  'a pale oak wooden vanity surface, soft cool morning light, minimal styling',
  'a polished beige stone surface with a single dried botanical sprig out of focus in the background',
  'a clean cream-colored linen cloth backdrop, soft warm directional lighting',
  'a smooth concrete shelf with subtle texture, soft natural daylight from the left',
  'a brushed warm-gray ceramic tray on a wooden table, soft window light',
  'a single neutral ivory step in a tonal cream studio setting, soft top-down light',
  'a pale travertine stone shelf, soft natural light, very subtle shadow',
];

async function fetchHtml(url) {
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' },
    redirect: 'follow',
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} fetching ${url}`);
  return await r.text();
}

function extractOgImage(html) {
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return og ? og[1] : null;
}

async function fetchImageBytes(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`image HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const ct = r.headers.get('content-type') || 'image/jpeg';
  return { buf, mime: ct.split(';')[0].trim() };
}

async function restyleWithNanoBanana(refBuf, refMime, brand, product, bg) {
  const prompt = `This is a photograph of ${brand} ${product}. Recreate this exact product — preserve all packaging shape, materials, colors, labels, brand wordmark, and every piece of typography exactly as shown. Place the product on ${bg}. Single product, centered or slightly off-center, photorealistic 8k product photography, soft natural lighting, gentle drop shadow, no text added, no people, no hands. The product must look like the same real product as in the input image. --ar 4:5`;
  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: refMime, data: refBuf.toString('base64') } },
      ],
    }],
    generationConfig: { responseModalities: ['IMAGE'] },
  };
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`nano HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  const img = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!img) throw new Error('no image in nano response');
  return Buffer.from(img.inlineData.data, 'base64');
}

function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

async function main() {
  for (let i = 0; i < SAMPLES.length; i++) {
    const s = SAMPLES[i];
    const bg = BACKGROUNDS[i % BACKGROUNDS.length];
    const filename = `sample2-${slug(s.brand)}_${slug(s.product)}.jpg`;
    process.stdout.write(`${s.brand} | ${s.product}\n`);
    try {
      process.stdout.write('  → fetching page ... ');
      const html = await fetchHtml(s.page);
      const ogUrl = extractOgImage(html);
      if (!ogUrl) throw new Error('no og:image found');
      console.log(`og:image = ${ogUrl.slice(0, 90)}...`);

      process.stdout.write('  → downloading reference image ... ');
      const { buf, mime } = await fetchImageBytes(ogUrl);
      console.log(`${(buf.length / 1024).toFixed(0)}KB ${mime}`);

      // Also save reference for comparison
      fs.writeFileSync(`/tmp/ref-${slug(s.brand)}_${slug(s.product)}.${mime.split('/')[1]}`, buf);

      process.stdout.write('  → Nano Banana restyle ... ');
      const out = await restyleWithNanoBanana(buf, mime, s.brand, s.product, bg);
      const pngTmp = `/tmp/${filename.replace(/\.jpg$/, '.png')}`;
      const outJpg = `/tmp/${filename}`;
      fs.writeFileSync(pngTmp, out);
      execSync(`sips -s format jpeg -s formatOptions 90 "${pngTmp}" --out "${outJpg}" >/dev/null 2>&1`);
      fs.unlinkSync(pngTmp);
      console.log(`OK → ${outJpg} (${(fs.statSync(outJpg).size / 1024).toFixed(0)}KB) [bg: ${bg.slice(0, 40)}...]`);
    } catch (e) {
      console.log(`FAIL: ${e.message}`);
    }
  }
  // Copy to Desktop too for easy viewing
  execSync('mkdir -p /Users/jenniferkattula/Desktop/pharmacie-samples-v2 && cp /tmp/sample2-*.jpg /tmp/ref-*.* /Users/jenniferkattula/Desktop/pharmacie-samples-v2/ 2>/dev/null', { stdio: 'inherit' });
  console.log('\nAll outputs in /tmp/sample2-*.jpg and ~/Desktop/pharmacie-samples-v2/');
}
main();
