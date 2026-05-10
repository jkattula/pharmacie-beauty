/**
 * Copy all product images into the Next.js public folder
 * and update database to use /images/products/... paths
 *
 * This approach serves images directly from Vercel CDN -
 * faster and avoids Supabase DNS issues.
 */

const fs = require('fs');
const path = require('path');
const postgres = require('postgres');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;
const IMAGES_DIR = path.join(__dirname, '../../extracted/Pharmacie-Beauty/attached_assets/generated_images');
const PUBLIC_DIR = path.join(__dirname, '../public/images/products');

function normalizeFilename(filename) {
  return filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics (è→e, é→e, ê→e)
    .replace(/\+/g, '_plus_')        // Replace +
    .replace(/[^a-zA-Z0-9_.\-]/g, '_'); // Replace other specials with _
}

async function main() {
  console.log('🖼️  Copying images to public folder...\n');

  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not found');
    process.exit(1);
  }

  // Ensure target directory exists
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  const sql = postgres(DATABASE_URL, { max: 1, idle_timeout: 20 });

  // Read all image files
  const imageFiles = fs.readdirSync(IMAGES_DIR).filter(f =>
    f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')
  );
  console.log(`📷 Found ${imageFiles.length} images\n`);

  let copied = 0;
  let dbUpdated = 0;

  for (const filename of imageFiles) {
    const srcPath = path.join(IMAGES_DIR, filename);
    const normalizedName = normalizeFilename(filename);
    const destPath = path.join(PUBLIC_DIR, normalizedName);
    const oldDbPath = `/attached_assets/generated_images/${filename}`;
    const newDbPath = `/images/products/${normalizedName}`;

    try {
      // Copy file
      fs.copyFileSync(srcPath, destPath);
      copied++;

      // Update database
      const result = await sql`
        UPDATE products
        SET image_url = ${newDbPath}
        WHERE image_url = ${oldDbPath}
      `;

      // Also try updating if the URL was already changed to Supabase storage
      const supabasePattern = `%${filename}`;
      const supabaseNormalizedPattern = `%product-images/${normalizedName}`;
      await sql`
        UPDATE products
        SET image_url = ${newDbPath}
        WHERE image_url LIKE ${supabasePattern}
           OR image_url LIKE ${supabaseNormalizedPattern}
      `;

      dbUpdated++;
    } catch (err) {
      console.log(`  ❌ ${filename}: ${err.message}`);
    }
  }

  // Also update any remaining products that still have old paths
  // by matching the filename portion
  const remaining = await sql`
    SELECT id, image_url FROM products
    WHERE image_url LIKE '/attached_assets/%'
       OR image_url LIKE 'https://vqrjlwnooaxahidjjyru.supabase.co%'
  `;

  for (const row of remaining) {
    // Extract filename from old path
    const oldFilename = row.image_url.split('/').pop();
    const normalizedName = normalizeFilename(decodeURIComponent(oldFilename));
    const newPath = `/images/products/${normalizedName}`;

    // Check if the normalized file exists in public
    if (fs.existsSync(path.join(PUBLIC_DIR, normalizedName))) {
      await sql`UPDATE products SET image_url = ${newPath} WHERE id = ${row.id}`;
    }
  }

  await sql.end();

  console.log(`✅ Copied ${copied} images to public/images/products/`);
  console.log(`✅ Updated ${dbUpdated} database records`);
  console.log(`\n🎉 Images will be served from Vercel CDN at /images/products/\n`);

  // Check total size
  const totalSize = imageFiles.reduce((sum, f) => {
    return sum + fs.statSync(path.join(IMAGES_DIR, f)).size;
  }, 0);
  console.log(`📦 Total image size: ${(totalSize / 1024 / 1024).toFixed(1)} MB`);
}

main().catch(console.error);
