"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Cross, Seal, Dot, Rule, Frame } from "@/components/ui/marks";
import { cn, formatPriceEur, formatPriceUsd, calculateSavings, getProductImageUrl } from "@/lib/utils";
import type { ProductWithDetails } from "@/types";
import { AVAILABILITY_STATUS } from "@/types";

type BadgeVariant = "nouveau" | "recommande" | "ordonnance" | "default";

const AVAILABILITY_ICONS: Record<string, typeof Cross> = {
  Check: Cross,
  AlertTriangle: Seal,
  X: Dot,
};

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
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-s-5">
        <div className="text-center">
          <p className="label mb-s-3">— Not found —</p>
          <h2 className="font-serif text-2xl text-ink mb-s-3 font-medium">Product not found</h2>
          <p className="font-serif text-ink3 mb-s-5">
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

  // Map flags to brand-book badge variants
  const flagBadges: Array<{ label: string; variant: BadgeVariant }> = [];
  if (product.tiktokTrendingFlag) flagBadges.push({ label: "Trending", variant: "nouveau" });
  if (product.cultFavoriteFlag) flagBadges.push({ label: "Cult Favorite", variant: "recommande" });
  if (product.franceOnlyFlag) flagBadges.push({ label: "France Only", variant: "ordonnance" });
  if (product.dealFlag) flagBadges.push({ label: "Great Deal", variant: "default" });

  return (
    <div className="min-h-screen bg-background pb-s-9">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="max-w-6xl mx-auto px-s-4 sm:px-s-5 lg:px-s-7 py-s-3 flex items-center gap-s-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="label">
              {product.brand.name}
            </p>
            <h1 className="font-serif text-ink text-base truncate">{product.name}</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto lg:grid lg:grid-cols-2 lg:gap-s-8 lg:px-s-7 lg:py-s-6">
        {/* Product Image */}
        <div className="relative aspect-square image-placeholder lg:rounded-md lg:overflow-hidden lg:sticky lg:top-20 lg:self-start">
          <Image
            src={getProductImageUrl(product.imageUrl, product.name)}
            alt={product.name}
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />

          {/* Badges */}
          {flagBadges.length > 0 && (
            <div className="absolute top-s-4 left-s-4 flex flex-col gap-s-2">
              {flagBadges.map((badge) => (
                <Badge key={badge.label} variant={badge.variant}>
                  {badge.label}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="px-s-4 py-s-6 space-y-s-6 lg:px-0 lg:py-0">
          {/* Title & Brand */}
          <div>
            <p className="label">
              {product.brand.name}
            </p>
            <h2 className="font-serif text-ink text-3xl mt-s-2 leading-tight font-medium">
              {product.name}
            </h2>
            <p className="font-serif text-ink3 text-sm mt-s-1 capitalize">
              {product.category}
            </p>
          </div>

          {/* Price Section */}
          <div className="border border-border rounded-md p-s-5 bg-cream">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="font-mono text-2xl text-ink">
                  {formatPriceEur(
                    product.price?.priceEurMin ?? null,
                    product.price?.priceEurMax ?? null
                  )}
                </p>
                <p className="label mt-s-1">In French pharmacies</p>
              </div>
              {notSoldInUs ? (
                <div className="text-right">
                  <p className="label">Not sold in US</p>
                </div>
              ) : (
                savings && savings > 0 && (
                  <div className="text-right">
                    <p className="font-mono uppercase tracking-[0.18em] text-sm text-accent">
                      Save ~{savings}%
                    </p>
                    <p className="font-serif text-base text-ink2 mt-s-1">
                      vs {formatPriceUsd(product.price?.priceUsdEstimate ?? null)}
                      {product.usAvailability?.availabilityStatus === "reformulated" && (
                        <span className="block text-sm text-ink3">(different US formula)</span>
                      )}
                    </p>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="label mb-s-2">— About —</h3>
            <p className="font-serif text-ink text-[17px] leading-[1.55]">
              {product.description}
            </p>
          </div>

          {/* Good For */}
          <div>
            <h3 className="label mb-s-2">— Good for —</h3>
            <p className="font-serif text-ink text-[17px] leading-[1.55]">
              {product.whatItsGoodFor}
            </p>
          </div>

          {/* Why Buy in France */}
          <div className="border-l-2 border-accent pl-s-5 py-s-2">
            <h3 className="label text-accent mb-s-2">— Why buy in France —</h3>
            <p className="font-serif text-ink text-[17px] leading-[1.55]">
              {product.whyBuyInFrance}
            </p>
          </div>

          {/* US Availability */}
          {availabilityInfo && (
            <div className="border border-border rounded-md p-s-5">
              <div className="flex items-start gap-s-4">
                <div className="flex-shrink-0 text-ink2 mt-s-1">
                  {(() => {
                    const Icon = AVAILABILITY_ICONS[availabilityInfo.icon] ?? Dot;
                    return <Icon size={20} />;
                  })()}
                </div>
                <div className="flex-1">
                  <h3 className="font-serif text-ink text-lg font-medium">{availabilityInfo.label}</h3>
                  <p className="font-serif text-ink3 text-sm leading-[1.55] mt-s-1">
                    {availabilityInfo.description}
                  </p>
                  {product.usAvailability?.notes && (
                    <p className="font-serif text-ink text-sm leading-[1.55] mt-s-2">
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
              <h3 className="label mb-s-4">— Key ingredients —</h3>
              <ul className="space-y-s-4">
                {product.ingredients.map((ingredient) => (
                  <li key={ingredient.id} className="flex gap-s-3">
                    <div
                      className={cn(
                        "flex-shrink-0 mt-s-1",
                        ingredient.euOnlyFlag ? "text-accent" : "text-ink3"
                      )}
                    >
                      {ingredient.euOnlyFlag ? <Frame size={14} /> : <Dot size={10} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-serif text-ink text-base font-medium flex items-center gap-s-2 flex-wrap">
                        {ingredient.name}
                        {ingredient.euOnlyFlag && (
                          <Badge variant="recommande">EU-only</Badge>
                        )}
                      </p>
                      {ingredient.notes && (
                        <p className="font-serif text-ink3 text-sm leading-[1.55] mt-s-1">
                          {ingredient.notes}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {product.ingredients.some((i) => i.euOnlyFlag) && (
                <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-ink3 mt-s-4">
                  EU-only ingredients may not appear in US formulations.
                </p>
              )}
            </div>
          )}

          {/* Review Summary */}
          {product.reviewSummary && (
            <div className="border border-border rounded-md p-s-5 bg-cream">
              <h3 className="label mb-s-3">— What people say —</h3>
              <p className="font-serif text-ink text-[17px] leading-[1.55]">
                &ldquo;{product.reviewSummary.aiSummaryText}&rdquo;
              </p>
              <p className="label mt-s-3 normal-case">
                — {product.reviewSummary.sourceType} reviews
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer Disclaimer */}
      <footer className="max-w-6xl mx-auto px-s-4 sm:px-s-5 lg:px-s-7 py-s-5 text-center">
        <div className="flex justify-center text-ink3 mb-s-3">
          <Rule size={24} />
        </div>
        <p className="font-serif text-sm text-ink3 leading-relaxed">
          Prices are approximate. Product availability may vary.
          <br />
          Not medical advice.
        </p>
      </footer>
    </div>
  );
}

function ProductDetailSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="max-w-6xl mx-auto px-s-4 sm:px-s-5 lg:px-s-7 py-s-3 flex items-center gap-s-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <Skeleton className="h-3 w-20 mb-s-1" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto lg:grid lg:grid-cols-2 lg:gap-s-8 lg:px-s-7 lg:py-s-6">
        <Skeleton className="aspect-square lg:rounded-md" />
        <div className="px-s-4 py-s-6 space-y-s-6">
          <div>
            <Skeleton className="h-4 w-24 mb-s-2" />
            <Skeleton className="h-8 w-full mb-s-1" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-24 w-full rounded-md" />
          <div>
            <Skeleton className="h-6 w-20 mb-s-2" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </main>
    </div>
  );
}
