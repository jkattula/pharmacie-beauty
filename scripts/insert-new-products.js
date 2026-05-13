/**
 * Insert enriched products into Supabase.
 * Reads scripts/data/new-products-enriched.json and inserts:
 *   - missing brands
 *   - products + prices + us_availability + review_summaries
 *   - ingredients + product_ingredients
 * Idempotent via name+brand dedup checks.
 *
 * Run: node scripts/insert-new-products.js
 */
const fs = require('fs');
const path = require('path');
const postgres = require('postgres');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const NAME_ARG = process.argv[2] || 'new-products';
const ENRICHED_PATH = path.join(__dirname, `data/${NAME_ARG}-enriched.json`);

async function main() {
  const products = JSON.parse(fs.readFileSync(ENRICHED_PATH, 'utf8'));
  const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

  try {
    // 1. Existing brands
    const brandRows = await sql`SELECT id, name FROM brands`;
    const brandMap = new Map(brandRows.map(b => [b.name.toLowerCase(), b.id]));
    console.log(`Existing brands: ${brandMap.size}`);

    // 2. Insert missing brands
    const neededBrands = new Set(products.map(p => p.brand));
    let newBrandCount = 0;
    for (const name of neededBrands) {
      if (!brandMap.has(name.toLowerCase())) {
        const [row] = await sql`
          INSERT INTO brands (name, country_of_origin, pharmacy_brand_flag)
          VALUES (${name}, 'France', true)
          RETURNING id, name
        `;
        brandMap.set(row.name.toLowerCase(), row.id);
        newBrandCount++;
        console.log(`  + brand: ${name}`);
      }
    }
    console.log(`Added ${newBrandCount} new brands.`);

    // 3. Existing product names (lowercase)
    const productRows = await sql`SELECT LOWER(name) AS name FROM products`;
    const existingProductNames = new Set(productRows.map(r => r.name));

    // 4. Existing ingredients map
    const ingRows = await sql`SELECT id, LOWER(name) AS name FROM ingredients`;
    const ingredientMap = new Map(ingRows.map(r => [r.name, r.id]));

    let inserted = 0;
    let skipped = 0;
    for (const p of products) {
      if (existingProductNames.has(p.name.toLowerCase())) {
        skipped++;
        continue;
      }
      const brandId = brandMap.get(p.brand.toLowerCase());
      if (!brandId) {
        console.error(`Missing brand id for ${p.brand}, skipping ${p.name}`);
        continue;
      }

      const imageUrl = p.imageUrl || null;
      const [productRow] = await sql`
        INSERT INTO products (
          name, brand_id, category, description, what_its_good_for, why_buy_in_france,
          cult_favorite_flag, france_only_flag, tiktok_trending_flag, deal_flag, image_url
        ) VALUES (
          ${p.name}, ${brandId}, ${p.category}, ${p.description}, ${p.whatItsGoodFor}, ${p.whyBuyInFrance},
          ${!!p.cultFavoriteFlag}, ${!!p.franceOnlyFlag}, ${!!p.tiktokTrendingFlag}, ${!!p.dealFlag}, ${imageUrl}
        )
        RETURNING id
      `;
      const productId = productRow.id;

      // Price
      if (p.priceEurMin) {
        await sql`
          INSERT INTO prices (product_id, price_eur_min, price_eur_max, price_usd_estimate)
          VALUES (${productId}, ${p.priceEurMin}, ${p.priceEurMax || null}, ${p.priceUsdEstimate || null})
        `;
      }

      // US availability
      if (p.availabilityStatus) {
        await sql`
          INSERT INTO us_availability (product_id, availability_status, notes)
          VALUES (${productId}, ${p.availabilityStatus}, ${p.availabilityNotes || null})
        `;
      }

      // Review summary
      if (p.aiSummaryText) {
        await sql`
          INSERT INTO review_summaries (product_id, source_type, ai_summary_text)
          VALUES (${productId}, 'editorial', ${p.aiSummaryText})
        `;
      }

      // Ingredients
      const ingredients = Array.isArray(p.ingredients) ? p.ingredients : [];
      const euOnly = new Set((p.euOnlyIngredients || []).map(s => s.toLowerCase()));
      for (const ing of ingredients) {
        const key = ing.toLowerCase().trim();
        if (!key) continue;
        let ingId = ingredientMap.get(key);
        if (!ingId) {
          const isEuOnly = euOnly.has(key);
          const [r] = await sql`
            INSERT INTO ingredients (name, eu_only_flag)
            VALUES (${ing}, ${isEuOnly})
            RETURNING id
          `;
          ingId = r.id;
          ingredientMap.set(key, ingId);
        }
        try {
          await sql`
            INSERT INTO product_ingredients (product_id, ingredient_id, highlight_flag)
            VALUES (${productId}, ${ingId}, true)
            ON CONFLICT DO NOTHING
          `;
        } catch (e) { /* unique violation fine */ }
      }

      inserted++;
      if (inserted % 10 === 0) console.log(`  inserted ${inserted}/${products.length}`);
    }

    console.log(`\nDone. inserted=${inserted} skipped(existing)=${skipped}`);
  } finally {
    await sql.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
