/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      opacity: {
        '85': '0.85',
        '96': '0.96',
        '98': '0.98',
      },
      colors: {
        lunar: {
          dark: '#0b0f19',
          card: '#131b2e',
          border: '#1e293b',
          accent: '#38bdf8',
          gold: '#f59e0b',
          regolith: '#94a3b8'
        }
      }
    },
  },
  plugins: [],
}
