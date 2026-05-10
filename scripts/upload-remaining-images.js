/**
 * Upload remaining images with special characters in filenames
 * Reads directory listing and matches files that weren't uploaded yet
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const postgres = require('postgres');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const SUPABASE_URL = 'https://vqrjlwnooaxahidjjyru.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
const IMAGES_DIR = path.join(__dirname, '../../extracted/Pharmacie-Beauty/attached_assets/generated_images');
const BUCKET_NAME = 'product-images';

function normalizeFilename(filename) {
  return filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/\+/g, '_plus_')        // Replace +
    .replace(/[^a-zA-Z0-9_.\-]/g, '_'); // Replace other specials
}

function hasSpecialChars(filename) {
  const normalized = filename.normalize('NFD');
  return normalized !== filename.normalize('NFC') ||
    /[^\x00-\x7F]/.test(filename) ||
    /\+/.test(filename);
}

async function main() {
  console.log('🖼️  Uploading remaining images with special characters...\n');

  if (!SUPABASE_SERVICE_KEY || !DATABASE_URL) {
    console.error('❌ Missing SUPABASE_SERVICE_KEY or DATABASE_URL');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const sql = postgres(DATABASE_URL, { max: 1, idle_timeout: 20 });

  // Read directory and find files with special characters
  const allFiles = fs.readdirSync(IMAGES_DIR);
  const problemFiles = allFiles.filter(f => f.endsWith('.png') && hasSpecialChars(f));

  console.log(`Found ${problemFiles.length} files with special characters\n`);

  let uploaded = 0;
  let failed = 0;

  for (const filename of problemFiles) {
    const filePath = path.join(IMAGES_DIR, filename);
    const normalizedName = normalizeFilename(filename);
    const oldPath = `/attached_assets/generated_images/${filename}`;

    try {
      const fileBuffer = fs.readFileSync(filePath);

      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(normalizedName, fileBuffer, {
          contentType: 'image/png',
          upsert: true
        });

      if (error) {
        console.log(`  ❌ ${filename}: ${error.message}`);
        failed++;
        continue;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(normalizedName);

      // Update database
      await sql`
        UPDATE products
        SET image_url = ${urlData.publicUrl}
        WHERE image_url = ${oldPath}
      `;

      console.log(`  ✅ ${filename} → ${normalizedName}`);
      uploaded++;
    } catch (err) {
      console.log(`  ❌ ${filename}: ${err.message}`);
      failed++;
    }
  }

  await sql.end();
  console.log(`\n🎉 Done! ${uploaded} uploaded, ${failed} failed`);
}

main().catch(console.error);
