import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1f2a24",
        moss: "#5f7a68",
        clay: "#b56b52",
        linen: "#f7f2ea",
        paper: "#fffdfa",
        ocean: "#406f82"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(36, 51, 43, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
