/**
 * Test gpt-image-1 at HIGH quality to see if it matches ChatGPT web interface.
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
      quality: 'high',
      n: 1,
    }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 250)}`);
  const data = await r.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error('no image');
  return Buffer.from(b64, 'base64');
}

(async () => {
  for (const s of SAMPLES) {
    process.stdout.write(`${s.brand} | ${s.product} (HIGH) ... `);
    try {
      const buf = await genImage(s.brand, s.product);
      const pngTmp = `/tmp/gptih-${s.filename}.png`;
      const outJpg = `/tmp/gptih-${s.filename}.jpg`;
      fs.writeFileSync(pngTmp, buf);
      execSync(`sips -s format jpeg -s formatOptions 92 "${pngTmp}" --out "${outJpg}" >/dev/null 2>&1`);
      fs.unlinkSync(pngTmp);
      console.log(`OK ${(fs.statSync(outJpg).size / 1024).toFixed(0)}KB`);
    } catch (e) {
      console.log(`FAIL ${e.message.slice(0, 120)}`);
    }
  }
  execSync('cp /tmp/gptih-*.jpg /Users/jenniferkattula/Desktop/pharmacie-samples-v2/ 2>/dev/null', { stdio: 'inherit' });
  console.log('Saved.');
})();
