import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#10B981",
          dark: "#059669",
          soft: "#D1FAE5",
        },
        ink: "#0F172A",
        muted: "#64748B",
        line: "#E2E8F0",
        page: "#F8FAFC",
        surface: "#FFFFFF",
        warn: "#F59E0B",
        danger: "#EF4444",
        info: "#3B82F6",
        ok: "#22C55E",
      },
      borderRadius: {
        "4": "4px",
        "8": "8px",
        "12": "12px",
        "16": "16px",
        "20": "20px",
      },
    },
  },
  plugins: [],
};
export default config;
