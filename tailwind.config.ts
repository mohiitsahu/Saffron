import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      // The color names are kept from the earlier palette so every page keeps working.
      colors: {
        // Page background and card surfaces: a lighter tint of the palette's sand.
        cream: "#F7F2E6",
        // Chips and panels: the palette's sand.
        sage: "#E8DCC4",
        // Primary buttons and links: the palette's teal green.
        leaf: "#2A6B5C",
        // Accent and logo: the palette's gold.
        saffron: "#C49A45",
        // Navbar, hero and footer: the palette's deep green.
        forest: "#123F36",
        // Text. A touch darker than forest so text on gold stays readable.
        ink: "#0F332C",
        danger: "#B3261E",
      },
      fontFamily: {
        heading: ["var(--font-heading)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      // Soft shadows tinted with the deep green instead of plain black.
      boxShadow: {
        soft: "0 1px 2px rgba(15, 51, 44, 0.06), 0 6px 16px -6px rgba(15, 51, 44, 0.12)",
        lift: "0 2px 4px rgba(15, 51, 44, 0.06), 0 18px 36px -14px rgba(15, 51, 44, 0.28)",
      },
      // Subtle motion. Every animation fills "backwards" only, so once it ends the element goes
      // back to its normal style (no leftover transform that could affect sticky or fixed children).
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "page-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-down": {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pop: {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.3)" },
          "100%": { transform: "scale(1)" },
        },
        float: {
          "0%, 100%": { transform: "translate3d(0, 0, 0)" },
          "50%": { transform: "translate3d(0, -16px, 0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) backwards",
        "page-in": "page-in 0.4s ease-out backwards",
        "fade-in": "fade-in 0.4s ease-out backwards",
        "scale-in": "scale-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) backwards",
        "slide-down": "slide-down 0.22s cubic-bezier(0.22, 1, 0.36, 1) backwards",
        pop: "pop 0.35s ease-out",
        float: "float 10s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;