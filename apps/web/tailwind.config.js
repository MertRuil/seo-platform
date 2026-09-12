/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [

    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        calpeo: {
          blue: "#3157e5",
          "blue-hover": "#2546c7",
          teal: "#148b79",
          "teal-light": "#2dd4bf",
          paper: "#f3f0e8",
          "paper-card": "#fbfaf6",
          "paper-border": "#d7d2c7",
          ink: "#171714",
          muted: "#6f6d66",
          night: "#171817",
          "night-card": "#202120",
          "night-line": "#343633",
          "night-hover": "#292a28",
        },
      },
      fontFamily: {
        editorial: ["Georgia", "Times New Roman", "serif"],
      },
    },
  },
  plugins: [],
};

