"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-stone text-foreground",
        destructive: "border-transparent bg-error text-white",
        outline: "text-foreground border-stone",
        // Special badges for product flags
        cult: "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
        trending: "border-transparent bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-100",
        france: "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
        deal: "border-transparent bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
        sunscreen: "border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
        // Availability status badges
        available: "border-transparent bg-green-100 text-green-800",
        reformulated: "border-transparent bg-amber-100 text-amber-800",
        unavailable: "border-transparent bg-red-100 text-red-800",
        // EU ingredient badge
        eu: "border-transparent bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
