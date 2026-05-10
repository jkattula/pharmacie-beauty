"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import {
  ArrowLeft,
  Star,
  MapPin,
  Sparkles,
  Tag,
  Check,
  AlertTriangle,
  X,
  Beaker,
  Info,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatPriceEur, formatPriceUsd, calculateSavings, getProductImageUrl } from "@/lib/utils";
import type { ProductWithDetails } from "@/types";
import { AVAILABILITY_STATUS } from "@/types";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;

  const { data: product, isLoading, error } = useQuery<ProductWithDetails>({
    queryKey: ["product", productId],
    queryFn: async () => {
      const response = await fetch(`/api/products/${productId}`);
      if (!response.ok) throw new Error("Failed to fetch product");
      return response.json();
    },
    enabled: !!productId,
  });

  if (isLoading) {
    return <ProductDetailSkeleton onBack={() => router.back()} />;
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <h2 className="font-serif text-xl mb-2">Product not found</h2>
          <p className="text-muted-foreground mb-4">
            We couldn&apos;t find this product.
          </p>
          <Button onClick={() => router.push("/")}>Back to Home</Button>
        </div>
      </div>
    );
  }

  const notSoldInUs = product.usAvailability?.availabilityStatus === "not_available";
  const savings = notSoldInUs
    ? null
    : calculateSavings(
        product.price?.priceEurMin ?? null,
        product.price?.priceUsdEstimate ?? null
      );

  const availabilityInfo = product.usAvailability?.availabilityStatus
    ? AVAILABILITY_STATUS[product.usAvailability.availabilityStatus]
    : null;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-stone">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-serif">
              {product.brand.name}
            </p>
            <h1 className="font-medium text-sm truncate">{product.name}</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto lg:grid lg:grid-cols-2 lg:gap-8 lg:px-8 lg:py-6">
        {/* Product Image */}
        <div className="relative aspect-square bg-stone-light lg:rounded-lg lg:overflow-hidden lg:sticky lg:top-20 lg:self-start">
          <Image
            src={getProductImageUrl(product.imageUrl, product.name)}
            alt={product.name}
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />

          {/* Badges */}
          <div className="absolute top-4 left-4 flex flex-col gap-2">
            {product.cultFavoriteFlag && (
              <Badge variant="cult" className="text-sm">
                <Star className="h-4 w-4 mr-1" />
                Cult Favorite
              </Badge>
            )}
            {product.tiktokTrendingFlag && (
              <Badge variant="trending" className="text-sm">
                <Sparkles className="h-4 w-4 mr-1" />
                Trending
              </Badge>
            )}
            {product.franceOnlyFlag && (
              <Badge variant="france" className="text-sm">
                <MapPin className="h-4 w-4 mr-1" />
                France Only
              </Badge>
            )}
            {product.dealFlag && (
              <Badge variant="deal" className="text-sm">
                <Tag className="h-4 w-4 mr-1" />
                Great Deal
              </Badge>
            )}
          </div>
        </div>

        {/* Product Info */}
        <div className="px-4 py-6 space-y-6 lg:px-0 lg:py-0">
          {/* Title & Brand */}
          <div>
            <p className="text-sm font-serif text-primary uppercase tracking-wide">
              {product.brand.name}
            </p>
            <h2 className="font-serif text-2xl font-semibold mt-1">
              {product.name}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {product.category}
            </p>
          </div>

          {/* Price Section */}
          <div className="bg-card rounded-lg p-4 shadow-card">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-2xl font-semibold text-primary">
                  {formatPriceEur(
                    product.price?.priceEurMin ?? null,
                    product.price?.priceEurMax ?? null
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  In French pharmacies
                </p>
              </div>
              {notSoldInUs ? (
                <div className="text-right">
                  <p className="text-sm font-medium text-muted-foreground">
                    Not sold in US
                  </p>
                </div>
              ) : (
                savings && savings > 0 && (
                  <div className="text-right">
                    <p className="text-lg font-semibold text-green-600">
                      Save ~{savings}%
                    </p>
                    <p className="text-sm text-muted-foreground">
                      vs {formatPriceUsd(product.price?.priceUsdEstimate ?? null)}
                      {product.usAvailability?.availabilityStatus === "reformulated" && (
                        <span className="block">(different US formula)</span>
                      )}
                    </p>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Buy CTA */}
          {product.shopUrl && product.shopRetailer && (
            <a
              href={product.shopUrl}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-full font-medium py-3 px-6 transition-colors"
            >
              Buy on {product.shopRetailer}
              <ExternalLink className="h-4 w-4" />
            </a>
          )}

          {/* Description */}
          <div>
            <h3 className="font-serif text-lg font-semibold mb-2">About</h3>
            <p className="text-sm leading-relaxed text-foreground/90">
              {product.description}
            </p>
          </div>

          {/* Good For */}
          <div>
            <h3 className="font-serif text-lg font-semibold mb-2">
              Good For
            </h3>
            <p className="text-sm leading-relaxed text-foreground/90">
              {product.whatItsGoodFor}
            </p>
          </div>

          {/* Why Buy in France */}
          <div className="bg-primary/10 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Info className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="font-serif font-semibold text-primary mb-1">
                  Why Buy in France?
                </h3>
                <p className="text-sm leading-relaxed text-foreground/90">
                  {product.whyBuyInFrance}
                </p>
              </div>
            </div>
          </div>

          {/* US Availability */}
          {availabilityInfo && (
            <div className="border border-stone rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                    availabilityInfo.color === "green" && "bg-green-100",
                    availabilityInfo.color === "amber" && "bg-amber-100",
                    availabilityInfo.color === "red" && "bg-red-100"
                  )}
                >
                  {availabilityInfo.icon === "Check" && (
                    <Check className="h-4 w-4 text-green-600" />
                  )}
                  {availabilityInfo.icon === "AlertTriangle" && (
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  )}
                  {availabilityInfo.icon === "X" && (
                    <X className="h-4 w-4 text-red-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{availabilityInfo.label}</h3>
                  <p className="text-sm text-muted-foreground">
                    {availabilityInfo.description}
                  </p>
                  {product.usAvailability?.notes && (
                    <p className="text-sm text-foreground/90 mt-2">
                      {product.usAvailability.notes}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Key Ingredients */}
          {product.ingredients && product.ingredients.length > 0 && (
            <div>
              <h3 className="font-serif text-lg font-semibold mb-3">
                Key Ingredients
              </h3>
              <ul className="space-y-3">
                {product.ingredients.map((ingredient) => (
                  <li key={ingredient.id} className="flex gap-3">
                    <div
                      className={cn(
                        "flex-shrink-0 mt-0.5 w-6 h-6 rounded-full flex items-center justify-center",
                        ingredient.euOnlyFlag
                          ? "bg-primary/15 text-primary"
                          : "bg-stone-light text-foreground/60"
                      )}
                    >
                      <Beaker className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm flex items-center gap-2 flex-wrap">
                        {ingredient.name}
                        {ingredient.euOnlyFlag && (
                          <Badge variant="eu" className="text-[10px] px-1.5 py-0">
                            EU-only
                          </Badge>
                        )}
                      </p>
                      {ingredient.notes && (
                        <p className="text-sm text-muted-foreground leading-snug mt-0.5">
                          {ingredient.notes}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {product.ingredients.some((i) => i.euOnlyFlag) && (
                <p className="text-xs text-muted-foreground mt-3">
                  <Beaker className="h-3 w-3 inline mr-1" />
                  EU-only ingredients may not appear in US formulations.
                </p>
              )}
            </div>
          )}

          {/* Review Summary */}
          {product.reviewSummary && (
            <div className="bg-card rounded-lg p-4 shadow-card">
              <h3 className="font-serif text-lg font-semibold mb-2">
                What People Say
              </h3>
              <p className="text-sm leading-relaxed text-foreground/90 italic">
                &quot;{product.reviewSummary.aiSummaryText}&quot;
              </p>
              <p className="text-xs text-muted-foreground mt-2 capitalize">
                — {product.reviewSummary.sourceType} reviews
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer Disclaimer */}
      <footer className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 text-center">
        <p className="text-xs text-muted-foreground">
          Prices are approximate. Product availability may vary.
          <br />
          Not medical advice.
        </p>
      </footer>
    </div>
  );
}

// Loading skeleton
function ProductDetailSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-stone">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <Skeleton className="h-3 w-20 mb-1" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto lg:grid lg:grid-cols-2 lg:gap-8 lg:px-8 lg:py-6">
        <Skeleton className="aspect-square lg:rounded-lg" />
        <div className="px-4 py-6 space-y-6">
          <div>
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-full mb-1" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-24 w-full rounded-lg" />
          <div>
            <Skeleton className="h-6 w-20 mb-2" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </main>
    </div>
  );
}
