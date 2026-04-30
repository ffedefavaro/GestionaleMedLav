/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1B4F4A',
        sidebar: '#0F2E2B',
        accent: '#E8820C',
        tealAction: '#1D9E75',
        warmWhite: '#FAFAF8',
        anthracite: '#2D2D2D',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
