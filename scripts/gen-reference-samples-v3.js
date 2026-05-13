/**
 * V3: pre-pad reference images to a square 1024x1024 cream-background canvas
 * before sending to Nano Banana, so output stays at the right aspect ratio.
 * Also: Eucerin tube-only.
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
    brand: 'Marvis', product: 'Strong Mint Toothpaste',
    page: 'https://www.marvis.com/en/toothpastes/classic-strong/',
    bg: 'a deep ivory boucle fabric textured surface with a single brass tray edge faintly visible, soft directional warm light',
    extra: 'Tight editorial crop — product fills 70% of vertical frame. Strong soft drop shadow.',
  },
  {
    brand: 'Eucerin', product: 'Replenishing Skin Relief Face Cream with 5% Urea',
    page: 'https://www.walmart.com/ip/Eucerin-Dry-Skin-Replenishing-Face-Cream-Night-5-Urea-With-Lactate-50Ml/793440287',
    bg: 'a brushed brass tray resting on cream silk, soft directional spa lighting from the left, gentle drop shadow',
    extra: 'Render ONLY the white tube — do NOT include the carton box. Premium dermatological-luxury feel. Tube fills 65% of frame vertically.',
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

// Pre-pad reference to a 4:5 (or wider) cream-background canvas via sips
function padReference(srcPath) {
  // sips can pad: -p HEIGHT WIDTH --padColor F4F0EA
  const out = srcPath.replace(/\.[^.]+$/, '-padded.jpg');
  // Resize so the longer side is 1280, then pad to 1280x1600 (4:5)
  execSync(`sips -Z 1280 "${srcPath}" --out "${out}" >/dev/null 2>&1`);
  execSync(`sips -p 1600 1280 --padColor F4F0EA "${out}" --out "${out}" >/dev/null 2>&1`);
  return out;
}

async function restyle(refBuf, refMime, brand, product, bg, extra) {
  const prompt = `This is a photograph of ${brand} ${product}. Recreate this exact product — preserve all packaging shape, materials, colors, labels, brand wordmark, and every piece of typography EXACTLY as shown in the input image. ${extra} Place the product on ${bg}. Single product. Photorealistic 8k product photography, magazine editorial style, premium luxury aesthetic, deep elegant drop shadow, soft directional natural light. No text added, no people, no hands. Output a 4:5 portrait composition.`;
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
    const fn = `sample4-${slug(s.brand)}_${slug(s.product)}.jpg`;
    process.stdout.write(`${s.brand} | ${s.product} ... `);
    try {
      const html = await fetchHtml(s.page);
      const ogUrl = extractOgImage(html);
      if (!ogUrl) throw new Error('no og:image');
      const { buf, mime } = await fetchImage(ogUrl);
      // Save raw, then pad to 4:5
      const rawPath = `/tmp/raw-${slug(s.brand)}_${slug(s.product)}.${mime.split('/')[1]}`;
      fs.writeFileSync(rawPath, buf);
      const paddedPath = padReference(rawPath);
      const paddedBuf = fs.readFileSync(paddedPath);

      const out = await restyle(paddedBuf, 'image/jpeg', s.brand, s.product, s.bg, s.extra);
      const pngTmp = `/tmp/${fn.replace(/\.jpg$/, '.png')}`;
      const outJpg = `/tmp/${fn}`;
      fs.writeFileSync(pngTmp, out);
      execSync(`sips -s format jpeg -s formatOptions 92 "${pngTmp}" --out "${outJpg}" >/dev/null 2>&1`);
      fs.unlinkSync(pngTmp);
      const dims = execSync(`sips -g pixelWidth -g pixelHeight "${outJpg}"`).toString().match(/pixelWidth: (\d+)\s+\S+\s+pixelHeight: (\d+)/);
      console.log(`OK ${(fs.statSync(outJpg).size/1024).toFixed(0)}KB  ${dims ? dims[1]+'x'+dims[2] : '?'}`);
    } catch (e) { console.log(`FAIL ${e.message}`); }
  }
  execSync('cp /tmp/sample4-*.jpg /Users/jenniferkattula/Desktop/pharmacie-samples-v2/ 2>/dev/null', { stdio: 'inherit' });
  console.log('\nSaved.');
})();
