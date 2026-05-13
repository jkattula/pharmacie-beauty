import { cn } from "@/lib/utils";

interface MarkProps {
  className?: string;
  size?: number;
}

const baseSvg = (size: number, className: string | undefined) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  className: cn("inline-block shrink-0", className),
  "aria-hidden": true as const,
});

// Pharmacy cross — solid plus, the brand book's primary mark
export function Cross({ size = 16, className }: MarkProps) {
  return (
    <svg {...baseSvg(size, className)}>
      <path
        d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

// Apothecary seal — concentric circles
export function Seal({ size = 16, className }: MarkProps) {
  return (
    <svg {...baseSvg(size, className)}>
      <circle cx="12" cy="12" r="9" strokeWidth="1.25" />
      <circle cx="12" cy="12" r="6.5" strokeWidth="1" />
    </svg>
  );
}

// Ampersand — display glyph, set in serif italic so it renders as type
export function Ampersand({ size = 16, className }: MarkProps) {
  return (
    <span
      aria-hidden="true"
      style={{ fontSize: size, lineHeight: 1 }}
      className={cn("font-serif italic inline-block leading-none", className)}
    >
      &amp;
    </span>
  );
}

// Rule — short horizontal line with a centered dot, used as a divider
export function Rule({ size = 24, className }: MarkProps) {
  return (
    <svg {...baseSvg(size, className)} viewBox="0 0 48 24">
      <line x1="4" y1="12" x2="44" y2="12" strokeWidth="1" />
      <circle cx="24" cy="12" r="1.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Dot — single filled dot, used as a separator and a status indicator
export function Dot({ size = 8, className }: MarkProps) {
  return (
    <svg {...baseSvg(size, className)}>
      <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Frame — thin square, used to outline mono labels or wrap a numeral
export function Frame({ size = 16, className }: MarkProps) {
  return (
    <svg {...baseSvg(size, className)}>
      <rect x="4" y="4" width="16" height="16" strokeWidth="1.25" />
    </svg>
  );
}
