/**
 * Generate one sample image per representative brand using the new
 * brand-aesthetic-aware prompt. Saves to /tmp/sample-{filename}.jpg so it
 * doesn't overwrite the real product images until the user approves.
 *
 * Run: node scripts/gen-brand-sample.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const KEY = process.env.GEMINI_API_KEY;
const BRANDS = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/brand-aesthetics.json'), 'utf8'));
const MODEL = 'gemini-2.5-flash-image';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Iconic test products — one per brand
const SAMPLES = [
  { brand: 'Caudalie', product: 'Beauty Elixir Face Mist', filename: 'caudalie_beauty_elixir.jpg' },
  { brand: 'Clarins', product: 'Double Serum', filename: 'clarins_double_serum.jpg' },
  { brand: 'Weleda', product: 'Skin Food Original', filename: 'weleda_skin_food_original.jpg' },
  { brand: 'Nuxe', product: 'Huile Prodigieuse Multi-Purpose Dry Oil', filename: 'nuxe_huile_prodigieuse_oil.jpg' },
  { brand: 'A-Derma', product: 'Dermalibour+ Cica Repairing Cream', filename: 'a_derma_dermalibour_cica_repairing_cream.jpg' },
  { brand: 'Apivita', product: 'Express Beauty Honey Hydrating Mask', filename: 'apivita_express_beauty_honey_hydrating_mask.jpg' },
  { brand: 'Marvis', product: 'Strong Mint Toothpaste', filename: 'marvis_strong_mint_toothpaste.jpg' },
  { brand: "Roger & Gallet", product: "Bois d'Orange Eau Fraiche", filename: 'roger_gallet_bois_d_orange_eau_fraiche.jpg' },
  { brand: 'Yon-Ka', product: 'Lotion Yon-Ka Toner', filename: 'yon_ka_lotion_yon_ka_toner.jpg' },
  { brand: 'Eucerin', product: 'Replenishing Skin Relief Face Cream with 5% Urea', filename: 'eucerin_replenishing_skin_relief_face_cream_with_5_urea.jpg' },
];

function brandAwarePrompt(brand, productName, aesthetic) {
  return `Studio product photograph of ${brand} ${productName}. Brand visual identity: ${aesthetic}. The label clearly displays the brand wordmark spelled EXACTLY as "${brand}" in the brand's signature typography, with the product name "${productName}" rendered cleanly below in matching typography. Render the actual real-world packaging shape, color, and materials as ${brand} actually produces this product — do NOT invent generic packaging. NO Lorem-ipsum filler text, no garbled secondary text, no invented additional brand names. Single product, centered, soft directional side lighting, soft drop shadow, cream off-white background, photorealistic 8k product advertisement style. --ar 4:5`;
}

async function generateImage(prompt) {
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  const img = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!img) throw new Error('no image');
  return Buffer.from(img.inlineData.data, 'base64');
}

async function main() {
  for (const s of SAMPLES) {
    const aesthetic = BRANDS[s.brand];
    if (!aesthetic) { console.log('skip — no aesthetic for', s.brand); continue; }
    process.stdout.write(`${s.brand} | ${s.product} ... `);
    try {
      const buf = await generateImage(brandAwarePrompt(s.brand, s.product, aesthetic));
      const tmpPng = `/tmp/sample-${s.filename.replace(/\.jpg$/, '.png')}`;
      const outJpg = `/tmp/sample-${s.filename}`;
      fs.writeFileSync(tmpPng, buf);
      execSync(`sips -s format jpeg -s formatOptions 90 "${tmpPng}" --out "${outJpg}" >/dev/null 2>&1`);
      fs.unlinkSync(tmpPng);
      console.log(`OK → ${outJpg} (${(fs.statSync(outJpg).size/1024).toFixed(0)}KB)`);
    } catch (e) {
      console.log(`FAIL ${e.message}`);
    }
    await sleep(1200);
  }
  console.log('\nAll samples saved to /tmp/sample-*.jpg. NOT overwriting real product images yet.');
}
main();
