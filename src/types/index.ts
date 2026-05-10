import type { Brand, Product, Price, UsAvailability, Ingredient, ReviewSummary } from "@/db/schema";

// ============================================
// API Response Types
// ============================================

// Ingredient with highlight flag for product details
export interface IngredientWithHighlight extends Ingredient {
  highlightFlag: boolean;
}

// Full product with all related data (used in API responses)
export interface ProductWithDetails extends Product {
  brand: Brand;
  price: Price | null;
  usAvailability: UsAvailability | null;
  ingredients: IngredientWithHighlight[];
  reviewSummary?: ReviewSummary | null;
}

// Simplified product for list views (less data, faster load)
export interface ProductCard {
  id: string;
  name: string;
  brandName: string;
  category: string;
  description: string;
  whatItsGoodFor: string;
  imageUrl: string | null;
  priceEurMin: number | null;
  priceEurMax: number | null;
  priceUsdEstimate: number | null;
  cultFavoriteFlag: boolean;
  franceOnlyFlag: boolean;
  tiktokTrendingFlag: boolean;
  dealFlag: boolean;
  availabilityStatus: "same_formula" | "reformulated" | "not_available" | null;
  shopRetailer: string | null;
  shopUrl: string | null;
}

// ============================================
// Curated Categories
// ============================================

export const CURATED_CATEGORIES = {
  cult_favorites: {
    label: "Cult Favorites",
    description: "Iconic French pharmacy staples",
    icon: "Star",
    color: "amber",
  },
  best_deals: {
    label: "Best Deals",
    description: "Great value in France",
    icon: "Tag",
    color: "green",
  },
  france_only: {
    label: "France Only",
    description: "Not available in the US",
    icon: "MapPin",
    color: "blue",
  },
  tiktok_trending: {
    label: "TikTok Favorites",
    description: "Viral skincare picks",
    icon: "Sparkles",
    color: "pink",
  },
  best_sunscreens: {
    label: "Sunscreens",
    description: "EU-approved UV filters",
    icon: "Sun",
    color: "yellow",
  },
} as const;

export type CuratedCategory = keyof typeof CURATED_CATEGORIES;

// ============================================
// Search Types
// ============================================

export interface SearchResult {
  products: ProductWithDetails[];
  narrative?: string;
  dbCount: number;
  aiCount: number;
}

export interface SearchFilters {
  category?: CuratedCategory;
  search?: string;
}

// ============================================
// API Request/Response Types
// ============================================

export interface ProductsResponse {
  products: ProductCard[];
  total: number;
}

export interface CategoryCountsResponse {
  cult_favorites: number;
  best_deals: number;
  france_only: number;
  tiktok_trending: number;
  best_sunscreens: number;
}

// ============================================
// Availability Status Helpers
// ============================================

export const AVAILABILITY_STATUS = {
  same_formula: {
    label: "Same Formula in US",
    description: "Available with identical formulation",
    color: "green",
    icon: "Check",
  },
  reformulated: {
    label: "Reformulated in US",
    description: "Available but with different ingredients",
    color: "amber",
    icon: "AlertTriangle",
  },
  not_available: {
    label: "France Only",
    description: "Not available in the US",
    color: "red",
    icon: "X",
  },
} as const;
