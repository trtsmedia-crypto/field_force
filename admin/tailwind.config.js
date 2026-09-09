/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0E1225', soft: '#171C33', line: '#262D4A' },
        indigo: { brand: '#4C5CE5', deep: '#3542B8', wash: '#EDEFFE' },
        duty: { DEFAULT: '#FF7A2F', wash: '#FFF0E6' },
        ok: { DEFAULT: '#19B47E', wash: '#E6F7F1' },
        warn: { DEFAULT: '#F2B441', wash: '#FDF4E1', ink: '#B07908' },
        bad: { DEFAULT: '#E5484D', wash: '#FDECEC' },
        canvas: '#F4F5FA',
        line: '#E4E7F2',
        body: '#141A2E',
        muted: '#6C748F',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      borderRadius: { xl2: '18px' },
    },
  },
  plugins: [],
};
