/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Map existing hardcoded colors
        'dark1': '#04151f',
        'dark2': '#082441',
        'accent': '#c0771f',
        'abyss': '#cdd2d6',
        'foreground': '#ecebe4',
      },
    },
  },
  plugins: [],
}
