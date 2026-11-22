/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Satoshi"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Satoshi"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        surface: {
          50: '#f5f6f7',
          100: '#eceef0',
          200: '#d4d7dd',
          700: '#353941',
          800: '#25282e',
          850: '#1e2126',
          900: '#1b1d21',
          950: '#17191c',
        },
        secondary: {
          DEFAULT: '#858990',
          light: '#b4b8bf',
          muted: '#595d64',
        },
        accent: {
          DEFAULT: '#858990',
          light: '#b4b8bf',
          muted: '#595d64',
        },
      },
    },
  },
  plugins: [],
};
