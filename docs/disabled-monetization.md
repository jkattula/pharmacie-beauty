# Disabled Monetization — Restore Notes

Two monetization touchpoints were removed from the live site. The data that powers the per-product CTA is still flowing through the DB, types, and queries — only the UI render is gone. This doc captures the exact snippets needed to put either one back.

---

## 1. Skimlinks affiliate-link rewriter

**What it was:** A `<Script>` injected into the root `<body>` that rewrites outbound retailer links into affiliate links account-wide.

**Publisher script:** `https://s.skimresources.com/js/302842X1790866.skimlinks.js`
**Publisher ID:** `302842X1790866`

**Where it lived:** `src/app/layout.tsx`, inside the `<body>` after `<Providers>`.

**Restore — add this import at the top of `src/app/layout.tsx`:**

```tsx
import Script from "next/script";
```

**Restore — drop this back inside the `<body>` after `<Providers>{children}</Providers>`:**

```tsx
<Script
  src="https://s.skimresources.com/js/302842X1790866.skimlinks.js"
  strategy="afterInteractive"
/>
```

---

## 2. Per-product "Buy on {retailer}" CTA

**What it was:** A pill button on each product detail page, rendered between the price card and the "About" section, linking out to the retailer URL.

**Where it lived:** `src/app/product/[id]/page.tsx`, just before the `{/* Description */}` block.

**Data status (still live, unchanged):**

- DB columns: `products.shop_retailer`, `products.shop_url` (see `src/db/schema.ts:47-48`)
- Type: `ProductWithDetails.shopRetailer`, `ProductWithDetails.shopUrl` (see `src/types/index.ts:38-39`)
- Queries: `src/lib/db-queries.ts` still selects both fields (lines ~28-29, ~88-89, ~131-132)

So **restoring is UI-only**: paste the JSX back, add the icon import, done.

**Restore — add `ExternalLink` to the `lucide-react` import in `src/app/product/[id]/page.tsx`:**

```tsx
import { ArrowLeft, ExternalLink } from "lucide-react";
```

**Restore — paste this JSX block immediately before the `{/* Description */}` comment:**

```tsx
{/* Buy CTA */}
{product.shopUrl && product.shopRetailer && (
  <a
    href={product.shopUrl}
    target="_blank"
    rel="noopener noreferrer sponsored"
    className="flex items-center justify-center gap-s-2 w-full bg-ink text-bone hover:bg-ink2 rounded-full font-mono uppercase tracking-[0.18em] text-[11px] py-s-4 px-s-5 transition-colors"
  >
    Buy on {product.shopRetailer}
    <ExternalLink className="h-4 w-4" />
  </a>
)}
```
