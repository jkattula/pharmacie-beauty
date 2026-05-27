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

const GRID_CLASSES =
  "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-s-4 sm:gap-s-5 lg:gap-s-6";

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
      <div className="flex flex-col items-center justify-center py-s-9 text-center">
        <p className="label mb-s-4">— Nothing found —</p>
        <h3 className="font-serif text-ink text-xl mb-s-2 font-medium">No products found</h3>
        <p className="font-serif text-ink3 text-sm max-w-xs">
          Try a different search term or browse our curated categories above.
        </p>
      </div>
    );
  }

  return (
    <div className={cn(GRID_CLASSES, className)}>
      {products.map((product) => {
        // AI-suggested cards use synthetic "ai-..." ids that have no detail
        // page — leave them non-navigable so they don't dead-end on a 404.
        const isNavigable = !product.id.startsWith("ai-");
        return (
          <ProductCard
            key={product.id}
            product={product}
            onClick={
              isNavigable ? () => onProductClick?.(product.id) : undefined
            }
          />
        );
      })}
    </div>
  );
}

function ProductGridSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn(GRID_CLASSES, className)}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col bg-cream rounded-md overflow-hidden border border-border/60"
        >
          <Skeleton className="aspect-square rounded-none" />
          <div className="p-s-4 space-y-s-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-3/4" />
            <div className="pt-s-2 space-y-s-1">
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
