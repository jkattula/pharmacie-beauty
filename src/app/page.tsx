"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { SearchBar } from "@/components/features/search-bar";
import { CategoryChips } from "@/components/features/category-chips";
import { ProductGrid } from "@/components/features/product-grid";
import { Loader2 } from "lucide-react";
import type { ProductCard, CuratedCategory, CategoryCountsResponse } from "@/types";

export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CuratedCategory | null>(null);

  // Build the API URL based on current filters
  const getApiUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (selectedCategory) params.set("category", selectedCategory);
    const queryString = params.toString();
    return queryString ? `/api/products?${queryString}` : "/api/products";
  }, [searchQuery, selectedCategory]);

  // Fetch products
  const {
    data: products = [],
    isLoading: isLoadingProducts,
    isFetching,
  } = useQuery<ProductCard[]>({
    queryKey: ["products", searchQuery, selectedCategory],
    queryFn: async () => {
      const response = await fetch(getApiUrl());
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch category counts
  const { data: categoryCounts } = useQuery<CategoryCountsResponse>({
    queryKey: ["categoryCounts"],
    queryFn: async () => {
      const response = await fetch("/api/categories/counts");
      if (!response.ok) throw new Error("Failed to fetch counts");
      return response.json();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Handle search submission
  const handleSearch = useCallback((query: string) => {
    setSelectedCategory(null);
    setSearchQuery(query);
  }, []);

  // Handle category selection
  const handleCategorySelect = useCallback((category: CuratedCategory) => {
    setSearchQuery("");
    setSelectedCategory((prev) => (prev === category ? null : category));
  }, []);

  // Handle product click
  const handleProductClick = useCallback(
    (productId: string) => {
      router.push(`/product/${productId}`);
    },
    [router]
  );

  const isLoading = isLoadingProducts || isFetching;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-stone">
        <div className="max-w-lg mx-auto px-4 py-4">
          {/* App Title */}
          <div className="text-center mb-4">
            <h1 className="font-serif text-2xl font-semibold text-foreground">
              Pharmacie Beauty
            </h1>
            <p className="text-sm text-muted-foreground">
              Your French pharmacy guide
            </p>
          </div>

          {/* Search Bar */}
          <SearchBar
            onSearch={handleSearch}
            placeholder="Anti-aging eye cream, rosacea care..."
            isLoading={isLoading}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 py-4">
        {/* Category Chips */}
        <div className="mb-6">
          <CategoryChips
            selectedCategory={selectedCategory}
            onCategorySelect={handleCategorySelect}
            counts={categoryCounts}
          />
        </div>

        {/* Loading Indicator for Search */}
        {isLoading && searchQuery && (
          <div className="flex items-center justify-center gap-2 mb-4 p-4 bg-primary/10 rounded-lg">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">
              Searching for &quot;{searchQuery}&quot;...
            </span>
          </div>
        )}

        {/* Results Count */}
        {!isLoading && products.length > 0 && (searchQuery || selectedCategory) && (
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">
              {products.length} product{products.length !== 1 ? "s" : ""} found
              {searchQuery && ` for "${searchQuery}"`}
              {selectedCategory && ` in ${selectedCategory.replace(/_/g, " ")}`}
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
      <footer className="max-w-lg mx-auto px-4 py-8 text-center">
        <p className="text-xs text-muted-foreground">
          Prices are approximate. Product availability may vary.
          <br />
          Not medical advice. Consult a dermatologist for skin concerns.
        </p>
      </footer>
    </div>
  );
}
