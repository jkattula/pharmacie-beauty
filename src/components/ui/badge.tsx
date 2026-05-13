"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono uppercase text-[10px] tracking-[0.18em] leading-none transition-colors",
  {
    variants: {
      variant: {
        // Brand-book p.11 — four variants only
        default:     "border-ink/30 text-ink bg-transparent",
        nouveau:     "border-ink/30 text-ink bg-transparent",
        recommande:  "border-accent/40 text-accent bg-transparent",
        ordonnance:  "border-transparent bg-accent text-accent-foreground",
        outline:     "border-ink/30 text-ink bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /** Leading dot mark — used for nouveau/recommandé/ordonnance */
  dot?: boolean;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  const showDot =
    dot ?? (variant === "nouveau" || variant === "recommande" || variant === "ordonnance");

  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {showDot && (
        <span
          aria-hidden="true"
          className={cn(
            "inline-block h-1.5 w-1.5 rounded-full",
            variant === "ordonnance" ? "bg-bone" : "bg-current"
          )}
        />
      )}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
