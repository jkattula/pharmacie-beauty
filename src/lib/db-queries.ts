import { getDb, products, brands, prices, usAvailability, productIngredients, ingredients, reviewSummaries } from "@/db";
import { eq, ilike, or, and, sql } from "drizzle-orm";
import type { ProductCard, ProductWithDetails, CuratedCategory } from "@/types";

/**
 * Get all products with essential data for card display
 */
export async function getAllProductCards(): Promise<ProductCard[]> {
  const db = getDb();

  const results = await db
    .select({
      id: products.id,
      name: products.name,
      brandName: brands.name,
      category: products.category,
      description: products.description,
      whatItsGoodFor: products.whatItsGoodFor,
      imageUrl: products.imageUrl,
      cultFavoriteFlag: products.cultFavoriteFlag,
      franceOnlyFlag: products.franceOnlyFlag,
      tiktokTrendingFlag: products.tiktokTrendingFlag,
      dealFlag: products.dealFlag,
      priceEurMin: prices.priceEurMin,
      priceEurMax: prices.priceEurMax,
      priceUsdEstimate: prices.priceUsdEstimate,
      availabilityStatus: usAvailability.availabilityStatus,
      shopRetailer: products.shopRetailer,
      shopUrl: products.shopUrl,
    })
    .from(products)
    .innerJoin(brands, eq(products.brandId, brands.id))
    .leftJoin(prices, eq(products.id, prices.productId))
    .leftJoin(usAvailability, eq(products.id, usAvailability.productId))
    .limit(500);

  return results.map(r => ({
    ...r,
    cultFavoriteFlag: r.cultFavoriteFlag ?? false,
    franceOnlyFlag: r.franceOnlyFlag ?? false,
    tiktokTrendingFlag: r.tiktokTrendingFlag ?? false,
    dealFlag: r.dealFlag ?? false,
  }));
}

/**
 * Get products by curated category
 */
export async function getProductsByCategory(category: CuratedCategory): Promise<ProductCard[]> {
  const db = getDb();

  // Build the filter condition based on category
  let filterCondition;
  switch (category) {
    case "cult_favorites":
      filterCondition = eq(products.cultFavoriteFlag, true);
      break;
    case "best_deals":
      filterCondition = eq(products.dealFlag, true);
      break;
    case "france_only":
      filterCondition = eq(products.franceOnlyFlag, true);
      break;
    case "best_sunscreens":
      filterCondition = ilike(products.category, "%sunscreen%");
      break;
    default:
      filterCondition = undefined;
  }

  const results = await db
    .select({
      id: products.id,
      name: products.name,
      brandName: brands.name,
      category: products.category,
      description: products.description,
      whatItsGoodFor: products.whatItsGoodFor,
      imageUrl: products.imageUrl,
      cultFavoriteFlag: products.cultFavoriteFlag,
      franceOnlyFlag: products.franceOnlyFlag,
      tiktokTrendingFlag: products.tiktokTrendingFlag,
      dealFlag: products.dealFlag,
      priceEurMin: prices.priceEurMin,
      priceEurMax: prices.priceEurMax,
      priceUsdEstimate: prices.priceUsdEstimate,
      availabilityStatus: usAvailability.availabilityStatus,
      shopRetailer: products.shopRetailer,
      shopUrl: products.shopUrl,
    })
    .from(products)
    .innerJoin(brands, eq(products.brandId, brands.id))
    .leftJoin(prices, eq(products.id, prices.productId))
    .leftJoin(usAvailability, eq(products.id, usAvailability.productId))
    .where(filterCondition)
    .limit(500);

  return results.map(r => ({
    ...r,
    cultFavoriteFlag: r.cultFavoriteFlag ?? false,
    franceOnlyFlag: r.franceOnlyFlag ?? false,
    tiktokTrendingFlag: r.tiktokTrendingFlag ?? false,
    dealFlag: r.dealFlag ?? false,
  }));
}

/**
 * Search products by text query
 */
export async function searchProducts(query: string): Promise<ProductCard[]> {
  const db = getDb();
  const searchPattern = `%${query}%`;

  const results = await db
    .select({
      id: products.id,
      name: products.name,
      brandName: brands.name,
      category: products.category,
      description: products.description,
      whatItsGoodFor: products.whatItsGoodFor,
      imageUrl: products.imageUrl,
      cultFavoriteFlag: products.cultFavoriteFlag,
      franceOnlyFlag: products.franceOnlyFlag,
      tiktokTrendingFlag: products.tiktokTrendingFlag,
      dealFlag: products.dealFlag,
      priceEurMin: prices.priceEurMin,
      priceEurMax: prices.priceEurMax,
      priceUsdEstimate: prices.priceUsdEstimate,
      availabilityStatus: usAvailability.availabilityStatus,
      shopRetailer: products.shopRetailer,
      shopUrl: products.shopUrl,
    })
    .from(products)
    .innerJoin(brands, eq(products.brandId, brands.id))
    .leftJoin(prices, eq(products.id, prices.productId))
    .leftJoin(usAvailability, eq(products.id, usAvailability.productId))
    .where(
      or(
        ilike(products.name, searchPattern),
        ilike(products.description, searchPattern),
        ilike(products.whatItsGoodFor, searchPattern),
        ilike(products.category, searchPattern),
        ilike(brands.name, searchPattern)
      )
    )
    .limit(500);

  return results.map(r => ({
    ...r,
    cultFavoriteFlag: r.cultFavoriteFlag ?? false,
    franceOnlyFlag: r.franceOnlyFlag ?? false,
    tiktokTrendingFlag: r.tiktokTrendingFlag ?? false,
    dealFlag: r.dealFlag ?? false,
  }));
}

/**
 * Get a single product by ID with full details
 */
export async function getProductById(id: string): Promise<ProductWithDetails | null> {
  const db = getDb();

  // Get product with brand, price, availability
  const productResult = await db
    .select()
    .from(products)
    .innerJoin(brands, eq(products.brandId, brands.id))
    .leftJoin(prices, eq(products.id, prices.productId))
    .leftJoin(usAvailability, eq(products.id, usAvailability.productId))
    .leftJoin(reviewSummaries, eq(products.id, reviewSummaries.productId))
    .where(eq(products.id, id))
    .limit(1);

  if (productResult.length === 0) return null;

  const row = productResult[0];

  // Get ingredients
  const ingredientResults = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      euOnlyFlag: ingredients.euOnlyFlag,
      notes: ingredients.notes,
      highlightFlag: productIngredients.highlightFlag,
    })
    .from(productIngredients)
    .innerJoin(ingredients, eq(productIngredients.ingredientId, ingredients.id))
    .where(eq(productIngredients.productId, id));

  return {
    ...row.products,
    brand: row.brands,
    price: row.prices,
    usAvailability: row.us_availability,
    reviewSummary: row.review_summaries,
    ingredients: ingredientResults.map(i => ({
      ...i,
      euOnlyFlag: i.euOnlyFlag ?? false,
      highlightFlag: i.highlightFlag ?? false,
    })),
  };
}

/**
 * Get category counts for filter chips
 */
export async function getCategoryCounts(): Promise<Record<CuratedCategory, number>> {
  const db = getDb();

  const [cultFavorites, bestDeals, franceOnly, sunscreens] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(products).where(eq(products.cultFavoriteFlag, true)),
    db.select({ count: sql<number>`count(*)::int` }).from(products).where(eq(products.dealFlag, true)),
    db.select({ count: sql<number>`count(*)::int` }).from(products).where(eq(products.franceOnlyFlag, true)),
    db.select({ count: sql<number>`count(*)::int` }).from(products).where(ilike(products.category, "%sunscreen%")),
  ]);

  return {
    cult_favorites: cultFavorites[0]?.count ?? 0,
    best_deals: bestDeals[0]?.count ?? 0,
    france_only: franceOnly[0]?.count ?? 0,
    best_sunscreens: sunscreens[0]?.count ?? 0,
  };
}

/**
 * Get total product count
 */
export async function getProductCount(): Promise<number> {
  const db = getDb();
  const result = await db.select({ count: sql<number>`count(*)::int` }).from(products);
  return result[0]?.count ?? 0;
}
