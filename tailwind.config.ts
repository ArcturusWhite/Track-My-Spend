import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#18231d",
        leaf: "#2f7d5c",
        mint: "#dff3e8",
        coral: "#f9735b",
        paper: "#fffaf1"
      }
    }
  },
  plugins: []
};

export default config;
