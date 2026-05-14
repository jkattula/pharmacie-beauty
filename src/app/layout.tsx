import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Cormorant_Garamond, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

const script = localFont({
  src: [
    { path: "../../public/fonts/Interlope-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/Interlope-Regular.woff",  weight: "400", style: "normal" },
  ],
  variable: "--font-script",
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
  themeColor: "#FDFBF5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${cormorant.variable} ${mono.variable} ${script.variable} font-serif antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
