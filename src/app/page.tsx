"use client";

import { Suspense, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchBar } from "@/components/features/search-bar";
import { CategoryChips } from "@/components/features/category-chips";
import { ProductGrid } from "@/components/features/product-grid";
import { SiteHeader } from "@/components/features/site-header";
import { Loader2 } from "lucide-react";
import { Rule } from "@/components/ui/marks";
import { CURATED_CATEGORIES } from "@/types";
import type { ProductCard, CuratedCategory, CategoryCountsResponse } from "@/types";

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const searchQuery = searchParams.get("search") ?? "";
  const categoryParam = searchParams.get("category");
  const selectedCategory: CuratedCategory | null =
    categoryParam && categoryParam in CURATED_CATEGORIES
      ? (categoryParam as CuratedCategory)
      : null;

  const updateParams = useCallback(
    (next: { search?: string | null; category?: CuratedCategory | null }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.search !== undefined) {
        if (next.search) params.set("search", next.search);
        else params.delete("search");
      }
      if (next.category !== undefined) {
        if (next.category) params.set("category", next.category);
        else params.delete("category");
      }
      const qs = params.toString();
      router.replace(qs ? `/?${qs}` : "/", { scroll: false });
    },
    [router, searchParams]
  );

  const apiUrl = (() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (selectedCategory) params.set("category", selectedCategory);
    const queryString = params.toString();
    return queryString ? `/api/products?${queryString}` : "/api/products";
  })();

  const {
    data: products = [],
    isLoading: isLoadingProducts,
    isFetching,
  } = useQuery<ProductCard[]>({
    queryKey: ["products", searchQuery, selectedCategory],
    queryFn: async () => {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: categoryCounts } = useQuery<CategoryCountsResponse>({
    queryKey: ["categoryCounts"],
    queryFn: async () => {
      const response = await fetch("/api/categories/counts");
      if (!response.ok) throw new Error("Failed to fetch counts");
      return response.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const handleSearch = useCallback(
    (query: string) => {
      updateParams({ search: query || null, category: null });
    },
    [updateParams]
  );

  const handleCategorySelect = useCallback(
    (category: CuratedCategory) => {
      const next = selectedCategory === category ? null : category;
      updateParams({ search: null, category: next });
    },
    [selectedCategory, updateParams]
  );

  const handleProductClick = useCallback(
    (productId: string) => {
      router.push(`/product/${productId}`);
    },
    [router]
  );

  const isLoading = isLoadingProducts || isFetching;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader>
        <SearchBar
          onSearch={handleSearch}
          placeholder="anti-aging eye cream, rosacea care…"
          isLoading={isLoading}
          value={searchQuery}
        />
      </SiteHeader>

      <main className="max-w-7xl mx-auto px-s-4 sm:px-s-5 lg:px-s-7 py-s-5 sm:py-s-7">
        {/* Category Chips */}
        <div className="mb-s-6">
          <CategoryChips
            selectedCategory={selectedCategory}
            onCategorySelect={handleCategorySelect}
            counts={categoryCounts}
          />
        </div>

        {/* Loading Indicator for Search */}
        {isLoading && searchQuery && (
          <div className="flex items-center justify-center gap-s-2 mb-s-4 p-s-4 bg-cream rounded-md border border-border">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            <span className="label">
              Searching · {searchQuery}
            </span>
          </div>
        )}

        {/* Results Count */}
        {!isLoading && products.length > 0 && (searchQuery || selectedCategory) && (
          <div className="mb-s-4">
            <p className="label">
              {products.length} product{products.length !== 1 ? "s" : ""}
              {searchQuery && ` · ${searchQuery}`}
              {selectedCategory && ` · ${selectedCategory.replace(/_/g, " ")}`}
            </p>
          </div>
        )}

        {/* Product Grid */}
        <ProductGrid
          products={products}
          onProductClick={handleProductClick}
          isLoading={isLoadingProducts}
        />
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-s-4 sm:px-s-5 lg:px-s-7 py-s-8 text-center">
        <div className="flex justify-center text-ink3 mb-s-4">
          <Rule size={28} />
        </div>
        <p className="font-serif text-sm text-ink3 leading-relaxed">
          Prices are approximate. Product availability may vary.
          <br />
          Not medical advice. Consult a dermatologist for skin concerns.
          <br />
          Some links are affiliate links. If you buy through them, I may earn a
          small commission at no extra cost to you.
        </p>
        <p className="label mt-s-5">
          © 2026 · Pharmacie Beauty · Jennifer Kattula
        </p>
      </footer>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomePageContent />
    </Suspense>
  );
}
