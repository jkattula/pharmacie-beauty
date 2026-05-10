"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", label: "Browse" },
  { href: "/about", label: "About" },
];

interface SiteHeaderProps {
  /** When true, the title links back to the homepage. Default false (already on homepage). */
  linkTitle?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function SiteHeader({ linkTitle = false, className, children }: SiteHeaderProps) {
  const pathname = usePathname();

  const titleContent = (
    <>
      <h1 className="font-serif text-xl sm:text-2xl font-semibold text-foreground leading-tight">
        Pharmacie Beauty
      </h1>
      <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
        Your French pharmacy guide
      </p>
    </>
  );
  const titleClass = "text-center sm:text-left flex-1 sm:flex-initial";

  return (
    <header className={cn("sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-stone", className)}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top row: title + nav */}
        <div className="flex items-center justify-between py-3 sm:py-4">
          {linkTitle ? (
            <Link href="/" className={titleClass}>
              {titleContent}
            </Link>
          ) : (
            <div className={titleClass}>
              {titleContent}
            </div>
          )}

          <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href || (link.href !== "/" && pathname?.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-sm font-medium transition-colors touch-target",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/70 hover:text-foreground hover:bg-stone-light"
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
          <div className="pb-4 max-w-2xl mx-auto">
            {children}
          </div>
        )}
      </div>
    </header>
  );
}
