/**
 * Scrape real product photos for AI-only products.
 * Tries multiple sources in order; picks the first og:image found.
 *
 * Sources:
 *  1. DuckDuckGo HTML search (free, no key)
 *  2. Direct brand domains (best when known)
 *  3. Bing Image Search HTML (fallback)
 *
 * Saves the original image to public/images/products/{filename} (overwrites AI version).
 *
 * Run: node scripts/scrape-real-images.js              # all 130 ai-only
 *      node scripts/scrape-real-images.js <productId>  # one
 */
const fs = require('fs');
const path = require('path');
const postgres = require('postgres');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const PUBLIC_DIR = path.join(__dirname, '../public/images/products');
const REPORT = path.join(__dirname, 'data/scrape-report.json');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchHtml(url) {
  const r = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
    },
    redirect: 'follow',
  });
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
  return await r.text();
}

async function downloadImage(url, outPath) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': new URL(url).origin } });
  if (!r.ok) throw new Error(`download HTTP ${r.status}`);
  const ct = r.headers.get('content-type') || '';
  if (!ct.startsWith('image/')) throw new Error(`not an image: ${ct}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 5_000) throw new Error(`image too small (${buf.length} bytes)`);
  fs.writeFileSync(outPath, buf);
  return buf.length;
}

function extractOgImage(html) {
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return og?.[1];
}

function extractFirstResultLink(html, hostMatch) {
  // DuckDuckGo HTML results have <a class="result__url" href="...">
  const matches = [...html.matchAll(/<a[^>]+class="result__url"[^>]+href="([^"]+)"/g)];
  for (const m of matches) {
    let url = m[1];
    if (url.startsWith('//duckduckgo.com/l/?uddg=')) {
      try { url = decodeURIComponent(url.split('uddg=')[1].split('&')[0]); } catch {}
    } else if (url.startsWith('//')) {
      url = 'https:' + url;
    }
    if (!hostMatch || hostMatch.test(url)) return url;
  }
  return null;
}

// Sources that tend to have good og:image and work without auth/captcha.
// Order matters — best signal first.
const SOURCE_HOSTS = [
  /target\.com/, /dermstore\.com/, /sephora\.com/, /credobeauty\.com/,
  /amazon\.com\/dp/, /ulta\.com/, /walmart\.com/,
  /weleda\.com/, /caudalie\.com/, /laroche-posay\.us/, /labioderma\./,
  /eucerinus\.com/, /eucerin\.com/, /mustela\.us/, /mustela\.com/,
  /vichyusa\.com/, /vichy-online\./, /klorane\.com/, /nuxe\./,
  /avene\./, /uriage\./, /filorga\./, /ducray\./, /lierac\./,
  /cocooncenter\.com/, /1001pharmacies\.com/, /soin-et-nature\./,
  /pharma-gdd\.com/, /citypharma\./, /parapharmacie-lafayette\./,
  /1001pharmacies\.com/,
];

async function ddgFindUrl(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const html = await fetchHtml(url);
  for (const hostRe of SOURCE_HOSTS) {
    const link = extractFirstResultLink(html, hostRe);
    if (link) return link;
  }
  return extractFirstResultLink(html);
}

async function bingFindUrl(query) {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
  const html = await fetchHtml(url);
  // Bing uses <h2><a href="...">...</a></h2> for organic results
  const matches = [...html.matchAll(/<h2><a[^>]+href="(https?:\/\/[^"]+)"/g)];
  const urls = matches.map(m => m[1]);
  for (const hostRe of SOURCE_HOSTS) {
    const found = urls.find(u => hostRe.test(u));
    if (found) return found;
  }
  return urls[0] || null;
}

async function braveFindUrl(query) {
  const url = `https://search.brave.com/search?q=${encodeURIComponent(query)}`;
  const html = await fetchHtml(url);
  const matches = [...html.matchAll(/<a[^>]+class="[^"]*result[^"]*"[^>]+href="(https?:\/\/[^"]+)"/gi)];
  const urls = matches.map(m => m[1]);
  for (const hostRe of SOURCE_HOSTS) {
    const found = urls.find(u => hostRe.test(u));
    if (found) return found;
  }
  return urls[0] || null;
}

// Direct retailer search → first product page URL
async function targetSearchUrl(query) {
  const url = `https://www.target.com/s?searchTerm=${encodeURIComponent(query)}`;
  const html = await fetchHtml(url);
  // Match product detail page links: /p/.../-/A-{id}
  const m = html.match(/"(\/p\/[^"]+\/-\/A-\d+)"/);
  return m ? `https://www.target.com${m[1]}` : null;
}

async function dermstoreSearchUrl(query) {
  const url = `https://www.dermstore.com/searchresult?q=${encodeURIComponent(query)}`;
  const html = await fetchHtml(url);
  // Match product page links
  const m = html.match(/href="(\/[a-z0-9_-]+\/\d+)"/i);
  return m ? `https://www.dermstore.com${m[1]}` : null;
}

async function ultaSearchUrl(query) {
  const url = `https://www.ulta.com/shop/search?Ntt=${encodeURIComponent(query)}`;
  const html = await fetchHtml(url);
  const m = html.match(/href="(\/p\/[^"]+pimprod\d+)"/i);
  return m ? `https://www.ulta.com${m[1]}` : null;
}

async function findImageForProduct(p) {
  const queries = [
    `${p.brand} ${p.name}`,
    `"${p.brand}" "${p.name}"`,
  ];

  // Strategy: try search engines (most reliable) then direct retailer search as fallback.
  const searchers = [
    { name: 'bing', fn: bingFindUrl },
    { name: 'brave', fn: braveFindUrl },
    { name: 'ddg', fn: ddgFindUrl },
    { name: 'target', fn: targetSearchUrl },
    { name: 'dermstore', fn: dermstoreSearchUrl },
    { name: 'ulta', fn: ultaSearchUrl },
  ];

  for (const q of queries) {
    for (const s of searchers) {
      let pageUrl;
      try { pageUrl = await s.fn(q); }
      catch (e) { continue; }
      if (!pageUrl) continue;
      let html;
      try { html = await fetchHtml(pageUrl); }
      catch { continue; }
      const og = extractOgImage(html);
      if (!og) continue;
      return { pageUrl, imageUrl: og.startsWith('//') ? 'https:' + og : og, via: s.name };
    }
  }
  return null;
}

async function processOne(p) {
  const filename = path.basename(p.image_url);
  const outPath = path.join(PUBLIC_DIR, filename);
  const found = await findImageForProduct(p);
  if (!found) return { ok: false, reason: 'no_image_found' };
  try {
    const size = await downloadImage(found.imageUrl, outPath);
    return { ok: true, size, source: found.pageUrl, image: found.imageUrl };
  } catch (e) {
    return { ok: false, reason: `download_failed: ${e.message}`, source: found.pageUrl, image: found.imageUrl };
  }
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
  let products;
  try {
    const arg = process.argv[2];
    if (arg) {
      products = await sql`
        SELECT p.id, p.name, p.image_url, b.name AS brand
        FROM products p JOIN brands b ON b.id = p.brand_id
        WHERE p.id = ${arg}
      `;
    } else {
      products = await sql`
        SELECT p.id, p.name, p.image_url, b.name AS brand
        FROM products p JOIN brands b ON b.id = p.brand_id
        WHERE p.image_url LIKE '/images/products/%'
        ORDER BY b.name, p.name
      `;
    }
  } finally { await sql.end(); }

  console.log(`Scraping ${products.length} products...`);
  const report = fs.existsSync(REPORT) ? JSON.parse(fs.readFileSync(REPORT, 'utf8')) : [];
  const doneIds = new Set(report.filter(r => r.ok).map(r => r.id));

  let ok = 0, fail = 0;
  let idx = 0;
  const concurrency = 4;
  async function worker() {
    while (idx < products.length) {
      const myIdx = idx++;
      const p = products[myIdx];
      if (doneIds.has(p.id)) { ok++; continue; }
      try {
        const r = await processOne(p);
        report.push({ id: p.id, brand: p.brand, name: p.name, ...r });
        if (r.ok) {
          ok++;
          console.log(`  [${myIdx + 1}/${products.length}] ✓ ${p.brand} - ${p.name} (${r.size}b ${new URL(r.source).host})`);
        } else {
          fail++;
          console.log(`  [${myIdx + 1}/${products.length}] ✗ ${p.brand} - ${p.name} — ${r.reason}`);
        }
      } catch (e) {
        fail++;
        console.error(`  [${myIdx + 1}/${products.length}] ✗ ${p.brand} - ${p.name}: ${e.message}`);
        report.push({ id: p.id, brand: p.brand, name: p.name, ok: false, reason: e.message });
      }
      fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
      await sleep(1000);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  console.log(`\nDone. ok=${ok} fail=${fail}`);
  console.log(`Report: ${REPORT}`);
}
main().catch(e => { console.error(e); process.exit(1); });
