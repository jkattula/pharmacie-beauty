"use client";

import { Star, Tag, MapPin, Sparkles, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { CURATED_CATEGORIES, type CuratedCategory } from "@/types";

interface CategoryChipsProps {
  selectedCategory: CuratedCategory | null;
  onCategorySelect: (category: CuratedCategory) => void;
  counts?: Record<CuratedCategory, number>;
  className?: string;
}

const CATEGORY_ICONS: Record<CuratedCategory, React.ElementType> = {
  cult_favorites: Star,
  best_deals: Tag,
  france_only: MapPin,
  tiktok_trending: Sparkles,
  best_sunscreens: Sun,
};

const CATEGORY_COLORS: Record<CuratedCategory, string> = {
  cult_favorites: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 data-[selected=true]:bg-amber-600 data-[selected=true]:text-white data-[selected=true]:border-amber-600",
  best_deals: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100 data-[selected=true]:bg-green-600 data-[selected=true]:text-white data-[selected=true]:border-green-600",
  france_only: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 data-[selected=true]:bg-blue-600 data-[selected=true]:text-white data-[selected=true]:border-blue-600",
  tiktok_trending: "bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100 data-[selected=true]:bg-pink-600 data-[selected=true]:text-white data-[selected=true]:border-pink-600",
  best_sunscreens: "bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100 data-[selected=true]:bg-yellow-600 data-[selected=true]:text-white data-[selected=true]:border-yellow-600",
};

export function CategoryChips({
  selectedCategory,
  onCategorySelect,
  counts,
  className,
}: CategoryChipsProps) {
  return (
    <div className={cn("w-full", className)}>
      {/* Horizontal scroll on mobile; wrap & center on tablet+ */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:flex-wrap sm:justify-center sm:overflow-visible sm:mx-0 sm:px-0">
        {(Object.keys(CURATED_CATEGORIES) as CuratedCategory[]).map((category) => {
          const Icon = CATEGORY_ICONS[category];
          const isSelected = selectedCategory === category;
          const count = counts?.[category];

          return (
            <button
              key={category}
              onClick={() => onCategorySelect(category)}
              data-selected={isSelected}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium whitespace-nowrap shrink-0 transition-all duration-200",
                "touch-target",
                CATEGORY_COLORS[category]
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{CURATED_CATEGORIES[category].label}</span>
              {count !== undefined && count > 0 && (
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full",
                  isSelected ? "bg-white/20" : "bg-black/10"
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
