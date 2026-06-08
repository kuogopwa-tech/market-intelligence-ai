import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          950: "#050816",
          900: "#0B1223",
          800: "#121A2E",
        },
        text: {
          100: "#E6EEFF",
          300: "#A8B3CF",
          500: "#6C7897",
        },
        brand: {
          cyan: "#22D3EE",
          blue: "#3B82F6",
          purple: "#8B5CF6",
        },
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(31, 38, 135, 0.25)",
        glow: "0 0 0 1px rgba(34,211,238,.22), 0 0 26px rgba(59,130,246,.28)",
      },
      backdropBlur: {
        xs: "2px",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["SFMono-Regular", "ui-monospace", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 rgba(34,211,238,0.0), 0 0 0 rgba(59,130,246,0.0)" },
          "50%": { boxShadow: "0 0 18px rgba(34,211,238,0.28), 0 0 32px rgba(59,130,246,0.22)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0px)" },
        },
        "ticker-scroll": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "number-pop": {
          "0%": { transform: "scale(0.98)", opacity: "0.7" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "pulse-glow": "pulse-glow 2.2s ease-in-out infinite",
        shimmer: "shimmer 2.2s linear infinite",
        "slide-up": "slide-up 320ms ease-out both",
        "ticker-scroll": "ticker-scroll 18s linear infinite",
        "number-pop": "number-pop 260ms ease-out",
      },
    },
  },
  plugins: [],
} satisfies Config;
