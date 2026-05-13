/**
 * Regenerate every product image using the validated image-to-image pipeline:
 *
 *   1. Find a retailer URL (use products.shop_url if present, else ask
 *      GPT-4o-mini for 3 likely URLs and try each)
 *   2. Fetch the page, extract og:image
 *   3. Pre-pad the reference photo to a 4:5 cream canvas
 *   4. Nano Banana image-to-image with a premium-editorial restyle prompt
 *      + per-product packaging hint
 *   5. Convert to JPG, save to public/images/products, update products.image_url
 *
 * Idempotent — skips products whose target filename already has a >100KB
 * "v2-quality" file (recorded in scripts/data/i2i-log.json).
 *
 * Run: node scripts/regen-all-images-i2i.js              (full run)
 *      node scripts/regen-all-images-i2i.js --limit=20   (smoke test)
 *      node scripts/regen-all-images-i2i.js --resume     (skip products in log)
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const postgres = require('postgres');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const NANO_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_KEY}`;
const OUT_DIR = path.join(__dirname, '../public/images/products');
const LOG_FILE = path.join(__dirname, 'data/i2i-log.json');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

const LIMIT = (() => { const a = process.argv.find(x => x.startsWith('--limit=')); return a ? parseInt(a.split('=')[1]) : null; })();
const RESUME = process.argv.includes('--resume');

const BACKGROUNDS = [
  'a polished white Carrara marble shelf with subtle gray veining, soft side window light casting an elegant diagonal shadow',
  'a warm beige travertine pedestal with subtle natural texture, golden-hour side lighting, premium editorial drop shadow',
  'a brushed brass tray on cream silk, soft directional spa lighting, gentle shadow',
  'a deep ivory boucle fabric textured surface, soft warm directional light, elegant cast shadow',
  'a polished pale onyx slab with subtle natural veining, soft natural light, deep editorial shadow',
  'a smooth concrete pedestal in cream tones, single dried botanical sprig out of focus, soft side lighting',
  'a champagne velvet draped surface, soft golden light, premium luxury feel',
  'a pale oak wood vanity surface, soft cool morning window light, minimal styling, premium editorial shadow',
  'a cream-colored linen cloth backdrop, soft warm directional lighting, elegant drop shadow',
  'a soft pink alabaster pedestal, soft natural light, premium luxury feel',
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

const ALLOWED_DOMAINS = /(target|dermstore|walmart|ulta|sephora|amazon|caudalie|weleda|nuxe|marvis|aderma|aveneusa|laroche|bioderma|lierac|filorga|clarins|vichy|rogergallet|roger-gallet|apivita|melvita|cattier|embryolisse|mustela|biotherm|topicrem|svr|uriage|eucerin|talika|patyka|christophe-?robin|panier|garancia|by-?terry|darphin|ducray|klorane|noreva|payot|phyto|puressentiel|rene-?furterer|sanoflore|voltaren|hexomedine|biafine|cosmetics-?27|galenic|ialuset|la-?rosee|manucurist|mediceutics|yonka|yon-?ka|caswell|escentual|amazonaws|imgix|target\.scene7|walmartimages|naos|nuxe-?americas|caudalie-?americas)/i;

async function searchOnce(query) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini-search-preview',
      messages: [{ role: 'user', content: query }],
    }),
  });
  if (!r.ok) throw new Error(`openai HTTP ${r.status}`);
  const data = await r.json();
  const text = data?.choices?.[0]?.message?.content || '';
  const urls = [...text.matchAll(/https?:\/\/[^\s)"\]<>]+/g)]
    .map(m => m[0].replace(/[.,;!?)]+$/, '').replace(/\?utm_source=openai$/, '').replace(/&utm_source=openai$/, ''));
  return [...new Set(urls)].filter(u => ALLOWED_DOMAINS.test(u));
}

async function suggestUrls(brand, product) {
  // Multi-pass search across 3 different query phrasings, combine results.
  // Web search is nondeterministic; multiple passes dramatically improves recall.
  const queries = [
    `Find specific US retailer product pages selling "${brand} ${product}". Prefer: target.com, dermstore.com, walmart.com, ulta.com, brand's official US site. List 3 actual product page URLs (not search pages). Plain URLs, one per line.`,
    `Where can I buy "${brand} ${product}" online in the US? Find direct product page URLs on target.com, dermstore.com, walmart.com, or the brand's site. List URLs only.`,
    `I need a product page URL for "${brand}" "${product}". Search dermstore.com and the brand's official US store. Output the URL(s).`,
  ];
  const all = new Set();
  for (const q of queries) {
    try {
      const urls = await searchOnce(q);
      for (const u of urls) all.add(u);
      if (all.size >= 4) break; // enough candidates
    } catch { /* keep going */ }
  }
  return [...all].slice(0, 6);
}

async function fetchHtml(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow' });
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
  return await r.text();
}

function extractOgImage(html) {
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return og ? og[1] : null;
}

async function fetchImage(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`img HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const mime = (r.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
  if (buf.length < 5000) throw new Error('image too small');
  return { buf, mime };
}

function padReference(srcPath) {
  const out = srcPath.replace(/\.[^.]+$/, '-padded.jpg');
  execSync(`sips -Z 1280 "${srcPath}" --out "${out}" >/dev/null 2>&1`);
  execSync(`sips -p 1600 1280 --padColor F4F0EA "${out}" --out "${out}" >/dev/null 2>&1`);
  return out;
}

async function restyle(refBuf, brand, product, bg) {
  const prompt = `This is a photograph of ${brand} ${product}. Recreate this exact product — preserve all packaging shape, materials, colors, labels, brand wordmark, and every piece of typography EXACTLY as shown in the input image. Place the product on ${bg}. Single product, fills the vertical center prominently. Photorealistic 8k product photography, magazine editorial style, premium luxury aesthetic, deep elegant drop shadow. No text added, no people, no hands. Output a 4:5 portrait composition.`;
  const r = await fetch(NANO_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [
        { text: prompt },
        { inline_data: { mime_type: 'image/jpeg', data: refBuf.toString('base64') } },
      ]}],
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
  });
  if (!r.ok) throw Object.assign(new Error(`nano HTTP ${r.status}: ${(await r.text()).slice(0,150)}`), { status: r.status });
  const data = await r.json();
  const img = data?.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
  if (!img) throw new Error('no image in response');
  return Buffer.from(img.inlineData.data, 'base64');
}

function pageTitleContainsBrand(html, brand) {
  const brandTokens = brand.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter(t => t.length > 2);
  const og = (html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] || '');
  const title = (html.match(/<title>([^<]+)<\/title>/i)?.[1] || '');
  const all = (og + ' ' + title).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  // require at least one brand token of length > 2 to appear
  return brandTokens.some(t => all.includes(t));
}

async function discoverRefImage(brand, product, dbShopUrl) {
  // 1. Try DB shop_url first (already validated upstream)
  const candidateUrls = [];
  if (dbShopUrl) candidateUrls.push(dbShopUrl);
  // 2. Ask gpt-4o-mini-search-preview for 3 more
  try {
    const suggested = await suggestUrls(brand, product);
    candidateUrls.push(...suggested);
  } catch { /* fall through */ }

  for (const url of candidateUrls) {
    try {
      const html = await fetchHtml(url);
      // Validate page is actually about this brand
      if (!pageTitleContainsBrand(html, brand)) continue;
      const ogUrl = extractOgImage(html);
      if (!ogUrl) continue;
      const fullOg = ogUrl.startsWith('http') ? ogUrl : (ogUrl.startsWith('//') ? 'https:' + ogUrl : new URL(ogUrl, url).toString());
      const img = await fetchImage(fullOg);
      return { ref: img, sourceUrl: url, ogUrl: fullOg };
    } catch { continue; }
  }
  return null;
}

async function main() {
  if (!GEMINI_KEY || !OPENAI_KEY) { console.error('Missing API keys'); process.exit(1); }
  if (!fs.existsSync(path.dirname(LOG_FILE))) fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });

  const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 });
  try {
    let rows = await sql`SELECT p.id, p.name, b.name AS brand, p.shop_url FROM products p JOIN brands b ON b.id = p.brand_id ORDER BY b.name, p.name`;
    if (LIMIT) rows = rows.slice(0, LIMIT);

    let log = fs.existsSync(LOG_FILE) ? JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')) : [];
    const doneIds = new Set(log.filter(l => l.ok).map(l => l.id));
    console.log(`${rows.length} products. ${RESUME ? `Resuming (skipping ${doneIds.size} already done).` : ''}`);

    let ok = 0, skip = 0, fail = 0;
    for (let i = 0; i < rows.length; i++) {
      const p = rows[i];
      if (RESUME && doneIds.has(p.id)) { skip++; continue; }
      const filename = `${slug(p.brand)}_${slug(p.name)}.jpg`;
      const outPath = path.join(OUT_DIR, filename);
      const tag = `[${i + 1}/${rows.length}] ${p.brand} | ${p.name.slice(0, 50)}`;

      const bg = BACKGROUNDS[i % BACKGROUNDS.length];
      const rawPath = `/tmp/i2i-raw-${slug(p.brand)}_${slug(p.name)}.jpg`;

      try {
        process.stdout.write(`${tag} ... `);
        const discovered = await discoverRefImage(p.brand, p.name, p.shop_url);
        if (!discovered) throw new Error('no reference found');

        fs.writeFileSync(rawPath, discovered.ref.buf);
        const paddedPath = padReference(rawPath);
        const paddedBuf = fs.readFileSync(paddedPath);

        const out = await restyle(paddedBuf, p.brand, p.name, bg);
        const pngTmp = outPath.replace(/\.jpg$/, '.tmp.png');
        fs.writeFileSync(pngTmp, out);
        execSync(`sips -s format jpeg -s formatOptions 92 "${pngTmp}" --out "${outPath}" >/dev/null 2>&1`);
        fs.unlinkSync(pngTmp);
        try { fs.unlinkSync(rawPath); fs.unlinkSync(paddedPath); } catch {}

        const sz = fs.statSync(outPath).size;
        await sql`UPDATE products SET image_url = ${'/images/products/' + filename} WHERE id = ${p.id}`;
        console.log(`OK ${(sz / 1024).toFixed(0)}KB`);
        log.push({ id: p.id, brand: p.brand, name: p.name, filename, sourceUrl: discovered.sourceUrl, bytes: sz, ok: true, at: new Date().toISOString() });
        ok++;
      } catch (e) {
        console.log(`FAIL ${e.message.slice(0, 80)}`);
        log.push({ id: p.id, brand: p.brand, name: p.name, filename, ok: false, error: e.message.slice(0, 200), at: new Date().toISOString() });
        fail++;
        if (e.status === 429) { console.log('  rate limit — sleep 30s'); await sleep(30_000); }
      }
      if (i % 5 === 4) fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
      await sleep(800);
    }
    fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
    console.log(`\nDone. ok=${ok} skip=${skip} fail=${fail}.  Log: ${LOG_FILE}`);
  } finally {
    await sql.end();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
