/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#e8f0f8',
          100: '#ccd9ed',
          200: '#99b3db',
          300: '#6691c9',
          400: '#3d71b7',
          500: '#2c5f8a',
          600: '#244f76',
          700: '#1c3f60',
          800: '#143049',
          900: '#0c2033',
          950: '#06101a',
        },
        navy: {
          400: '#4a6fa5',
          500: '#345a8c',
          600: '#234264',
          700: '#1a334f',
          800: '#12253a',
          900: '#0d1b2a',
        },
        gold: {
          400: '#d4a017',
          500: '#b8860b',
          600: '#9a7209',
          700: '#7c5c07',
          800: '#5f4605',
        },
        stone: {
          50:  '#fdfcf8',
          100: '#f5f2eb',
          200: '#ece8df',
          300: '#d8d0c0',
          400: '#b0a898',
          500: '#8a7e6e',
          600: '#6b6355',
          700: '#4d4840',
          800: '#302d28',
          900: '#1c1a16',
        },
        success: '#276749',
        danger:  '#8b2c2c',
        warn:    '#b8860b',
      },
      fontFamily: {
        display: ['"Libre Baskerville"', 'Georgia', '"Times New Roman"', 'serif'],
        body:    ['"Source Sans 3"', 'Georgia', 'serif'],
        mono:    ['"Source Code Pro"', '"Courier New"', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,.08), 0 4px 12px 0 rgba(0,0,0,.05)',
        glow: '0 0 16px rgba(44,95,138,.20)',
      },
      animation: {
        'fade-in':    'fadeIn 0.25s ease-in-out',
        'slide-up':   'slideUp 0.35s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideUp:   { from: { opacity: '0', transform: 'translateY(14px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        pulseSoft: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.6' } },
      },
    },
  },
  plugins: [],
}
