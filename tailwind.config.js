/** @type {import('tailwindcss').Config} */
export default {
  content: ["./app/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        idea: {
          50: "#fef3c7",
          100: "#fde68a",
          200: "#fcd34d",
          500: "#f59e0b",
          600: "#d97706",
        },
        vidit: {
          50: "#d1fae5",
          100: "#a7f3d0",
          200: "#6ee7b7",
          500: "#10b981",
          600: "#059669",
        },
      },
    },
  },
  plugins: [],
};
