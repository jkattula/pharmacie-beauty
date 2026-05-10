"use client";

import Image from "next/image";
import { Star, MapPin, Sparkles, Tag, Check, AlertTriangle, X, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatPriceEur, formatPriceUsd, calculateSavings, getProductImageUrl } from "@/lib/utils";
import type { ProductCard as ProductCardType } from "@/types";

interface ProductCardProps {
  product: ProductCardType;
  onClick?: () => void;
  className?: string;
}

export function ProductCard({ product, onClick, className }: ProductCardProps) {
  const notSoldInUs = product.availabilityStatus === "not_available";
  const savings = notSoldInUs
    ? null
    : calculateSavings(product.priceEurMin, product.priceUsdEstimate);

  // Determine which badges to show (max 2 to avoid clutter)
  const badges: Array<{ type: string; icon: React.ElementType; variant: "cult" | "trending" | "france" | "deal" }> = [];

  if (product.cultFavoriteFlag) {
    badges.push({ type: "Cult Favorite", icon: Star, variant: "cult" });
  }
  if (product.tiktokTrendingFlag) {
    badges.push({ type: "Trending", icon: Sparkles, variant: "trending" });
  }
  if (product.franceOnlyFlag) {
    badges.push({ type: "France Only", icon: MapPin, variant: "france" });
  }
  if (product.dealFlag && !badges.length) {
    badges.push({ type: "Great Deal", icon: Tag, variant: "deal" });
  }

  const visibleBadges = badges.slice(0, 2);

  // Availability icon
  const AvailabilityIcon = () => {
    switch (product.availabilityStatus) {
      case "same_formula":
        return <Check className="h-3 w-3 text-green-600" />;
      case "reformulated":
        return <AlertTriangle className="h-3 w-3 text-amber-600" />;
      case "not_available":
        return <X className="h-3 w-3 text-red-600" />;
      default:
        return null;
    }
  };

  return (
    <article
      onClick={onClick}
      className={cn(
        "group relative flex flex-col bg-card rounded-lg overflow-hidden shadow-card card-hover cursor-pointer",
        className
      )}
    >
      {/* Image Container */}
      <div className="relative aspect-square bg-stone-light overflow-hidden">
        <Image
          src={getProductImageUrl(product.imageUrl, product.name)}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 50vw, 33vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* Badges overlay */}
        {visibleBadges.length > 0 && (
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {visibleBadges.map((badge, idx) => (
              <Badge key={idx} variant={badge.variant} className="text-[10px] px-2 py-0.5">
                <badge.icon className="h-3 w-3 mr-1" />
                {badge.type}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-3">
        {/* Brand Name */}
        <p className="text-xs font-serif text-muted-foreground uppercase tracking-wide">
          {product.brandName}
        </p>

        {/* Product Name */}
        <h3 className="font-medium text-sm mt-1 line-clamp-2 leading-tight">
          {product.name}
        </h3>

        {/* Description */}
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-snug">
          {product.whatItsGoodFor}
        </p>

        {/* Price & Availability */}
        <div className="mt-auto pt-3 space-y-1">
          {/* Price Row */}
          <div className="flex items-baseline justify-between">
            <span className="font-semibold text-primary">
              {formatPriceEur(product.priceEurMin, product.priceEurMax)}
            </span>
            {savings && savings > 0 && (
              <span className="text-xs text-green-600 font-medium">
                Save ~{savings}%
              </span>
            )}
          </div>

          {/* US Price & Availability */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {notSoldInUs ? "Not sold in US" : formatPriceUsd(product.priceUsdEstimate)}
            </span>
            {product.availabilityStatus && (
              <span className="flex items-center gap-1">
                <AvailabilityIcon />
                <span>
                  {product.availabilityStatus === "same_formula" && "In US"}
                  {product.availabilityStatus === "reformulated" && "Different US formula"}
                  {product.availabilityStatus === "not_available" && "France Only"}
                </span>
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
              className="mt-2 flex items-center justify-center gap-1 text-xs font-medium text-primary hover:text-primary/80 hover:underline"
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
