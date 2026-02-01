import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Load fonts
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pharmacie Beauty | French Pharmacy Guide",
  description:
    "Your guide to French pharmacy beauty products. Discover cult favorites, exclusive formulas, and the best deals for US travelers in France.",
  keywords: [
    "French pharmacy",
    "skincare",
    "beauty",
    "La Roche-Posay",
    "Bioderma",
    "Avène",
    "French skincare",
    "travel",
    "France",
  ],
  authors: [{ name: "Pharmacie Beauty" }],
  openGraph: {
    title: "Pharmacie Beauty | French Pharmacy Guide",
    description:
      "Your AI-powered guide to French pharmacy beauty products for US travelers.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pharmacie Beauty",
    description: "Your guide to French pharmacy beauty products",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F4F1" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a1a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${playfair.variable} font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
