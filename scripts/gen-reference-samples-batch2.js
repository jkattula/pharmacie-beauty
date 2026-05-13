/**
 * 5 more samples spanning clinical/luxury/medical brands to validate the
 * pipeline holds across the catalog before scaling.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const KEY = process.env.GEMINI_API_KEY;
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${KEY}`;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

const BACKGROUNDS = [
  'a polished white Carrara marble shelf with subtle gray veining, soft side window light casting an elegant diagonal shadow',
  'a warm beige travertine pedestal with subtle natural texture, golden-hour side lighting, premium editorial drop shadow',
  'a brushed brass tray on cream silk, soft directional spa lighting, gentle shadow',
  'a deep ivory boucle fabric textured surface, soft warm directional light, elegant cast shadow',
  'a polished pale onyx slab with subtle natural veining, soft natural light, deep editorial shadow',
  'a smooth concrete pedestal in cream tones, single dried botanical sprig out of focus, soft side lighting',
  'a champagne velvet draped surface, soft golden light, premium luxury feel',
];

const SAMPLES = [
  {
    brand: 'Avène', product: 'Eau Thermale Spring Water Spray',
    page: 'https://www.dermstore.com/p/avene-thermal-spring-water-10.1oz/11286360/',
    extra: 'Tall slim pale-blue and white aerosol can with the Avène wordmark — render as a polished aluminum aerosol can, not plastic.',
  },
  {
    brand: 'La Roche-Posay', product: 'Cicaplast Baume B5',
    page: 'https://www.target.com/p/la-roche-posay-cicaplast-balm-vitamin-b5-soothing-therapeutic-cream-for-dry-skin-and-irritated-skin-unscented-1-35oz/-/A-50009971',
    extra: 'White soft tube with green band — render the clinical pharmacy aesthetic with crisp label.',
  },
  {
    brand: 'Bioderma', product: 'Sensibio H2O Micellar Water',
    page: 'https://www.target.com/p/bioderma-sensibio-h2o-micellar-water-makeup-remover-16-7oz/-/A-81819850',
    extra: 'Tall slim bottle with pink screw cap and white-pink label — the iconic Bioderma Sensibio pink theme.',
  },
  {
    brand: 'Filorga', product: 'Time-Filler 5XP Cream',
    page: 'https://www.dermstore.com/p/laboratoires-filorga-time-filler-5xp-cream-clean-50ml/15644915/',
    extra: 'Soft white tube with the bold black FILORGA wordmark — clinical luxury anti-aging feel.',
  },
];

async function fetchHtml(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.text();
}
function extractOgImage(html) {
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return og ? og[1] : null;
}
async function fetchImage(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return { buf: Buffer.from(await r.arrayBuffer()), mime: (r.headers.get('content-type') || 'image/jpeg').split(';')[0].trim() };
}
function padReference(srcPath) {
  const out = srcPath.replace(/\.[^.]+$/, '-padded.jpg');
  execSync(`sips -Z 1280 "${srcPath}" --out "${out}" >/dev/null 2>&1`);
  execSync(`sips -p 1600 1280 --padColor F4F0EA "${out}" --out "${out}" >/dev/null 2>&1`);
  return out;
}
async function restyle(refBuf, brand, product, bg, extra) {
  const prompt = `This is a photograph of ${brand} ${product}. Recreate this exact product — preserve all packaging shape, materials, colors, labels, brand wordmark, and every piece of typography EXACTLY as shown in the input image. ${extra} Place the product on ${bg}. Single product, fills the vertical center prominently. Photorealistic 8k product photography, magazine editorial style, premium luxury aesthetic, deep elegant drop shadow. No text added, no people, no hands. Output a 4:5 portrait composition.`;
  const body = {
    contents: [{ parts: [
      { text: prompt },
      { inline_data: { mime_type: 'image/jpeg', data: refBuf.toString('base64') } },
    ]}],
    generationConfig: { responseModalities: ['IMAGE'] },
  };
  const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`nano HTTP ${r.status}`);
  const data = await r.json();
  const img = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!img) throw new Error('no image');
  return Buffer.from(img.inlineData.data, 'base64');
}
function slug(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''); }

(async () => {
  for (let i = 0; i < SAMPLES.length; i++) {
    const s = SAMPLES[i];
    const bg = BACKGROUNDS[i % BACKGROUNDS.length];
    const fn = `sample5-${slug(s.brand)}_${slug(s.product)}.jpg`;
    process.stdout.write(`${s.brand} | ${s.product} ... `);
    try {
      const html = await fetchHtml(s.page);
      const ogUrl = extractOgImage(html);
      if (!ogUrl) throw new Error('no og:image');
      const { buf, mime } = await fetchImage(ogUrl);
      const rawPath = `/tmp/raw5-${slug(s.brand)}_${slug(s.product)}.${mime.split('/')[1]}`;
      fs.writeFileSync(rawPath, buf);
      const paddedPath = padReference(rawPath);
      const paddedBuf = fs.readFileSync(paddedPath);
      const out = await restyle(paddedBuf, s.brand, s.product, bg, s.extra);
      const pngTmp = `/tmp/${fn.replace(/\.jpg$/, '.png')}`;
      const outJpg = `/tmp/${fn}`;
      fs.writeFileSync(pngTmp, out);
      execSync(`sips -s format jpeg -s formatOptions 92 "${pngTmp}" --out "${outJpg}" >/dev/null 2>&1`);
      fs.unlinkSync(pngTmp);
      const dims = execSync(`sips -g pixelWidth -g pixelHeight "${outJpg}"`).toString().match(/pixelWidth: (\d+)\s+\S+\s+pixelHeight: (\d+)/);
      // Also save the raw reference for comparison
      execSync(`cp "${rawPath}" /tmp/sample5ref-${slug(s.brand)}_${slug(s.product)}.${mime.split('/')[1]}`);
      console.log(`OK ${(fs.statSync(outJpg).size/1024).toFixed(0)}KB ${dims ? dims[1]+'x'+dims[2] : '?'}`);
    } catch (e) { console.log(`FAIL ${e.message}`); }
  }
  execSync('cp /tmp/sample5-*.jpg /tmp/sample5ref-*.* /Users/jenniferkattula/Desktop/pharmacie-samples-v2/ 2>/dev/null', { stdio: 'inherit' });
  console.log('\nDone.');
})();
