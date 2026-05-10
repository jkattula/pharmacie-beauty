import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format price in EUR
 */
export function formatPriceEur(min: number | null, max?: number | null): string {
  if (!min) return "Price varies";
  if (max && max !== min) {
    return `€${min.toFixed(0)}–€${max.toFixed(0)}`;
  }
  return `€${min.toFixed(0)}`;
}

/**
 * Format price in USD
 */
export function formatPriceUsd(price: number | null): string {
  if (!price) return "";
  return `~$${price.toFixed(0)} USD`;
}

/**
 * Calculate savings percentage
 */
export function calculateSavings(eurPrice: number | null, usdPrice: number | null): number | null {
  if (!eurPrice || !usdPrice || usdPrice <= 0) return null;
  // Approximate EUR to USD conversion (1 EUR ≈ 1.08 USD)
  const eurInUsd = eurPrice * 1.08;
  const savings = ((usdPrice - eurInUsd) / usdPrice) * 100;
  return savings > 0 ? Math.round(savings) : null;
}

/**
 * Get initials from a brand name
 */
export function getBrandInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Normalize text for search/comparison
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9\s]/g, "") // Remove special chars
    .trim();
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "...";
}

/**
 * Delay helper for loading states
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Safe JSON parse
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Generate a placeholder image URL based on product name
 */
export function getPlaceholderImage(productName: string): string {
  const encoded = encodeURIComponent(productName);
  return `https://placehold.co/400x400/F6F4F1/8A927C?text=${encoded}`;
}

/**
 * Transform a database image URL to the correct public path.
 * Handles old Replit paths (/attached_assets/...) and Supabase Storage URLs,
 * converting them to /images/products/... paths served by Vercel.
 */
export function getProductImageUrl(dbImageUrl: string | null, productName: string): string {
  if (!dbImageUrl) return getPlaceholderImage(productName);

  // If already a correct path, return as-is
  if (dbImageUrl.startsWith('/images/products/')) return dbImageUrl;

  // Extract filename from old paths
  let filename = '';

  if (dbImageUrl.includes('/attached_assets/generated_images/')) {
    filename = dbImageUrl.split('/attached_assets/generated_images/').pop() || '';
  } else if (dbImageUrl.includes('/product-images/')) {
    filename = dbImageUrl.split('/product-images/').pop() || '';
  } else {
    filename = dbImageUrl.split('/').pop() || '';
  }

  if (!filename) return getPlaceholderImage(productName);

  // Decode URI components first
  filename = decodeURIComponent(filename);

  // Normalize: remove accents, replace special chars
  const normalized = filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/\+/g, '_plus_')        // Replace +
    .replace(/[^a-zA-Z0-9_.\-]/g, '_'); // Replace other specials

  return `/images/products/${normalized}`;
}
