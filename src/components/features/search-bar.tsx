"use client";

import { useState, useCallback } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  className?: string;
  isLoading?: boolean;
}

export function SearchBar({
  onSearch,
  placeholder = "Search for products...",
  className,
  isLoading = false,
}: SearchBarProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        onSearch(query.trim());
      }
    },
    [query, onSearch]
  );

  const handleClear = useCallback(() => {
    setQuery("");
    onSearch("");
  }, [onSearch]);

  return (
    <form onSubmit={handleSubmit} className={cn("relative", className)}>
      <div className="relative flex items-center">
        {/* Search Icon */}
        <Search
          className={cn(
            "absolute left-4 h-5 w-5 text-muted-foreground transition-colors",
            isLoading && "text-primary"
          )}
        />

        {/* Input Field */}
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "h-14 w-full rounded-full border-2 border-stone pl-12 pr-12 text-base",
            "placeholder:text-muted-foreground",
            "focus:border-primary focus:ring-0",
            "transition-all duration-200"
          )}
          disabled={isLoading}
        />

        {/* Clear Button (shown when there's text) */}
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="absolute right-14 h-8 w-8 rounded-full hover:bg-stone-light"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Clear search</span>
          </Button>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          size="icon"
          disabled={!query.trim() || isLoading}
          className={cn(
            "absolute right-2 h-10 w-10 rounded-full",
            "disabled:bg-stone disabled:text-muted-foreground"
          )}
        >
          <Search className="h-5 w-5" />
          <span className="sr-only">Search</span>
        </Button>
      </div>

      {/* Search suggestions hint */}
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Try: &quot;anti-aging eye cream&quot; or &quot;best French sunscreen&quot;
      </p>
    </form>
  );
}
