import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f7ff',
          100: '#dfeeff',
          200: '#b8ddff',
          300: '#79c2ff',
          400: '#32a3ff',
          500: '#0784f3',
          600: '#0066d0',
          700: '#0052a8',
          800: '#03468b',
          900: '#093b73',
          950: '#06264c',
        },
        accent: {
          50: '#fff8ed',
          100: '#ffefd4',
          200: '#ffdba8',
          300: '#ffc170',
          400: '#ff9c37',
          500: '#ff7f10',
          600: '#f06306',
          700: '#c74a07',
          800: '#9e3a0e',
          900: '#7f320f',
          950: '#451705',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
