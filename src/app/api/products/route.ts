import { NextRequest, NextResponse } from "next/server";
import { getAllProductCards, getProductsByCategory, searchProducts } from "@/lib/db-queries";
import { parseSearchIntent, generateProductsWithAI } from "@/lib/ai-search";
import type { CuratedCategory, ProductCard } from "@/types";

// Valid curated categories
const VALID_CATEGORIES: CuratedCategory[] = [
  "cult_favorites",
  "best_deals",
  "france_only",
  "best_sunscreens",
];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search")?.trim();
    const category = searchParams.get("category") as CuratedCategory | null;

    let products: ProductCard[] = [];

    // Search query takes priority
    if (search && search.length > 0) {
      // Parse intent from search query
      const intent = parseSearchIntent(search);

      // Search the database
      products = await searchProducts(search);

      // Also search by keywords if we have them
      if (products.length < 8 && intent.keywords.length > 0) {
        for (const keyword of intent.keywords) {
          if (keyword !== search) {
            const keywordResults = await searchProducts(keyword);
            products.push(...keywordResults);
          }
        }
        // Deduplicate
        const seen = new Set<string>();
        products = products.filter(p => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });
      }

      // If we still don't have enough results, use AI to generate more
      if (products.length < 8) {
        const aiProducts = await generateProductsWithAI(search, Math.min(6, 12 - products.length));

        // Convert AI products to ProductCard format
        const aiProductCards: ProductCard[] = aiProducts.map((p, idx) => ({
          id: `ai-${Date.now()}-${idx}`,
          name: p.name,
          brandName: p.brandName,
          category: p.category,
          description: p.description,
          whatItsGoodFor: p.whatItsGoodFor,
          imageUrl: null,
          priceEurMin: p.priceEurMin,
          priceEurMax: p.priceEurMax,
          priceUsdEstimate: p.priceUsdEstimate,
          cultFavoriteFlag: p.cultFavoriteFlag,
          franceOnlyFlag: p.franceOnlyFlag,
          tiktokTrendingFlag: p.tiktokTrendingFlag,
          dealFlag: p.dealFlag,
          availabilityStatus: p.availabilityStatus,
          shopRetailer: null,
          shopUrl: null,
        }));

        // Dedupe AI products against DB products
        const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
        const existingKeys = new Set(products.map(p => normalize(p.brandName + p.name)));

        const uniqueAiProducts = aiProductCards.filter(p => {
          const key = normalize(p.brandName + p.name);
          if (existingKeys.has(key)) return false;
          existingKeys.add(key);
          return true;
        });

        products = [...products, ...uniqueAiProducts];
      }
    }
    // Category filter
    else if (category && VALID_CATEGORIES.includes(category)) {
      products = await getProductsByCategory(category);

      // If category results are sparse, supplement with AI
      if (products.length < 6) {
        const categoryQueries: Record<CuratedCategory, string> = {
          cult_favorites: "iconic cult favorite French pharmacy products",
          best_deals: "affordable budget French pharmacy products under 20 euros",
          france_only: "France exclusive products not available in US",
          best_sunscreens: "French pharmacy sunscreen SPF",
        };

        const aiProducts = await generateProductsWithAI(
          categoryQueries[category],
          Math.min(4, 12 - products.length)
        );

        const aiProductCards: ProductCard[] = aiProducts.map((p, idx) => ({
          id: `ai-${Date.now()}-${idx}`,
          name: p.name,
          brandName: p.brandName,
          category: p.category,
          description: p.description,
          whatItsGoodFor: p.whatItsGoodFor,
          imageUrl: null,
          priceEurMin: p.priceEurMin,
          priceEurMax: p.priceEurMax,
          priceUsdEstimate: p.priceUsdEstimate,
          cultFavoriteFlag: p.cultFavoriteFlag,
          franceOnlyFlag: p.franceOnlyFlag,
          tiktokTrendingFlag: p.tiktokTrendingFlag,
          dealFlag: p.dealFlag,
          availabilityStatus: p.availabilityStatus,
          shopRetailer: null,
          shopUrl: null,
        }));

        const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
        const existingKeys = new Set(products.map(p => normalize(p.brandName + p.name)));

        const uniqueAiProducts = aiProductCards.filter(p => {
          const key = normalize(p.brandName + p.name);
          if (existingKeys.has(key)) return false;
          existingKeys.add(key);
          return true;
        });

        products = [...products, ...uniqueAiProducts];
      }
    }
    // No filters - return all products
    else {
      products = await getAllProductCards();
    }

    return NextResponse.json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
