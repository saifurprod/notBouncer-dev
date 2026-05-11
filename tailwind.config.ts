import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', "-apple-system", "BlinkMacSystemFont", "Segoe UI", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        display: ['"Inter"', "-apple-system", "BlinkMacSystemFont", "system-ui", "sans-serif"],
      },
      colors: {
        plum: {
          DEFAULT: "rgb(128, 71, 128)",
          deep: "rgb(103, 76, 103)",
          50: "rgb(245, 238, 245)",
          100: "rgb(233, 220, 233)",
          700: "rgb(99, 55, 99)",
        },
        canvas: {
          lavender: "rgb(217, 219, 240)",
          sand: "rgb(245, 241, 234)",
        },
        ink: {
          900: "rgb(41, 37, 36)",
          800: "rgb(68, 64, 60)",
          700: "rgb(87, 83, 78)",
          600: "rgb(120, 113, 108)",
          500: "rgb(168, 162, 158)",
          400: "rgb(214, 211, 209)",
        },
      },
      borderRadius: {
        "4xl": "32px",
        "3xl": "28px",
      },
      boxShadow: {
        glass: "0 4px 20px -4px rgba(0, 0, 0, 0.05)",
        card: "0 1px 2px 0 rgba(0,0,0,0.03), 0 1px 3px 0 rgba(0,0,0,0.05)",
        glow: "0 4px 6px -4px rgb(199, 210, 254), 0 10px 15px -3px rgb(199, 210, 254)",
        float: "0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.05)",
      },
      letterSpacing: {
        tightest: "-0.03em",
        tighter: "-0.02em",
      },
    },
  },
  plugins: [],
};

export default config;
