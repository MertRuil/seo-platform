// Yazı ve köşe ölçeği mobil uygulamayla ortak dosyadan gelir.
const tokens = require("../../packages/design-tokens/tokens.json");

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    // Renkler yalnızca globals.css'teki belirteçlerden gelir; ham hex sınıfı yazılmaz.
    colors: {
      transparent: "transparent",
      current: "currentColor",
      white: "#ffffff",
      black: "#000000",
      bg: "rgb(var(--bg) / <alpha-value>)",
      surface: "rgb(var(--surface) / <alpha-value>)",
      "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
      ink: "rgb(var(--ink) / <alpha-value>)",
      muted: "rgb(var(--muted) / <alpha-value>)",
      faint: "rgb(var(--faint) / <alpha-value>)",
      line: "rgb(var(--line) / <alpha-value>)",
      "line-strong": "rgb(var(--line-strong) / <alpha-value>)",
      accent: {
        DEFAULT: "rgb(var(--accent) / <alpha-value>)",
        fill: "rgb(var(--accent-fill) / <alpha-value>)",
        hover: "rgb(var(--accent-hover) / <alpha-value>)",
        ink: "rgb(var(--accent-ink) / <alpha-value>)",
        soft: "rgb(var(--accent-soft) / <alpha-value>)",
      },
      evidence: { DEFAULT: "rgb(var(--evidence) / <alpha-value>)", soft: "rgb(var(--evidence-soft) / <alpha-value>)" },
      warn: { DEFAULT: "rgb(var(--warn) / <alpha-value>)", soft: "rgb(var(--warn-soft) / <alpha-value>)" },
      critical: { DEFAULT: "rgb(var(--critical) / <alpha-value>)", soft: "rgb(var(--critical-soft) / <alpha-value>)" },
    },
    // Tip ölçeği: gövde 13 px, alt sınır 12 px; 11 px yalnızca mono etiketler için.
    fontSize: Object.fromEntries(
      Object.entries(tokens.fontSize).map(([name, [size, lineHeight]]) => [name, [`${size}px`, { lineHeight: `${lineHeight}px` }]])
    ),
    // Üç yarıçap: 4 (chip, input), 8 (panel, tablo), 12 (modal)
    borderRadius: {
      none: "0",
      sm: `${tokens.radius.sm}px`,
      DEFAULT: `${tokens.radius.sm}px`,
      md: `${tokens.radius.md}px`,
      lg: `${tokens.radius.lg}px`,
      full: "9999px",
    },
    // Gölge yalnızca açılır menü ve modal için
    boxShadow: {
      none: "none",
      pop: "var(--shadow-pop)",
    },
    extend: {
      fontFamily: {
        editorial: ["Georgia", "Times New Roman", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-in": { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(0)" } },
        shimmer: { from: { backgroundPosition: "200% 0" }, to: { backgroundPosition: "-200% 0" } },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "slide-in": "slide-in 200ms ease-out",
        shimmer: "shimmer 1.6s linear infinite",
      },
      spacing: {
        rail: "240px",
        "rail-sm": "64px",
      },
    },
  },
  plugins: [],
};
