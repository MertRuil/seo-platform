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
      bg: "var(--bg)",
      surface: "var(--surface)",
      "surface-2": "var(--surface-2)",
      ink: "var(--ink)",
      muted: "var(--muted)",
      faint: "var(--faint)",
      line: "var(--line)",
      "line-strong": "var(--line-strong)",
      accent: {
        DEFAULT: "var(--accent)",
        fill: "var(--accent-fill)",
        hover: "var(--accent-hover)",
        ink: "var(--accent-ink)",
        soft: "var(--accent-soft)",
      },
      evidence: { DEFAULT: "var(--evidence)", soft: "var(--evidence-soft)" },
      warn: { DEFAULT: "var(--warn)", soft: "var(--warn-soft)" },
      critical: { DEFAULT: "var(--critical)", soft: "var(--critical-soft)" },
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
