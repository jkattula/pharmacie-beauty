/**
 * Generate product images via Gemini 2.5 Flash Image (Nano Banana).
 * Parses ../IMAGE_PROMPTS.md, skips files already present in
 * public/images/products that are >100KB (real images), and generates the rest.
 *
 * Run: node scripts/gen-nano-banana-images.js
 *      node scripts/gen-nano-banana-images.js --force   (re-generate even if file exists)
 *      node scripts/gen-nano-banana-images.js --only=apivita_express_beauty_honey_hydrating_mask.png
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error('Missing GEMINI_API_KEY in .env.local'); process.exit(1); }

const PROMPTS_FILE = path.join(__dirname, '../../IMAGE_PROMPTS.md');
const OUT_DIR = path.join(__dirname, '../public/images/products');
const LOG_FILE = path.join(__dirname, 'data/nano-banana-log.json');
const MODEL = 'gemini-2.5-flash-image';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`;

const FORCE = process.argv.includes('--force');
const ONLY_ARG = process.argv.find(a => a.startsWith('--only='));
const ONLY = ONLY_ARG ? ONLY_ARG.split('=')[1] : null;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function parsePrompts(md) {
  const entries = [];
  const re = /\*\*Filename:\*\*\s*`([^`]+)`\s*\n\*\*Prompt:\*\*\s*\n>\s*([^\n]+(?:\n>\s*[^\n]+)*)/g;
  let m;
  while ((m = re.exec(md))) {
    const filename = m[1].trim();
    const prompt = m[2].replace(/\n>\s*/g, ' ').trim();
    entries.push({ filename, prompt });
  }
  return entries;
}

async function generateImage(prompt) {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE'] },
  };
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const text = await r.text();
    throw Object.assign(new Error(`HTTP ${r.status}: ${text.slice(0, 300)}`), { status: r.status });
  }
  const data = await r.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find(p => p.inlineData?.data);
  if (!imgPart) {
    throw new Error('No image in response: ' + JSON.stringify(data).slice(0, 400));
  }
  return Buffer.from(imgPart.inlineData.data, 'base64');
}

async function main() {
  if (!fs.existsSync(PROMPTS_FILE)) { console.error('Prompts file not found:', PROMPTS_FILE); process.exit(1); }
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  if (!fs.existsSync(path.dirname(LOG_FILE))) fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });

  const md = fs.readFileSync(PROMPTS_FILE, 'utf8');
  const entries = parsePrompts(md);
  console.log(`Parsed ${entries.length} prompt entries.`);

  let log = fs.existsSync(LOG_FILE) ? JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')) : [];

  const todo = entries.filter(e => {
    if (ONLY && e.filename !== ONLY) return false;
    if (FORCE) return true;
    const p = path.join(OUT_DIR, e.filename);
    if (!fs.existsSync(p)) return true;
    const sz = fs.statSync(p).size;
    return sz < 100_000; // <100KB → placeholder, regenerate
  });
  console.log(`${todo.length} images to generate (skipping existing >100KB files).`);

  let ok = 0, fail = 0;
  for (let i = 0; i < todo.length; i++) {
    const { filename, prompt } = todo[i];
    const out = path.join(OUT_DIR, filename);
    process.stdout.write(`[${i + 1}/${todo.length}] ${filename} ... `);
    try {
      const buf = await generateImage(prompt);
      fs.writeFileSync(out, buf);
      console.log(`OK (${(buf.length / 1024).toFixed(0)}KB)`);
      log.push({ filename, ok: true, bytes: buf.length, at: new Date().toISOString() });
      ok++;
    } catch (e) {
      console.log(`FAIL ${e.message.slice(0, 120)}`);
      log.push({ filename, ok: false, error: e.message.slice(0, 300), at: new Date().toISOString() });
      fail++;
      if (e.status === 429) {
        console.log('  rate limit — sleeping 30s');
        await sleep(30_000);
      }
    }
    fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
    await sleep(1200);
  }
  console.log(`\nDone. ok=${ok} fail=${fail}`);
}
main().catch(e => { console.error(e); process.exit(1); });
