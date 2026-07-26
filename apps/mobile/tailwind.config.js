/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: "class", // <-- Add this
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#2563EB",
        "primary-dark": "#1D4ED8",
        secondary: "#7C3AED",
        success: "#22C55E",
        warning: "#F59E0B",
        danger: "#EF4444",
        background: "#F8FAFC",
        surface: "#FFFFFF",
        border: "#E2E8F0",
        text: "#0F172A",
        "text-secondary": "#64748B",
        placeholder: "#94A3B8",
        disabled: "#CBD5E1",
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "16px",
        xl: "24px",
        full: "999px",
      },
      fontSize: {
        h1: "32px",
        h2: "28px",
        h3: "24px",
        title: "20px",
        body: "16px",
        caption: "14px",
        small: "12px",
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        xxl: "40px",
      },
    },
  },
  plugins: [],
};