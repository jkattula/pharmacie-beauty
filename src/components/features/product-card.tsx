"use client";

import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Cross, Seal, Dot } from "@/components/ui/marks";
import { cn, formatPriceEur, formatPriceUsd, calculateSavings, getProductImageUrl } from "@/lib/utils";
import type { ProductCard as ProductCardType } from "@/types";

interface ProductCardProps {
  product: ProductCardType;
  onClick?: () => void;
  className?: string;
}

type BadgeVariant = "nouveau" | "recommande" | "ordonnance" | "default";

export function ProductCard({ product, onClick, className }: ProductCardProps) {
  const notSoldInUs = product.availabilityStatus === "not_available";
  const savings = notSoldInUs
    ? null
    : calculateSavings(product.priceEurMin, product.priceUsdEstimate);

  // Map product flags to brand-book badge variants (max 2)
  const badges: Array<{ label: string; variant: BadgeVariant }> = [];

  if (product.tiktokTrendingFlag) {
    badges.push({ label: "Trending", variant: "nouveau" });
  }
  if (product.cultFavoriteFlag) {
    badges.push({ label: "Cult Favorite", variant: "recommande" });
  }
  if (product.franceOnlyFlag) {
    badges.push({ label: "France Only", variant: "ordonnance" });
  }
  if (product.dealFlag && badges.length < 2) {
    badges.push({ label: "Great Deal", variant: "default" });
  }

  const visibleBadges = badges.slice(0, 2);

  // Availability — brand-book mark + mono label, no colored pill.
  // Suppress "same_formula" (the default) and "not_available" (already conveyed
  // by the "Not sold in US" line) to reduce visual noise on the card.
  const availability = (() => {
    switch (product.availabilityStatus) {
      case "reformulated":
        return { Icon: Seal, label: "Different US formula" };
      default:
        return null;
    }
  })();

  // Single secondary item on the price row: prefer "Not sold in US",
  // then a savings callout, then the USD estimate.
  const secondary = (() => {
    if (notSoldInUs) {
      return { text: "Not sold in US", tone: "muted" as const };
    }
    if (savings && savings > 0) {
      return { text: `Save ~${savings}%`, tone: "accent" as const };
    }
    const usd = formatPriceUsd(product.priceUsdEstimate);
    return usd ? { text: usd, tone: "muted" as const } : null;
  })();

  return (
    <article
      onClick={onClick}
      className={cn(
        "group relative flex flex-col bg-cream rounded-md overflow-hidden border border-border/60 card-hover cursor-pointer",
        className
      )}
    >
      {/* Image Container */}
      <div className="relative aspect-square image-placeholder overflow-hidden">
        <Image
          src={getProductImageUrl(product.imageUrl, product.name)}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 50vw, 33vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* Badges overlay */}
        {visibleBadges.length > 0 && (
          <div className="absolute top-s-2 left-s-2 flex flex-col gap-s-1">
            {visibleBadges.map((badge, idx) => (
              <Badge key={idx} variant={badge.variant}>
                {badge.label}
              </Badge>
            ))}
          </div>
        )}

        {/* Availability overlay — only shown for reformulated; bottom-left mirror */}
        {availability && (
          <div className="absolute bottom-s-2 left-s-2 inline-flex items-center gap-s-1 rounded-full bg-cream/90 backdrop-blur-sm px-s-2 py-s-1 font-mono uppercase tracking-[0.18em] text-[10px] text-ink2">
            <availability.Icon size={10} className="text-ink2" />
            <span>{availability.label}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-s-4">
        {/* Brand Name */}
        <p className="label">
          {product.brandName}
        </p>

        {/* Product Name */}
        <h3 className="font-serif text-ink text-base mt-s-2 line-clamp-2 leading-snug font-medium">
          {product.name}
        </h3>

        {/* Description */}
        <p className="font-serif text-ink3 text-sm mt-s-1 line-clamp-2 leading-[1.55]">
          {product.whatItsGoodFor}
        </p>

        {/* Price */}
        <div className="mt-auto pt-s-3">
          <div className="flex items-baseline justify-between gap-s-2">
            <span className="font-mono text-ink text-sm">
              {formatPriceEur(product.priceEurMin, product.priceEurMax)}
            </span>
            {secondary && (
              <span
                className={cn(
                  "font-mono uppercase tracking-[0.18em] text-[10px]",
                  secondary.tone === "accent" ? "text-accent" : "text-ink3"
                )}
              >
                {secondary.text}
              </span>
            )}
          </div>

          {/* Buy link */}
          {product.shopUrl && product.shopRetailer && (
            <a
              href={product.shopUrl}
              target="_blank"
              rel="noopener noreferrer sponsored"
              onClick={(e) => e.stopPropagation()}
              className="mt-s-3 flex items-center justify-center gap-s-1 font-mono uppercase tracking-[0.18em] text-[10px] text-ink hover:underline underline-offset-4"
            >
              Buy on {product.shopRetailer}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
