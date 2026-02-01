import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Custom color palette from design guidelines
      colors: {
        // Core brand colors
        background: {
          DEFAULT: "#F6F4F1", // Warm off-white
          dark: "#1a1a1a",
        },
        foreground: {
          DEFAULT: "#2B2E2E", // Slate text
          dark: "#f5f5f5",
        },
        // Stone tones for borders and muted elements
        stone: {
          DEFAULT: "#D8D3C8",
          light: "#E8E4DC",
          dark: "#C5BFB3",
        },
        // Primary olive accent
        primary: {
          DEFAULT: "#8A927C",
          foreground: "#FFFFFF",
          hover: "#7A8269",
          light: "#A5AC9A",
        },
        // Secondary/muted colors
        muted: {
          DEFAULT: "#F6F4F1",
          foreground: "#6B7280",
        },
        // Accent gold (use sparingly)
        accent: {
          DEFAULT: "#D4A853",
          foreground: "#FFFFFF",
        },
        // Status colors
        success: "#4CAF50",
        warning: "#FF9800",
        error: "#EF5350",
        // Card and input backgrounds
        card: {
          DEFAULT: "#FFFFFF",
          dark: "#242424",
        },
        border: {
          DEFAULT: "#D8D3C8",
          dark: "#333333",
        },
      },
      // Typography using Playfair Display + Inter
      fontFamily: {
        serif: ["Playfair Display", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      // Border radius
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
        full: "9999px",
      },
      // Shadows
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)',
        'elevated': '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
      },
      // Animations
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
