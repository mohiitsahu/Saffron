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
    },
  },
  plugins: [],
};

export default config;