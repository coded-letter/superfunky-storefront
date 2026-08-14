import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "./.tailwind/cms-content.html",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "\"Segoe UI\"", "sans-serif"],
        display: ["ui-rounded", "\"SF Pro Rounded\"", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "rgb(var(--brand-50) / <alpha-value>)",
          100: "rgb(var(--brand-100) / <alpha-value>)",
          200: "rgb(var(--brand-200) / <alpha-value>)",
          300: "rgb(var(--brand-300) / <alpha-value>)",
          400: "rgb(var(--brand-400) / <alpha-value>)",
          500: "rgb(var(--brand-500) / <alpha-value>)",
          600: "rgb(var(--brand-600) / <alpha-value>)",
          700: "rgb(var(--brand-700) / <alpha-value>)",
          800: "rgb(var(--brand-800) / <alpha-value>)",
          900: "rgb(var(--brand-900) / <alpha-value>)",
          950: "rgb(var(--brand-950) / <alpha-value>)",
        },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15, 15, 40, 0.04), 0 12px 32px -12px rgba(15, 15, 40, 0.12)",
        "soft-lg": "0 4px 12px rgba(15, 15, 40, 0.06), 0 24px 48px -16px rgba(15, 15, 40, 0.18)",
        glow: "0 0 0 1px rgb(var(--brand-500) / 0.15), 0 8px 24px -4px rgb(var(--brand-500) / 0.35)",
      },
      borderRadius: {
        sm: "calc(var(--theme-radius) * 0.25)",
        DEFAULT: "calc(var(--theme-radius) * 0.25)",
        md: "calc(var(--theme-radius) * 0.375)",
        lg: "calc(var(--theme-radius) * 0.5)",
        xl: "calc(var(--theme-radius) * 0.75)",
        "2xl": "var(--theme-radius)",
        "3xl": "calc(var(--theme-radius) * 1.5)",
        "4xl": "calc(var(--theme-radius) * 2)",
        /* Pill-shaped controls (segmented switches, icon-toggle buttons, auth/account
         * CTAs) still need to *look* fully rounded at the 16px default — but should
         * flatten toward the theme's square/sharp end as `--theme-radius` approaches 0,
         * same as every other themed surface. A multiplier this large always clips to a
         * true pill once the base radius is more than a few px (browsers cap
         * border-radius at 50% of the box's own size), while resolving to a hard square
         * corner at exactly 0 — so it stays a "pill" at any non-zero setting without
         * hard-coding an unthemed 9999px like `rounded-full` does. */
        control: "calc(var(--theme-radius) * 3)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, rgb(var(--brand-gradient-from)) 0%, rgb(var(--brand-gradient-to)) 100%)",
        "brand-gradient-soft":
          "linear-gradient(135deg, rgb(var(--brand-gradient-from) / 0.12) 0%, rgb(var(--brand-gradient-to) / 0.12) 100%)",
      },
      animation: {
        "fade-in": "fade-in 0.5s ease-out",
        "rise-in": "rise-in 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        "toast-in": "toast-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "rise-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "toast-in": {
          "0%": { opacity: "0", transform: "translateY(8px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
