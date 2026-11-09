import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        kogi: {
          50: '#eefbf3', 100: '#d6f5e3', 200: '#b0eaca', 300: '#7bd8a9',
          400: '#45bf84', 500: '#1f9d63', 600: '#137e4f', 700: '#106441',
          800: '#105036', 900: '#0e422e', 950: '#05251a',
        },
        gold: {
          50: '#fdfbe9', 100: '#fbf7c5', 200: '#f8ed8e', 300: '#f4dc4e',
          400: '#eec61f', 500: '#dead12', 600: '#bf850d', 700: '#99600f',
          800: '#7f4c14', 900: '#6c3f16', 950: '#3f2009',
        },
      },
      fontFamily: { sans: ['var(--font-sans)', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
export default config;
