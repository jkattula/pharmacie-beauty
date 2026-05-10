/**
 * Replace search-URL shop links with VERIFIED specific product page URLs.
 * For each product:
 *   1. Search DDG for "brand product retailer"
 *   2. Pick first link from a known retailer / brand domain
 *   3. Fetch the page, validate og:title or <title> contains brand AND a product-name token
 *   4. If validated → save URL + retailer label; else NULL out shop fields
 *
 * Run: node scripts/find-specific-product-urls.js
 *      node scripts/find-specific-product-urls.js --resume   (skip products that already have a non-search URL)
 */
const fs = require('fs');
const path = require('path');
const postgres = require('postgres');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const REPORT = path.join(__dirname, 'data/specific-urls-report.json');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

async function fetchHtml(url) {
  const r = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
  });
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
  return await r.text();
}

// Trusted retailer domains we'll accept and the friendly label.
const RETAILERS = [
  { re: /(^|\.)sephora\.com\//, label: 'Sephora', isProductUrl: (u) => /\/product\//.test(u) },
  { re: /(^|\.)target\.com\//, label: 'Target', isProductUrl: (u) => /\/p\/.+\/-\/A-\d+/.test(u) },
  { re: /(^|\.)ulta\.com\//, label: 'Ulta', isProductUrl: (u) => /\/p\/.+pimprod/.test(u) || /\/p\//.test(u) },
  { re: /(^|\.)dermstore\.com\//, label: 'Dermstore', isProductUrl: (u) => /\/(.+)\/\d+\.html?$|\/(.+)\/\d+$/.test(u) },
  { re: /(^|\.)amazon\.com\//, label: 'Amazon', isProductUrl: (u) => /\/dp\/[A-Z0-9]+/.test(u) },
  { re: /(^|\.)credobeauty\.com\//, label: 'Credo Beauty', isProductUrl: (u) => /\/products\//.test(u) },
  { re: /(^|\.)walmart\.com\//, label: 'Walmart', isProductUrl: (u) => /\/ip\//.test(u) },
  { re: /(^|\.)laroche-posay\.us\//, label: 'La Roche-Posay', isProductUrl: (u) => /\/our-products\//.test(u) },
  { re: /(^|\.)caudalie\.com\//, label: 'Caudalie', isProductUrl: (u) => /\/(skincare|product|p)\//.test(u) },
  { re: /(^|\.)vichyusa\.com\//, label: 'Vichy', isProductUrl: (u) => /\/products?\//.test(u) },
  { re: /(^|\.)avene\.us\//, label: 'Avène', isProductUrl: (u) => /\/.+\/.+/.test(u) },
  { re: /(^|\.)bioderma\.com\//, label: 'Bioderma', isProductUrl: (u) => /\/products?\//.test(u) },
  { re: /(^|\.)mustelausa\.com\//, label: 'Mustela', isProductUrl: () => true },
  { re: /(^|\.)mustela\.com\//, label: 'Mustela', isProductUrl: () => true },
  { re: /(^|\.)weleda\.com\//, label: 'Weleda', isProductUrl: (u) => /\/product\//.test(u) },
  { re: /(^|\.)nuxe\.com\//, label: 'Nuxe', isProductUrl: () => true },
  { re: /(^|\.)us\.notino\.com\//, label: 'Notino', isProductUrl: (u) => /\/p\//.test(u) },
];

function extractDdgLinks(html) {
  const links = [];
  const re = /<a[^>]+class="result__url"[^>]+href="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    let u = m[1];
    if (u.startsWith('//duckduckgo.com/l/?uddg=')) {
      try { u = decodeURIComponent(u.split('uddg=')[1].split('&')[0]); } catch {}
    } else if (u.startsWith('//')) {
      u = 'https:' + u;
    }
    links.push(u);
  }
  return links;
}

function extractMetaTitle(html) {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]+name=["']title["'][^>]+content=["']([^"']+)["']/i);
  if (og) return og[1];
  const t = html.match(/<title>([^<]+)<\/title>/i);
  return t?.[1] || '';
}

function tokens(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
}

function validateTitle(title, brand, productName) {
  const t = title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const brandToks = tokens(brand).filter(x => x.length > 2);
  const productToks = tokens(productName).filter(x => x.length > 3);
  const brandHit = brandToks.length === 0 || brandToks.some(b => t.includes(b));
  const productHit = productToks.filter(p => t.includes(p)).length >= Math.min(2, productToks.length);
  return brandHit && productHit;
}

async function ddgSearch(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const html = await fetchHtml(url);
  return extractDdgLinks(html);
}

async function findVerifiedUrl(p) {
  // Try a few query variants
  const queries = [
    `"${p.brand}" "${p.name}" buy site:sephora.com`,
    `"${p.brand}" "${p.name}" buy site:target.com`,
    `"${p.brand}" "${p.name}" buy site:dermstore.com`,
    `"${p.brand}" "${p.name}" buy site:amazon.com`,
    `"${p.brand}" "${p.name}"`,
  ];
  for (const q of queries) {
    let links;
    try { links = await ddgSearch(q); }
    catch (e) { if (e.status === 429) await sleep(15000); continue; }
    for (const u of links.slice(0, 5)) {
      const r = RETAILERS.find(r => r.re.test(u));
      if (!r) continue;
      if (r.isProductUrl && !r.isProductUrl(u)) continue;
      // Fetch + validate
      let html;
      try { html = await fetchHtml(u); } catch { continue; }
      const title = extractMetaTitle(html);
      if (!title) continue;
      if (validateTitle(title, p.brand, p.name)) {
        return { url: u, retailer: r.label, title };
      }
    }
    await sleep(1500);
  }
  return null;
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
  try {
    // Only attempt products that are sold in US AND have either a stale search URL or a previously-found URL
    const products = await sql`
      SELECT p.id, p.name, p.shop_url, b.name AS brand
      FROM products p JOIN brands b ON b.id = p.brand_id
      LEFT JOIN us_availability ua ON ua.product_id = p.id
      WHERE p.shop_url IS NOT NULL
        AND (ua.availability_status IS NULL OR ua.availability_status <> 'not_available')
      ORDER BY b.name, p.name
    `;
    console.log(`Finding verified URLs for ${products.length} products...`);

    let report = fs.existsSync(REPORT) ? JSON.parse(fs.readFileSync(REPORT, 'utf8')) : [];
    const doneIds = new Set(report.map(r => r.id));
    const RESUME = process.argv.includes('--resume');

    let verified = 0, nulled = 0;
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (RESUME && doneIds.has(p.id)) continue;

      let result;
      try {
        result = await findVerifiedUrl(p);
      } catch (e) {
        result = null;
      }

      if (result) {
        await sql`UPDATE products SET shop_url = ${result.url}, shop_retailer = ${result.retailer} WHERE id = ${p.id}`;
        verified++;
        console.log(`  [${i+1}/${products.length}] ✓ ${p.brand} - ${p.name} → ${result.retailer}`);
      } else {
        await sql`UPDATE products SET shop_url = NULL, shop_retailer = NULL WHERE id = ${p.id}`;
        nulled++;
        console.log(`  [${i+1}/${products.length}] ✗ ${p.brand} - ${p.name} (nulled)`);
      }
      report.push({ id: p.id, brand: p.brand, name: p.name, ok: !!result, retailer: result?.retailer, url: result?.url });
      fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
      await sleep(2000);
    }

    console.log(`\nDone. verified=${verified} nulled=${nulled}`);
  } finally {
    await sql.end();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
