const fs = require('fs');
const path = require('path');
const log = require('./data/i2i-log.json');
const oks = log.filter(l => l.ok).sort((a, b) => (a.brand + a.name).localeCompare(b.brand + b.name));

const cards = oks.map(o => `
  <div class="card">
    <img src="pharmacie-production/public/images/products/${o.filename}" alt="${o.brand} ${o.name}"/>
    <div class="meta">
      <div class="brand">${o.brand}</div>
      <div class="name">${o.name}</div>
      <div class="filename">${o.filename}</div>
    </div>
  </div>`).join('');

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>i2i regen gallery</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; background: #faf8f5; margin: 0; padding: 24px; color: #222; }
  h1 { font-weight: 500; margin: 0 0 8px; }
  .summary { color: #555; margin-bottom: 24px; line-height: 1.5; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; }
  .card { background: white; border: 1px solid #eaeaea; border-radius: 10px; overflow: hidden; }
  .card img { width: 100%; aspect-ratio: 4/5; object-fit: contain; background: #f6f4f1; display: block; }
  .meta { padding: 12px 14px; }
  .brand { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.06em; }
  .name { font-size: 14px; margin-top: 4px; line-height: 1.35; }
  .filename { font-size: 10px; color: #aaa; margin-top: 6px; font-family: ui-monospace, monospace; word-break: break-all; }
</style></head><body>
<h1>i2i regenerated images — ${oks.length} products</h1>
<p class="summary">Nano Banana image-to-image using real retailer reference photos. Scroll through — flag anything that looks bad and I'll add it to the manual punch list. Otherwise commit and ship.</p>
<div class="grid">${cards}</div>
</body></html>`;

fs.writeFileSync(path.join(__dirname, '../../i2i-gallery.html'), html);
console.log(`Wrote /Users/jenniferkattula/Documents/Pharmacie-Beauty/i2i-gallery.html with ${oks.length} cards`);
