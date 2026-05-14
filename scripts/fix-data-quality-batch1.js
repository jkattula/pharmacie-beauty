/**
 * Correct 16 rows flagged during the post-expansion spot-check:
 *   - 6 mis-priced rows (lowball EUR + USD)
 *   - 3 rows wrongly marked `not_available` (brand IS sold in US): → same_formula
 *   - 7 sunscreens wrongly marked `not_available`: → reformulated (EU-only UV filters)
 *
 * Each entry below specifies only the fields that need changing per row.
 * Idempotent — re-running updates the same target values.
 *
 * Run: node scripts/fix-data-quality-batch1.js
 */
const path = require('path');
const postgres = require('postgres');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const fixes = [
  // ─── PRICING FIXES ────────────────────────────────────────────────
  {
    match: { brand: 'Biologique Recherche', name: 'Lotion P50 Original' },
    price: { eurMin: 55, eurMax: 92, usdEstimate: 100 },
    availability: {
      status: 'same_formula',
      notes: 'Available in the US via licensed Biologique Recherche spas (Rescue Spa NYC and others) at roughly 40% markup. Same modern P50 1970 formula in both markets.',
    },
    product: {
      france_only_flag: false,
      deal_flag: true,
      why_buy_in_france: 'Roughly €55–92 at the BR flagship in Paris vs ~$100 at US-licensed spas — about 40% savings on the same bottle.',
    },
  },
  {
    match: { brand: 'By Terry', name: 'Baume de Rose Lip Balm' },
    price: { eurMin: 55, eurMax: 60, usdEstimate: 65 },
    product: {
      deal_flag: false,
      why_buy_in_france: 'Around €55–60 at French department stores and Sephora France vs ~$65 in the US — a small but real saving on a cult balm.',
    },
  },
  {
    match: { brand: 'Yon-Ka', name: 'Lotion Yon-Ka Toner' },
    price: { eurMin: 55, eurMax: 80, usdEstimate: 80 },
    product: {
      deal_flag: false,
      why_buy_in_france: 'About €55–80 at French Yon-Ka spas vs $80+ at US spa retail — same essential-oil toner formula.',
    },
  },
  {
    match: { brand: 'Christophe Robin', name: 'Cleansing Purifying Sea Salt Scrub' },
    price: { eurMin: 36, eurMax: 42, usdEstimate: 53 },
    product: {
      deal_flag: true,
      why_buy_in_france: 'Around €36–42 at French pharmacies and Monoprix vs $53 in the US for the same 250ml jar.',
    },
  },
  {
    match: { brand: 'Caudalie', name: 'Beauty Elixir' },
    price: { eurMin: 39, eurMax: 44, usdEstimate: 54 },
    product: {
      deal_flag: true,
      why_buy_in_france: 'About €39 for the 100ml at French pharmacies vs $54 at US Caudalie counters.',
    },
  },
  {
    match: { brand: 'Embryolisse', name: 'Embryolisse Lait-Crème Concentré' },
    price: { eurMin: 14, eurMax: 18, usdEstimate: 28 },
    product: {
      deal_flag: true,
      why_buy_in_france: 'Around €14–18 for the 75ml tube at any French pharmacy vs $28 at Sephora US.',
    },
  },

  // ─── AVAILABILITY: not_available → same_formula (3 rows) ──────────
  {
    match: { brand: 'Embryolisse', name: 'Lait-Crème Concentré Anti-Age' },
    availability: {
      status: 'same_formula',
      notes: 'Embryolisse is distributed at Sephora US; the Anti-Age tube is the same formula in both markets.',
    },
    product: {
      france_only_flag: false,
      deal_flag: true,
      why_buy_in_france: 'About €25 at French pharmacies vs ~$35 at Sephora US for the same Anti-Age tube.',
    },
  },
  {
    match: { brand: 'Bioderma', name: 'Sensibio Defensive Active Care' },
    availability: {
      status: 'same_formula',
      notes: 'Bioderma Sensibio is on the US assortment; same formula sold in both markets at lower French pharmacy pricing.',
    },
    product: {
      france_only_flag: false,
      deal_flag: true,
      why_buy_in_france: 'Roughly half the price at French pharmacies compared to US retailers — same Sensibio formula.',
    },
  },
  {
    match: { brand: 'Klorane', name: 'Smoothing and Soothing Eye Patches with Cornflower' },
    availability: {
      status: 'same_formula',
      notes: 'Klorane is distributed in the US (Target, Ulta); cornflower eye patches are the same product worldwide.',
    },
    product: {
      france_only_flag: false,
      deal_flag: true,
      why_buy_in_france: 'A few euros at French pharmacies vs ~$15 in US retail — same patches.',
    },
  },

  // ─── AVAILABILITY: not_available → reformulated (7 sunscreens) ────
  {
    match: { brand: 'La Roche-Posay', name: 'Anthelios UVMune 400 Invisible Fluid SPF50+' },
    availability: {
      status: 'reformulated',
      notes: 'EU formula contains Mexoryl 400 (MCE), a filter targeting ultra-long UVA that is not FDA-approved. The US Anthelios lineup uses different UV filters.',
    },
    product: {
      france_only_flag: true,
      deal_flag: true,
      why_buy_in_france: 'The EU UVMune 400 formula with Mexoryl 400 outperforms what FDA-approved filters can deliver in the US version — and runs less than half the price.',
    },
  },
  {
    match: { brand: 'La Roche-Posay', name: 'Effaclar Duo+ SPF30' },
    availability: {
      status: 'reformulated',
      notes: 'The EU Effaclar Duo+ with SPF uses Mexoryl XL and Tinosorb S; the US Effaclar Duo does not include the EU SPF system.',
    },
    product: {
      france_only_flag: true,
      deal_flag: true,
      why_buy_in_france: 'EU-only UV filters paired with the Effaclar Duo+ acne treatment in a single tube — not replicable from the US lineup.',
    },
  },
  {
    match: { brand: 'La Roche-Posay', name: 'La Roche-Posay Anthelios Dermo-Pediatrics Spray SPF50+' },
    availability: {
      status: 'reformulated',
      notes: 'EU pediatric Anthelios uses Mexoryl SX/XL and Tinosorb S filters; the US version is reformulated with FDA-approved alternatives.',
    },
    product: {
      france_only_flag: true,
      deal_flag: true,
      why_buy_in_france: 'The EU pediatric Anthelios uses filters that French dermatologists prefer for children — different from the US formula.',
    },
  },
  {
    match: { brand: 'Avène', name: 'Avène Very High Protection Lotion SPF50+' },
    availability: {
      status: 'reformulated',
      notes: 'EU formula uses Tinosorb S and Mexoryl SX; the US Avène SPF lineup is reformulated with FDA-approved filters and feels different on skin.',
    },
    product: {
      france_only_flag: true,
      deal_flag: true,
      why_buy_in_france: 'EU UV filters deliver lighter, more photostable broad-spectrum coverage than the reformulated US version.',
    },
  },
  {
    match: { brand: 'Avène', name: 'Hydrance UV Light Hydrating Cream SPF30' },
    availability: {
      status: 'reformulated',
      notes: 'The EU Hydrance UV uses Tinosorb S for broad-spectrum protection; the US Hydrance moisturizer has been reformulated without that filter.',
    },
    product: {
      france_only_flag: true,
      deal_flag: true,
      why_buy_in_france: 'EU-only UV filters make this Hydrance UV cream a better daily SPF than the reformulated US version.',
    },
  },
  {
    match: { brand: 'Bioderma', name: 'Bioderma Photoderm Max Aquafluide SPF50+' },
    availability: {
      status: 'reformulated',
      notes: 'EU Photoderm uses Tinosorb S, Mexoryl SX/XL, and Uvinul A Plus — none FDA-approved. The US Photoderm lineup is reformulated for FDA compliance.',
    },
    product: {
      france_only_flag: true,
      deal_flag: true,
      why_buy_in_france: 'The EU Photoderm Max Aquafluide uses modern filters that the US version cannot include due to FDA rules.',
    },
  },
  {
    match: { brand: 'Bioderma', name: 'Pigmentbio Daily Care SPF50+' },
    availability: {
      status: 'reformulated',
      notes: 'EU Pigmentbio Daily Care SPF50+ uses Tinosorb S and Mexoryl filters with azelaic acid and niacinamide; the US version is reformulated.',
    },
    product: {
      france_only_flag: true,
      deal_flag: true,
      why_buy_in_france: 'Combines EU-only UV filters with pigmentation actives in one tube — better suited to hyperpigmentation routines than the US reformulation.',
    },
  },
];

async function main() {
  const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
  let updated = 0;
  let skipped = 0;

  try {
    for (const fix of fixes) {
      const [row] = await sql`
        SELECT p.id FROM products p
        JOIN brands b ON b.id = p.brand_id
        WHERE p.name = ${fix.match.name} AND b.name = ${fix.match.brand}
        LIMIT 1
      `;
      if (!row) {
        console.log(`SKIP — not found: ${fix.match.brand} | ${fix.match.name}`);
        skipped++;
        continue;
      }
      const productId = row.id;

      if (fix.product) {
        const p = fix.product;
        await sql`
          UPDATE products SET
            france_only_flag = COALESCE(${p.france_only_flag ?? null}, france_only_flag),
            deal_flag = COALESCE(${p.deal_flag ?? null}, deal_flag),
            why_buy_in_france = COALESCE(${p.why_buy_in_france ?? null}, why_buy_in_france),
            updated_at = NOW()
          WHERE id = ${productId}
        `;
      }

      if (fix.price) {
        await sql`
          UPDATE prices SET
            price_eur_min = ${fix.price.eurMin},
            price_eur_max = ${fix.price.eurMax ?? null},
            price_usd_estimate = ${fix.price.usdEstimate ?? null}
          WHERE product_id = ${productId}
        `;
      }

      if (fix.availability) {
        await sql`
          UPDATE us_availability SET
            availability_status = ${fix.availability.status},
            notes = ${fix.availability.notes}
          WHERE product_id = ${productId}
        `;
      }

      console.log(`OK — ${fix.match.brand} | ${fix.match.name}`);
      updated++;
    }
    console.log(`\nDone. updated=${updated} skipped=${skipped}`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
