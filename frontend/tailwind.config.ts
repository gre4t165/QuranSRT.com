import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#080B14",
        surface: "#0F1523",
        border: "#1E2A42",
        gold: {
          DEFAULT: "#C9A84C",
          light: "#E0C872",
          dark: "#A88A2E",
        },
        text: {
          primary: "#F5F5F0",
          secondary: "#A0A8B8",
          muted: "#6B7280",
        },
      },
      fontFamily: {
        heading: ["var(--font-amiri)", "serif"],
        body: ["var(--font-dm-sans)", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
