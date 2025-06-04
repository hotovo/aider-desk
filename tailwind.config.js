const defaultTheme = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-family-sans)', 'Sono', ...defaultTheme.fontFamily.sans],
        mono: ['var(--font-family-mono)', 'Sono', ...defaultTheme.fontFamily.mono],
      },
      colors: {
        text: {
          error: '#e16b6b',
        },
        neutral: {
          50: '#f8f9fa',
          100: '#f1f3f5',
          200: '#999ba3',
          300: '#8c8e95',
          400: '#7b7d86',
          500: '#585c75',
          600: '#3d4166',
          700: '#333652',
          800: '#2a2c3f',
          850: '#222431',
          900: '#191a22',
          950: '#141417',
        },
        gray: {
          50: '#f8f9fa',    // Lightest, almost white
          100: '#f1f3f5',   // Very light gray
          200: '#e9ecef',   // Light gray
          300: '#dee2e6',   // Soft gray
          400: '#ced4da',   // Medium light gray
          500: '#adb5bd',   // Medium gray
          600: '#6c757d',   // Muted gray
          700: '#495057',   // Dark muted gray
          800: '#343a40',   // Very dark gray
          900: '#252a30',   // Darkest gray, almost black
          950: '#18181b',   // Ultra dark, near black
        }
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        'subtle': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'medium': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
      transitionProperty: {
        'colors': 'color, background-color, border-color, text-decoration-color, fill, stroke',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
      },
      backgroundImage: {
        'slider-track': 'linear-gradient(to right, var(--slider-filled-color) 0%, var(--slider-filled-color) var(--slider-percentage), var(--slider-empty-color) var(--slider-percentage), var(--slider-empty-color) 100%)',
      },
    },
    fontSize: {
      '3xs': '0.65rem',
      '2xs': '0.7rem',
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
      '5xl': '3rem',
      '6xl': '3.75rem',
      '7xl': '4.5rem',
    }
  },
  plugins: [
    require('tailwind-scrollbar')({ nocompatible: true }),
    function({ addBase, theme }) {
      const extractColorVars = (colorObj, colorGroup = '') => {
        return Object.keys(colorObj).reduce((vars, colorKey) => {
          const value = colorObj[colorKey];

          const newVars = typeof value === 'string'
            ? { [`--tw-color${colorGroup}-${colorKey}`]: value }
            : extractColorVars(value, `-${colorKey}`);

          return { ...vars, ...newVars };
        }, {});
      };

      addBase({
        ':root': extractColorVars(theme('colors')),
      });
    },
    require('@tailwindcss/typography'),
  ],
};
