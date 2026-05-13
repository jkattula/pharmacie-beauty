"use client";

import { Dot } from "@/components/ui/marks";
import { cn } from "@/lib/utils";
import { CURATED_CATEGORIES, type CuratedCategory } from "@/types";

interface CategoryChipsProps {
  selectedCategory: CuratedCategory | null;
  onCategorySelect: (category: CuratedCategory) => void;
  counts?: Record<CuratedCategory, number>;
  className?: string;
}

export function CategoryChips({
  selectedCategory,
  onCategorySelect,
  counts,
  className,
}: CategoryChipsProps) {
  return (
    <div className={cn("w-full", className)}>
      {/* Horizontal scroll on mobile; wrap & center on tablet+ */}
      <div className="flex gap-s-2 overflow-x-auto pb-s-2 scrollbar-hide -mx-s-4 px-s-4 sm:flex-wrap sm:justify-center sm:overflow-visible sm:mx-0 sm:px-0">
        {(Object.keys(CURATED_CATEGORIES) as CuratedCategory[]).map((category) => {
          const isSelected = selectedCategory === category;
          const count = counts?.[category];

          return (
            <button
              key={category}
              onClick={() => onCategorySelect(category)}
              data-selected={isSelected}
              className={cn(
                "inline-flex items-center gap-s-2 px-s-4 py-s-2 rounded-full border font-mono uppercase tracking-[0.18em] text-[11px] whitespace-nowrap shrink-0 transition-colors touch-target",
                isSelected
                  ? "bg-ink text-bone border-ink"
                  : "bg-cream text-ink border-border hover:border-ink/40"
              )}
            >
              <Dot
                size={6}
                className={isSelected ? "text-bone" : "text-ink/60"}
              />
              <span>{CURATED_CATEGORIES[category].label}</span>
              {count !== undefined && count > 0 && (
                <span
                  className={cn(
                    "ml-s-1 text-[10px] tracking-normal",
                    isSelected ? "text-bone/70" : "text-ink3"
                  )}
                >
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
