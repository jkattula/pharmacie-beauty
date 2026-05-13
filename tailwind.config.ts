import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces — warm paper neutrals (ivory)
        bone:  "#F5F1E8",   // legacy alias, now used for image placeholders only
        cream: "#FFFFFF",   // card surface (was #FAF7F1)
        paper: "#FAF7F1",   // softer ivory accent
        // Ink — text
        ink:   "#1A1410",
        ink2:  "#2A2018",
        ink3:  "#4A3F36",
        // Accents
        apothecary: "oklch(0.42 0.05 155)",
        blush:      "oklch(0.88 0.03 25)",
        // Semantic tokens — map to shadcn-style CSS vars in globals.css
        background: "#FDFBF5",
        foreground: "#1A1410",
        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#1A1410",
        },
        border: "#EAE3D2",
        input:  "#EAE3D2",
        ring:   "oklch(0.42 0.05 155)",
        muted: {
          DEFAULT: "#F5F1E8",
          foreground: "#4A3F36",
        },
        primary: {
          DEFAULT: "#1A1410",
          foreground: "#EFEAE0",
          hover: "#2A2018",
        },
        secondary: {
          DEFAULT: "transparent",
          foreground: "#1A1410",
        },
        accent: {
          DEFAULT: "oklch(0.42 0.05 155)",
          foreground: "#EFEAE0",
        },
        destructive: {
          DEFAULT: "#B5483A",
          foreground: "#FBF8F1",
        },
      },
      fontFamily: {
        script: ["var(--font-script)", "Pinyon Script", "Italianno", "cursive"],
        serif:  ["var(--font-cormorant)", "Cormorant Garamond", "Georgia", "serif"],
        mono:   ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
        sans:   ["var(--font-cormorant)", "Cormorant Garamond", "Georgia", "serif"],
      },
      borderRadius: {
        xs:   "3px",
        sm:   "6px",
        md:   "10px",
        lg:   "18px",
        full: "9999px",
      },
      spacing: {
        "s-1": "4px",
        "s-2": "8px",
        "s-3": "12px",
        "s-4": "16px",
        "s-5": "24px",
        "s-6": "32px",
        "s-7": "48px",
        "s-8": "64px",
        "s-9": "96px",
      },
      boxShadow: {
        card:         "0 1px 2px rgba(26,20,16,0.04)",
        "card-hover": "0 2px 6px rgba(26,20,16,0.06)",
        elevated:     "0 8px 24px rgba(26,20,16,0.08)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "fade-up": "fade-up 0.3s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        shimmer: "shimmer 2s infinite linear",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
