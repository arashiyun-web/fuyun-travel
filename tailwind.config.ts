import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#071225",
          900: "#0b1f3a",
          800: "#12335f",
          700: "#184777"
        },
        gold: {
          500: "#c89b3c",
          400: "#d8b25d",
          100: "#f7ecd2"
        }
      },
      boxShadow: {
        soft: "0 18px 50px rgba(7, 18, 37, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
