/**
 * Sync products.image_url to the matching file in public/images/products.
 *
 * Two passes:
 *   1. Use IMAGE_PROMPTS.md to bind canonical filenames → product by extracting
 *      the "Brand Product Name" from each prompt and matching DB rows.
 *   2. For products not yet matched, fall back to a fuzzy slug match against
 *      filenames already on disk.
 *
 * Idempotent. Reports anything unmatched.
 *
 * Run: node scripts/sync-image-urls.js
 *      node scripts/sync-image-urls.js --dry
 */
const fs = require('fs');
const path = require('path');
const postgres = require('postgres');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const DRY = process.argv.includes('--dry');
const IMAGES_DIR = path.join(__dirname, '../public/images/products');
const PROMPTS_FILE = path.join(__dirname, '../../IMAGE_PROMPTS.md');

function norm(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function slug(s) {
  return norm(s).replace(/ /g, '_');
}

function parsePrompts(md) {
  // Each entry: **Filename:** `name.png` \n **Prompt:** \n > Professional studio product photography of <BRAND PRODUCT>. ...
  const out = [];
  // Match "Professional studio product photography of <NAME>. " where the
  // terminating period must be followed by a space + capital letter (next
  // sentence). This tolerates decimal points inside the name (e.g. "0.1").
  const re = /\*\*Filename:\*\*\s*`([^`]+)`\s*\n\*\*Prompt:\*\*\s*\n>\s*Professional studio product photography of (.+?)\.\s+[A-Z]/g;
  let m;
  while ((m = re.exec(md))) {
    out.push({ filename: m[1].trim(), namestr: norm(m[2]) });
  }
  return out;
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 });
  try {
    const onDisk = new Set(
      fs.readdirSync(IMAGES_DIR).filter((f) => f.endsWith('.png') || f.endsWith('.jpg'))
    );
    console.log(`Files on disk: ${onDisk.size}`);

    const md = fs.readFileSync(PROMPTS_FILE, 'utf8');
    const promptEntries = parsePrompts(md);
    console.log(`Prompts parsed from IMAGE_PROMPTS.md: ${promptEntries.length}`);

    const products = await sql`SELECT p.id, p.name, p.image_url, b.name AS brand FROM products p JOIN brands b ON b.id = p.brand_id ORDER BY b.name, p.name`;
    console.log(`Products in DB: ${products.length}\n`);

    const productByKey = new Map(); // norm("brand product name") → product
    for (const p of products) {
      productByKey.set(norm(`${p.brand} ${p.name}`), p);
    }

    const updates = new Map(); // productId → desiredUrl
    let pass1Hits = 0;

    // Pass 1: prompt-based binding
    const unmatchedPrompts = [];
    for (const { filename, namestr } of promptEntries) {
      const p = productByKey.get(namestr);
      if (p && onDisk.has(filename)) {
        updates.set(p.id, `/images/products/${filename}`);
        pass1Hits++;
      } else {
        // Try with brand-prefix stripped from namestr (some prompts double the brand)
        const tokens = namestr.split(' ');
        // Try shifting brand tokens
        let matched = null;
        for (let k = 1; k <= Math.min(3, tokens.length - 1); k++) {
          const key = tokens.slice(k).join(' ');
          for (const [dbKey, prod] of productByKey) {
            if (dbKey.endsWith(' ' + key) || dbKey === key) {
              matched = prod;
              break;
            }
          }
          if (matched) break;
        }
        if (matched && onDisk.has(filename)) {
          updates.set(matched.id, `/images/products/${filename}`);
          pass1Hits++;
        } else {
          unmatchedPrompts.push({ filename, namestr });
        }
      }
    }
    console.log(`Pass 1 (prompt→product): ${pass1Hits} bound`);

    // Pass 2: fuzzy fallback for products not yet bound
    let pass2Hits = 0;
    const stillUnbound = [];
    for (const p of products) {
      if (updates.has(p.id)) continue;
      const brandSlug = slug(p.brand);
      const productTokens = slug(p.name).split('_').filter((t) => t.length > 2 && t !== brandSlug.split('_').slice(-1)[0]);
      const candidates = [...onDisk].filter(
        (f) =>
          f.toLowerCase().startsWith(brandSlug + '_') &&
          productTokens.every((t) => f.toLowerCase().includes(t))
      );
      if (candidates.length === 1) {
        updates.set(p.id, `/images/products/${candidates[0]}`);
        pass2Hits++;
      } else if (candidates.length > 1) {
        // Pick the longest match (most specific filename)
        candidates.sort((a, b) => b.length - a.length);
        updates.set(p.id, `/images/products/${candidates[0]}`);
        pass2Hits++;
      } else {
        stillUnbound.push(p);
      }
    }
    console.log(`Pass 2 (fuzzy fallback): ${pass2Hits} bound`);
    console.log(`Total bound: ${updates.size}`);
    console.log(`Unbound products: ${stillUnbound.length}`);

    // Apply updates
    let changed = 0, unchanged = 0;
    for (const p of products) {
      const desired = updates.get(p.id);
      if (!desired) continue;
      if (p.image_url === desired) { unchanged++; continue; }
      if (!DRY) await sql`UPDATE products SET image_url = ${desired} WHERE id = ${p.id}`;
      changed++;
    }
    console.log(`\nDB: ${changed} updated, ${unchanged} unchanged.`);

    if (stillUnbound.length) {
      console.log('\n=== Products with NO matching image file ===');
      for (const p of stillUnbound) {
        console.log(`  ${p.brand} | ${p.name}  (current: ${p.image_url || '(null)'})`);
      }
    }
    if (unmatchedPrompts.length) {
      console.log('\n=== Prompts whose product couldnt be matched ===');
      for (const u of unmatchedPrompts) {
        console.log(`  ${u.filename}  (prompt: "${u.namestr}")`);
      }
    }

    if (DRY) console.log('\n[dry run — no DB writes performed]');
  } finally {
    await sql.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
