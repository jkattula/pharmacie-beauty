// Script to seed the database with product data
const fs = require('fs');
const postgres = require('postgres');

async function seedDatabase() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const sql = postgres(connectionString);

  try {
    // Read the seed data file
    const seedData = fs.readFileSync('./seed-data.sql', 'utf8');
    const statements = seedData.split('\n').filter(line => line.trim().startsWith('INSERT'));

    console.log(`Found ${statements.length} INSERT statements`);

    // Group statements by table
    const brands = statements.filter(s => s.includes('public.brands'));
    const products = statements.filter(s => s.includes('public.products'));
    const ingredients = statements.filter(s => s.includes('public.ingredients') && !s.includes('product_ingredients'));
    const productIngredients = statements.filter(s => s.includes('public.product_ingredients'));
    const prices = statements.filter(s => s.includes('public.prices'));
    const usAvailability = statements.filter(s => s.includes('public.us_availability'));
    const reviewSummaries = statements.filter(s => s.includes('public.review_summaries'));

    // Insert in order (respecting foreign keys)
    console.log('Inserting brands...');
    for (const stmt of brands) {
      try {
        await sql.unsafe(stmt);
      } catch (e) {
        if (!e.message.includes('duplicate')) console.error('Brand error:', e.message);
      }
    }
    console.log(`  ✓ ${brands.length} brands`);

    console.log('Inserting ingredients...');
    for (const stmt of ingredients) {
      try {
        await sql.unsafe(stmt);
      } catch (e) {
        if (!e.message.includes('duplicate')) console.error('Ingredient error:', e.message);
      }
    }
    console.log(`  ✓ ${ingredients.length} ingredients`);

    console.log('Inserting products...');
    for (const stmt of products) {
      try {
        await sql.unsafe(stmt);
      } catch (e) {
        if (!e.message.includes('duplicate')) console.error('Product error:', e.message);
      }
    }
    console.log(`  ✓ ${products.length} products`);

    console.log('Inserting prices...');
    for (const stmt of prices) {
      try {
        await sql.unsafe(stmt);
      } catch (e) {
        if (!e.message.includes('duplicate')) console.error('Price error:', e.message);
      }
    }
    console.log(`  ✓ ${prices.length} prices`);

    console.log('Inserting US availability...');
    for (const stmt of usAvailability) {
      try {
        await sql.unsafe(stmt);
      } catch (e) {
        if (!e.message.includes('duplicate')) console.error('Availability error:', e.message);
      }
    }
    console.log(`  ✓ ${usAvailability.length} availability records`);

    console.log('Inserting product ingredients...');
    for (const stmt of productIngredients) {
      try {
        await sql.unsafe(stmt);
      } catch (e) {
        if (!e.message.includes('duplicate')) console.error('Product ingredient error:', e.message);
      }
    }
    console.log(`  ✓ ${productIngredients.length} product-ingredient links`);

    console.log('Inserting review summaries...');
    for (const stmt of reviewSummaries) {
      try {
        await sql.unsafe(stmt);
      } catch (e) {
        if (!e.message.includes('duplicate')) console.error('Review error:', e.message);
      }
    }
    console.log(`  ✓ ${reviewSummaries.length} review summaries`);

    // Verify counts
    const brandCount = await sql`SELECT COUNT(*) as count FROM brands`;
    const productCount = await sql`SELECT COUNT(*) as count FROM products`;

    console.log('\n✅ Database seeded successfully!');
    console.log(`   Total brands: ${brandCount[0].count}`);
    console.log(`   Total products: ${productCount[0].count}`);

  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

seedDatabase();
