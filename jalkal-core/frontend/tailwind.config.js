/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: '#FAF7F0',
        'cream-alt': '#F5F1E8',
        'card-bg': '#FFFFFF',
        text: {
          primary: '#111111',
          secondary: '#6B6B6B',
          muted: '#A3A3A3',
        },
        border: {
          light: '#ECE7DC',
          medium: '#DDD6C7',
        },
        accent: {
          orange: '#E8863A',
          'orange-light': '#FDF0E4',
          black: '#111111',
        },
        status: {
          success: {
            bg: '#E7F5EE',
            text: '#1E8E5A',
          },
          warning: {
            bg: '#FDF0E4',
            text: '#E8863A',
          },
          error: {
            bg: '#FDEAEA',
            text: '#D64545',
          },
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Archivo Black', 'sans-serif'],
        serif: ['Fraunces', 'serif'],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        pill: '999px',
      },
    },
  },
  plugins: [],
};
