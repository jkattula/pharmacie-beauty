"use client";

import { ProductCard } from "./product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ProductCard as ProductCardType } from "@/types";

interface ProductGridProps {
  products: ProductCardType[];
  onProductClick?: (productId: string) => void;
  isLoading?: boolean;
  className?: string;
}

export function ProductGrid({
  products,
  onProductClick,
  isLoading = false,
  className,
}: ProductGridProps) {
  if (isLoading) {
    return <ProductGridSkeleton className={className} />;
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 bg-stone-light rounded-full flex items-center justify-center mb-4">
          <span className="text-2xl">🔍</span>
        </div>
        <h3 className="font-serif text-lg mb-2">No products found</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Try a different search term or browse our curated categories above.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-6",
        className
      )}
    >
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onClick={() => onProductClick?.(product.id)}
        />
      ))}
    </div>
  );
}

// Loading skeleton
function ProductGridSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-6", className)}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex flex-col bg-card rounded-lg overflow-hidden shadow-card">
          {/* Image skeleton */}
          <Skeleton className="aspect-square" />

          {/* Content skeleton */}
          <div className="p-3 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-3/4" />
            <div className="pt-2 space-y-1">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export { ProductGridSkeleton };
