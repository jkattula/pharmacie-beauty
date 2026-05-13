import { cn } from "@/lib/utils";

type WordmarkVariant = "stacked" | "inline" | "monogram";

interface WordmarkProps {
  variant?: WordmarkVariant;
  className?: string;
}

export function Wordmark({ variant = "stacked", className }: WordmarkProps) {
  if (variant === "monogram") {
    return (
      <span
        aria-label="Pharmacie Beauty"
        className={cn("font-script leading-none", className)}
      >
        pb<span className="font-serif italic">.</span>
      </span>
    );
  }

  if (variant === "inline") {
    return (
      <span
        aria-label="Pharmacie Beauty"
        className={cn("font-script leading-none whitespace-nowrap", className)}
      >
        pharmacie beauty<span className="font-serif italic">.</span>
      </span>
    );
  }

  // stacked / canonical
  return (
    <span
      aria-label="Pharmacie Beauty"
      className={cn("font-script leading-[0.92] inline-flex flex-col", className)}
    >
      <span>pharmacie</span>
      <span className="pl-[0.6em]">
        beauty<span className="font-serif italic">.</span>
      </span>
    </span>
  );
}
