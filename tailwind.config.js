/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        mono: ['"Space Mono"', 'monospace'],
      },
      opacity: {
        '85': '0.85',
        '96': '0.96',
        '98': '0.98',
      },
      colors: {
        lunar: {
          dark: '#060B13',
          card: '#0D1726',
          border: '#16283C',
          accent: '#00D2C4',
          cyan: '#06B6D4',
          teal: '#14B8A6',
          sage: '#34D399',
          gold: '#38BDF8',
          cream: '#F1F5F9',
          regolith: '#94A3B8',
        },
        // Clean, aerospace greenish-blue (cyan/teal) & cool deep space slate system
        slate: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          850: '#152238',
          900: '#0F172A',
          950: '#060B13',
        },
        cyan: {
          50: '#ECFEFF',
          100: '#CFFAFE',
          200: '#A5F3FC',
          300: '#67E8F9',
          400: '#00D2C4', // Greenish-blue signature
          500: '#06B6D4',
          600: '#0891B2',
          700: '#0E7490',
          800: '#155E75',
          850: '#114A5C',
          900: '#164E63',
          950: '#082F49',
        },
        emerald: {
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          900: '#064E3B',
          950: '#022C22',
        },
      },
    },
  },
  plugins: [],
};
