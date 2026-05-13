/**
 * Test GPT-Image-1 with short "in situ" prompts — mimicking what ChatGPT does.
 * No reference image needed; the model already knows these brands.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const SAMPLES = [
  { brand: 'Avène', product: 'Cleanance Cleansing Gel', filename: 'avene_cleanance_cleansing_gel' },
  { brand: 'Caudalie', product: 'Beauty Elixir Face Mist', filename: 'caudalie_beauty_elixir' },
  { brand: 'Nuxe', product: 'Huile Prodigieuse', filename: 'nuxe_huile_prodigieuse' },
  { brand: 'Vichy', product: 'Mineral 89 Hyaluronic Acid Serum', filename: 'vichy_mineral_89_hyaluronic_acid_serum' },
  { brand: 'Roger & Gallet', product: "Bois d'Orange Eau Fraiche", filename: 'roger_gallet_bois_d_orange_eau_fraiche' },
];

async function genImage(brand, product) {
  const prompt = `create an elegant image of ${brand} ${product} product in situ, clean background`;
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      size: '1024x1536',
      quality: 'medium',
      n: 1,
    }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 250)}`);
  const data = await r.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error('no image in response: ' + JSON.stringify(data).slice(0, 200));
  return Buffer.from(b64, 'base64');
}

(async () => {
  for (const s of SAMPLES) {
    process.stdout.write(`${s.brand} | ${s.product} ... `);
    try {
      const buf = await genImage(s.brand, s.product);
      const pngTmp = `/tmp/gpti-${s.filename}.png`;
      const outJpg = `/tmp/gpti-${s.filename}.jpg`;
      fs.writeFileSync(pngTmp, buf);
      execSync(`sips -s format jpeg -s formatOptions 90 "${pngTmp}" --out "${outJpg}" >/dev/null 2>&1`);
      fs.unlinkSync(pngTmp);
      console.log(`OK ${(fs.statSync(outJpg).size / 1024).toFixed(0)}KB → ${outJpg}`);
    } catch (e) {
      console.log(`FAIL ${e.message.slice(0, 120)}`);
    }
  }
  execSync('cp /tmp/gpti-*.jpg /Users/jenniferkattula/Desktop/pharmacie-samples-v2/ 2>/dev/null', { stdio: 'inherit' });
  console.log('\nSaved.');
})();
