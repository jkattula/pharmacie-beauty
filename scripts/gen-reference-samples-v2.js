/**
 * V2: tighter framing + premium editorial backgrounds.
 * Re-rolls only the products the user flagged for improvement.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const KEY = process.env.GEMINI_API_KEY;
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${KEY}`;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

const SAMPLES = [
  {
    brand: 'Weleda', product: 'Skin Food Original',
    page: 'https://www.weleda.com/product/skin-food-original-ultra-rich-cream-g009398',
    bg: 'a polished Carrara marble shelf with subtle gray veining, a softly blurred linen drape in the background, soft side light from a tall window casting a long elegant shadow',
    extra: 'The tube is a metal aluminum tube — render it with the soft metallic sheen of brushed aluminum, not plastic.',
  },
  {
    brand: 'Marvis', product: 'Strong Mint Toothpaste',
    page: 'https://www.marvis.com/en/toothpastes/classic-strong/',
    bg: 'a deep ivory boucle fabric textured surface with a single brass tray edge faintly visible, soft directional warm light',
    extra: 'The product must fill at least 70% of the vertical frame — close, intimate, editorial scale. Strong soft drop shadow.',
  },
  {
    brand: 'Caudalie', product: 'Beauty Elixir Face Mist',
    page: 'https://us.caudalie.com/p/319C/319c-beauty-elixir-prep-set-glow-face-mist.html',
    bg: 'a cream-toned travertine pedestal with subtle natural texture, a deep editorial drop shadow cast diagonally to the right, soft golden-hour side lighting',
    extra: 'Editorial luxury magazine product shot. Deep elegant shadow, premium feel.',
  },
  {
    brand: 'Eucerin', product: 'Replenishing Skin Relief Face Cream with 5% Urea',
    page: 'https://www.walmart.com/ip/Eucerin-Dry-Skin-Replenishing-Face-Cream-Night-5-Urea-With-Lactate-50Ml/793440287',
    bg: 'a brushed brass tray resting on cream silk, soft directional spa lighting from the left, gentle drop shadow',
    extra: 'Premium dermatological-luxury feel. Product fills 65% of frame vertically.',
  },
  {
    brand: 'Roger & Gallet', product: "Bois d'Orange Eau Fraiche",
    page: 'https://us.roger-gallet.com/Product/orange-wood-wellbeing-fragrant-water-1-oz',
    bg: 'a warm beige onyx stone slab with subtle natural veining, soft golden-hour light from the left, a single dried orange-blossom branch out of focus in the background',
    extra: 'Belle Époque luxury fragrance shoot, deep editorial shadow.',
  },
];

async function fetchHtml(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' }, redirect: 'follow' });
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
async function restyle(refBuf, refMime, brand, product, bg, extra) {
  const prompt = `This is a photograph of ${brand} ${product}. Recreate this exact product — preserve all packaging shape, materials, colors, labels, brand wordmark, and every piece of typography EXACTLY as shown in the input image. ${extra} Place the product on ${bg}. The product should fill the vertical center of the frame prominently — close, intimate, editorial scale. Single product. Photorealistic 8k product photography, magazine editorial style, premium luxury aesthetic, deep elegant drop shadow, soft directional natural light. No text added, no people, no hands. --ar 4:5`;
  const body = {
    contents: [{ parts: [
      { text: prompt },
      { inline_data: { mime_type: refMime, data: refBuf.toString('base64') } },
    ]}],
    generationConfig: { responseModalities: ['IMAGE'] },
  };
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`nano HTTP ${r.status}`);
  const data = await r.json();
  const img = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!img) throw new Error('no image');
  return Buffer.from(img.inlineData.data, 'base64');
}
function slug(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''); }

(async () => {
  for (const s of SAMPLES) {
    const fn = `sample3-${slug(s.brand)}_${slug(s.product)}.jpg`;
    process.stdout.write(`${s.brand} | ${s.product} ... `);
    try {
      const html = await fetchHtml(s.page);
      const ogUrl = extractOgImage(html);
      if (!ogUrl) throw new Error('no og:image');
      const { buf, mime } = await fetchImage(ogUrl);
      const out = await restyle(buf, mime, s.brand, s.product, s.bg, s.extra);
      const pngTmp = `/tmp/${fn.replace(/\.jpg$/, '.png')}`;
      const outJpg = `/tmp/${fn}`;
      fs.writeFileSync(pngTmp, out);
      execSync(`sips -s format jpeg -s formatOptions 92 "${pngTmp}" --out "${outJpg}" >/dev/null 2>&1`);
      fs.unlinkSync(pngTmp);
      console.log(`OK ${(fs.statSync(outJpg).size/1024).toFixed(0)}KB`);
    } catch (e) { console.log(`FAIL ${e.message}`); }
  }
  execSync('cp /tmp/sample3-*.jpg /Users/jenniferkattula/Desktop/pharmacie-samples-v2/ 2>/dev/null', { stdio: 'inherit' });
  console.log('\nSaved to /tmp/ and ~/Desktop/pharmacie-samples-v2/');
})();
