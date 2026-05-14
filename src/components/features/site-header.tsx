"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/ui/wordmark";

const NAV_LINKS = [
  { href: "/", label: "Browse" },
  { href: "/about", label: "About" },
];

interface SiteHeaderProps {
  className?: string;
  children?: React.ReactNode;
}

export function SiteHeader({ className, children }: SiteHeaderProps) {
  const pathname = usePathname();

  return (
    <header className={cn("sticky top-0 z-40 bg-background border-b border-border", className)}>
      <div className="max-w-7xl mx-auto px-s-4 sm:px-s-5 lg:px-s-7">
        {/* Top row: title + nav */}
        <div className="flex items-center justify-between py-s-3 sm:py-s-4">
          <Link href="/" aria-label="Pharmacie Beauty — home" className="flex-1 sm:flex-initial">
            <span className="flex items-baseline gap-s-3 text-ink">
              <Wordmark
                variant="monogram"
                className="text-[34px] sm:hidden"
              />
              <Wordmark
                variant="inline"
                className="hidden sm:inline-flex text-[28px] sm:text-[32px]"
              />
              <span className="label hidden md:inline-block">Your French pharmacy guide</span>
            </span>
          </Link>

          <nav aria-label="Primary" className="flex items-center gap-s-1">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href || (link.href !== "/" && pathname?.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-s-4 py-s-2 rounded-full font-mono uppercase tracking-[0.18em] text-[11px] transition-colors touch-target inline-flex items-center",
                    isActive
                      ? "bg-ink text-bone"
                      : "text-ink hover:bg-cream"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Optional children (e.g. search bar on home) */}
        {children && (
          <div className="pb-s-4 max-w-2xl mx-auto">
            {children}
          </div>
        )}
      </div>
    </header>
  );
}
