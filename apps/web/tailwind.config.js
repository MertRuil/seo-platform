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
    fontSize: {
      "2xs": ["11px", { lineHeight: "16px" }],
      xs: ["12px", { lineHeight: "18px" }],
      sm: ["13px", { lineHeight: "20px" }],
      base: ["14px", { lineHeight: "22px" }],
      lg: ["16px", { lineHeight: "24px" }],
      xl: ["20px", { lineHeight: "28px" }],
      "2xl": ["24px", { lineHeight: "32px" }],
      "3xl": ["28px", { lineHeight: "34px" }],
      "4xl": ["34px", { lineHeight: "40px" }],
      "5xl": ["42px", { lineHeight: "46px" }],
    },
    // Üç yarıçap: 4 (chip, input), 8 (panel, tablo), 12 (modal)
    borderRadius: {
      none: "0",
      sm: "4px",
      DEFAULT: "4px",
      md: "8px",
      lg: "12px",
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
