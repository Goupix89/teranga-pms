import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Terracotta — Primary (terre cuite, argile)
        primary: {
          50: '#F5DDD8',
          100: '#E8AFA5',
          200: '#E0917F',
          300: '#D4735E',
          400: '#C66150',
          500: '#B85042',
          600: '#A44539',
          700: '#8C3A30',
          800: '#6E2E26',
          900: '#5C2620',
          950: '#3D1915',
        },
        // Or ancestral — Accent (bijoux, couronnes)
        accent: {
          50: '#FBF3E0',
          100: '#F0D898',
          200: '#ECCE82',
          300: '#E8C97A',
          400: '#DCB465',
          500: '#D4A857',
          600: '#BF9540',
          700: '#A1801F',
          800: '#8B6E1E',
          900: '#5C4A14',
          950: '#3D3210',
        },
        // Sage — Secondary accent (nature, feuillage)
        sage: {
          50: '#D8E8DD',
          100: '#C5DCC9',
          200: '#B5D3BC',
          300: '#A7BEAE',
          400: '#8FAF9A',
          500: '#7A9E88',
          600: '#5E8A6E',
          700: '#4A7A5C',
          800: '#3A5E47',
          900: '#2D4A38',
          950: '#1E3326',
        },
        // Bois & Sable — Neutrals
        wood: {
          50: '#FAF8F2',
          100: '#F5F0E6',
          200: '#E7E8D1',
          300: '#D4CDB5',
          400: '#B5A88A',
          500: '#9C8B7E',
          600: '#6B5B4E',
          700: '#4A3728',
          800: '#2C2418',
          900: '#1A150E',
        },
      },
      fontFamily: {
        display: ['var(--font-playfair)', 'serif'],
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'teranga': '8px',
      },
    },
  },
  plugins: [],
};

export default config;
