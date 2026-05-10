/**
 * Populate shop_retailer + shop_url for every product.
 * Uses retailer SEARCH URLs (always-stable, never 404) keyed by brand.
 *
 * Run: node scripts/populate-shop-links.js
 */
const path = require('path');
const postgres = require('postgres');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Brand → preferred retailer.
// Picked based on which US/global retailer most reliably carries the brand.
const BRAND_RETAILER = {
  // Sephora — luxury / heavily-marketed
  'Caudalie': 'sephora',
  'Clarins': 'sephora',
  'Nuxe': 'sephora',
  'Filorga': 'sephora',
  'By Terry': 'sephora',
  'Darphin': 'sephora',
  'Talika': 'sephora',
  'Drunk Elephant': 'sephora',
  'Tatcha': 'sephora',

  // Target — mass-market US distribution
  'La Roche-Posay': 'target',
  'Vichy': 'target',
  'Mustela': 'target',
  'Eucerin': 'target',
  'Klorane': 'target',
  'Biafine': 'target',
  'Voltaren': 'target',
  'Weleda': 'target',
  'CeraVe': 'target',

  // Dermstore — derm/salon-grade
  'René Furterer': 'dermstore',
  'Phyto': 'dermstore',
  'Christophe Robin': 'dermstore',
  'Institut Esthederm': 'dermstore',
  'Payot': 'dermstore',
  'A-Derma': 'dermstore',
  'Avène': 'dermstore',
  'Lierac': 'dermstore',
  'Galenic': 'dermstore',

  // Amazon — niche / import / fragmented distribution
  'Embryolisse': 'amazon',
  'Bioderma': 'amazon',
  'SVR': 'amazon',
  'Ducray': 'amazon',
  'Topicrem': 'amazon',
  'Uriage': 'amazon',
  'Hexomedine': 'amazon',
  'Boiron': 'amazon',
  'Ialuset': 'amazon',
  'Roger & Gallet': 'amazon',
  'Cattier': 'amazon',
  'Melvita': 'amazon',
  'Marvis': 'amazon',
  'Puressentiel': 'amazon',
  'Manucurist': 'amazon',
  'Garancia': 'amazon',
  'Sanoflore': 'amazon',
  'Noreva': 'amazon',
  'Patyka': 'amazon',
  'Panier des Sens': 'amazon',
  'Apivita': 'amazon',
  'Cosmetics 27': 'amazon',
  'La Rosée': 'amazon',
  'Mediceutics': 'amazon',
  'Yon-Ka': 'amazon',
  'Biotherm': 'amazon',
  'Biologique Recherche': 'amazon',
};

const RETAILER_LABEL = {
  sephora: 'Sephora',
  target: 'Target',
  amazon: 'Amazon',
  dermstore: 'Dermstore',
  ulta: 'Ulta',
  notino: 'Notino',
  credo: 'Credo Beauty',
};

function searchUrl(retailer, brand, name) {
  const q = encodeURIComponent(`${brand} ${name}`);
  switch (retailer) {
    case 'sephora':   return `https://www.sephora.com/search?keyword=${q}`;
    case 'target':    return `https://www.target.com/s?searchTerm=${q}`;
    case 'amazon':    return `https://www.amazon.com/s?k=${q}`;
    case 'dermstore': return `https://www.dermstore.com/searchresult?q=${q}`;
    case 'ulta':      return `https://www.ulta.com/shop/search?Ntt=${q}`;
    case 'notino':    return `https://us.notino.com/search/?q=${q}`;
    case 'credo':     return `https://credobeauty.com/search?type=product&q=${q}`;
    default:          return `https://www.amazon.com/s?k=${q}`;
  }
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
  try {
    const rows = await sql`
      SELECT p.id, p.name, b.name AS brand
      FROM products p JOIN brands b ON b.id = p.brand_id
      ORDER BY b.name, p.name
    `;
    console.log(`Populating shop links for ${rows.length} products...`);

    const unmapped = new Set();
    let updated = 0;
    for (const r of rows) {
      const retailerKey = BRAND_RETAILER[r.brand] || 'amazon'; // safe fallback
      if (!BRAND_RETAILER[r.brand]) unmapped.add(r.brand);
      const url = searchUrl(retailerKey, r.brand, r.name);
      const label = RETAILER_LABEL[retailerKey];
      await sql`
        UPDATE products
        SET shop_retailer = ${label}, shop_url = ${url}
        WHERE id = ${r.id}
      `;
      updated++;
      if (updated % 50 === 0) console.log(`  updated ${updated}/${rows.length}`);
    }

    console.log(`\nDone. updated=${updated}`);
    if (unmapped.size) {
      console.log(`\nBrands defaulted to Amazon (no explicit mapping):`);
      [...unmapped].sort().forEach(b => console.log(`  ${b}`));
    }

    // Quick sanity-check: counts per retailer
    const summary = await sql`
      SELECT shop_retailer, COUNT(*) AS n
      FROM products
      GROUP BY shop_retailer
      ORDER BY n DESC
    `;
    console.log(`\nProducts per retailer:`);
    summary.forEach(s => console.log(`  ${s.shop_retailer}: ${s.n}`));
  } finally {
    await sql.end();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
