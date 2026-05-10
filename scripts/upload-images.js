/**
 * Script to upload product images to Supabase Storage
 * and update the database with public URLs
 *
 * Usage:
 * 1. Get your Supabase service_role key from:
 *    https://supabase.com/dashboard/project/vqrjlwnooaxahidjjyru/settings/api
 * 2. Run: SUPABASE_SERVICE_KEY="your-key-here" npm run upload-images
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const postgres = require('postgres');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Configuration
const SUPABASE_URL = 'https://vqrjlwnooaxahidjjyru.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
const IMAGES_DIR = path.join(__dirname, '../../extracted/Pharmacie-Beauty/attached_assets/generated_images');
const BUCKET_NAME = 'product-images';

async function main() {
  console.log('🖼️  Pharmacie Beauty - Image Upload Script\n');

  if (!SUPABASE_SERVICE_KEY) {
    console.error('❌ SUPABASE_SERVICE_KEY is required\n');
    console.log('To get your service key:');
    console.log('1. Go to: https://supabase.com/dashboard/project/vqrjlwnooaxahidjjyru/settings/api');
    console.log('2. Scroll down to "service_role" secret key');
    console.log('3. Click "Reveal" and copy the key');
    console.log('4. Run this command:\n');
    console.log('   SUPABASE_SERVICE_KEY="paste-your-key-here" npm run upload-images\n');
    process.exit(1);
  }

  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in .env.local');
    process.exit(1);
  }

  // Check images directory
  if (!fs.existsSync(IMAGES_DIR)) {
    console.error(`❌ Images directory not found: ${IMAGES_DIR}`);
    process.exit(1);
  }

  // Initialize clients
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const sql = postgres(DATABASE_URL, { max: 1, idle_timeout: 20 });

  const imageFiles = fs.readdirSync(IMAGES_DIR).filter(f =>
    f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')
  );
  console.log(`📷 Found ${imageFiles.length} images to upload\n`);

  // Ensure bucket exists and is public
  console.log('🪣 Setting up storage bucket...');

  // Try to create bucket (will fail if exists, that's ok)
  await supabase.storage.createBucket(BUCKET_NAME, {
    public: true,
    fileSizeLimit: 10485760 // 10MB
  });

  // Update bucket to ensure it's public
  await supabase.storage.updateBucket(BUCKET_NAME, {
    public: true
  });

  console.log('✅ Bucket ready\n');

  // Upload images
  console.log('📤 Uploading images...\n');

  let uploaded = 0;
  let failed = 0;
  const urlMap = {};

  for (let i = 0; i < imageFiles.length; i++) {
    const filename = imageFiles[i];
    const filePath = path.join(IMAGES_DIR, filename);

    try {
      const fileBuffer = fs.readFileSync(filePath);

      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filename, fileBuffer, {
          contentType: 'image/png',
          upsert: true
        });

      if (error) {
        console.log(`   ❌ ${filename}: ${error.message}`);
        failed++;
        continue;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filename);

      const oldPath = `/attached_assets/generated_images/${filename}`;
      urlMap[oldPath] = urlData.publicUrl;
      uploaded++;

      // Progress indicator
      const pct = Math.round((i + 1) / imageFiles.length * 100);
      process.stdout.write(`\r   Progress: ${pct}% (${uploaded} uploaded, ${failed} failed)`);
    } catch (err) {
      console.log(`   ❌ ${filename}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n\n✅ Upload complete: ${uploaded} uploaded, ${failed} failed\n`);

  // Update database with new URLs
  if (uploaded > 0) {
    console.log('🔄 Updating database with new image URLs...\n');

    let dbUpdated = 0;
    for (const [oldPath, newUrl] of Object.entries(urlMap)) {
      try {
        const result = await sql`
          UPDATE products
          SET image_url = ${newUrl}
          WHERE image_url = ${oldPath}
        `;
        dbUpdated++;
      } catch (err) {
        console.log(`   ❌ DB update failed for ${oldPath}`);
      }
    }

    console.log(`✅ Updated ${dbUpdated} product image URLs in database\n`);
  }

  await sql.end();

  console.log('🎉 Done! Your images are now live on Supabase Storage.');
  console.log(`\n📍 Base URL: ${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
