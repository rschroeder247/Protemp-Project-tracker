import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        bg: {
          light: "#eef1f4",
          dark: "#11161c",
        },
        surface: {
          light: "#ffffff",
          dark: "#1a2129",
        },
        fg: {
          light: "#16202b",
          dark: "#e8edf2",
        },
        muted: {
          light: "#5f6b78",
          dark: "#98a4b1",
        },
        line: {
          light: "#d8dee5",
          dark: "#2b3540",
        },
        accent: {
          light: "#1d5fa8",
          dark: "#6ea8ec",
        },
        done: {
          light: "#1f7a46",
          dark: "#5ccb8a",
        },
        warn: {
          light: "#b42318",
          dark: "#f2867b",
        },
      },
    },
  },
  plugins: [],
};
export default config;
