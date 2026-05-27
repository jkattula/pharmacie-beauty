"use client";

import Image from "next/image";
import { cn, formatPriceEur, formatPriceUsd, calculateSavings, getProductImageUrl } from "@/lib/utils";
import type { ProductCard as ProductCardType } from "@/types";

interface ProductCardProps {
  product: ProductCardType;
  onClick?: () => void;
  className?: string;
}

export function ProductCard({ product, onClick, className }: ProductCardProps) {
  const notSoldInUs = product.availabilityStatus === "not_available";
  const reformulated = product.availabilityStatus === "reformulated";
  const savings = notSoldInUs
    ? null
    : calculateSavings(product.priceEurMin, product.priceUsdEstimate);

  // Flags as inline text tags (replaces bulky pill badges).
  // "Trending" / tiktokTrendingFlag is intentionally omitted.
  const tags: string[] = [];
  if (product.cultFavoriteFlag) tags.push("Cult");
  if (product.franceOnlyFlag) tags.push("France Only");
  if (product.dealFlag && tags.length < 2) tags.push("Great Deal");

  // Status sits on its own line below the price so the EUR price never wraps.
  const statusText = reformulated
    ? "Different US formula"
    : notSoldInUs
      ? "Not sold in US"
      : null;

  const savingsText =
    !notSoldInUs && savings && savings > 0 ? `Save ~${savings}%` : null;
  const usdText =
    !notSoldInUs && !savingsText ? formatPriceUsd(product.priceUsdEstimate) : null;

  return (
    <article
      onClick={onClick}
      className={cn(
        "group relative flex flex-col bg-cream rounded-md overflow-hidden border border-border/60",
        onClick && "card-hover cursor-pointer",
        className
      )}
    >
      {/* Image Container — unobstructed for maximum product visibility */}
      <div className="relative aspect-square image-placeholder overflow-hidden">
        <Image
          src={getProductImageUrl(product.imageUrl, product.name)}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 50vw, 33vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-s-4">
        {/* Tags — single tight line of mono caps */}
        {tags.length > 0 && (
          <p className="font-mono uppercase tracking-[0.08em] text-[9px] text-accent leading-none truncate">
            {tags.join(" · ")}
          </p>
        )}

        <p className={cn("label", tags.length > 0 && "mt-s-1")}>
          {product.brandName}
        </p>

        {/* Product Name */}
        <h3 className="font-serif text-ink text-base mt-s-1 line-clamp-2 leading-snug font-medium">
          {product.name}
        </h3>

        {/* Description */}
        <p className="font-serif text-ink3 text-sm mt-s-1 line-clamp-2 leading-[1.55]">
          {product.whatItsGoodFor}
        </p>

        {/* Price block */}
        <div className="mt-auto pt-s-3">
          <div className="flex items-baseline justify-between gap-s-2">
            <span className="font-mono text-ink text-sm">
              {formatPriceEur(product.priceEurMin, product.priceEurMax)}
            </span>
            {savingsText && (
              <span className="font-mono uppercase tracking-[0.18em] text-[10px] text-accent">
                {savingsText}
              </span>
            )}
            {!savingsText && usdText && (
              <span className="font-mono text-ink3 text-[11px]">{usdText}</span>
            )}
          </div>
          {statusText && (
            <p className="mt-s-1 font-mono uppercase tracking-[0.18em] text-[10px] text-ink3">
              {statusText}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
