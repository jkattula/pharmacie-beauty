"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full font-mono uppercase tracking-[0.18em] text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-ink text-bone hover:bg-ink2",
        secondary: "border border-ink text-ink bg-transparent hover:bg-bone",
        accent: "bg-accent text-accent-foreground hover:opacity-90",
        ghost: "text-ink hover:bg-cream",
        link: "text-ink underline underline-offset-4 hover:opacity-70 px-0 h-auto tracking-[0.18em]",
        destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
      },
      size: {
        sm:      "h-9 px-4",
        default: "h-11 px-6",
        lg:      "h-12 px-8",
        icon:    "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
