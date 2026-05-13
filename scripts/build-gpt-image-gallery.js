const fs = require('fs');
const path = require('path');
const log = require('./data/gpt-image-log.json');
const oks = log.filter(l => l.ok).sort((a, b) => (a.brand + a.name).localeCompare(b.brand + b.name));
const cards = oks.map(o => `
  <div class="card">
    <img src="pharmacie-production/public/images/products/${o.filename}" alt="${o.brand} ${o.name}"/>
    <div class="meta">
      <div class="brand">${o.brand}</div>
      <div class="name">${o.name}</div>
    </div>
  </div>`).join('');
const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>gpt-image-1 catalog</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; background: #faf8f5; margin: 0; padding: 24px; color: #222; }
  h1 { font-weight: 500; margin: 0 0 8px; }
  .summary { color: #555; margin-bottom: 24px; line-height: 1.5; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; }
  .card { background: white; border: 1px solid #eaeaea; border-radius: 10px; overflow: hidden; }
  .card img { width: 100%; aspect-ratio: 2/3; object-fit: contain; background: #f6f4f1; display: block; }
  .meta { padding: 12px 14px; }
  .brand { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.06em; }
  .name { font-size: 14px; margin-top: 4px; line-height: 1.35; }
</style></head><body>
<h1>Full catalog — gpt-image-1 high quality</h1>
<p class="summary">All ${oks.length} products. Scroll through. Flag anything that looks broken / wrong product and I'll re-roll it before commit.</p>
<div class="grid">${cards}</div>
</body></html>`;
fs.writeFileSync(path.join(__dirname, '../../gpt-image-gallery.html'), html);
console.log(`Wrote /Users/jenniferkattula/Documents/Pharmacie-Beauty/gpt-image-gallery.html with ${oks.length} cards`);
