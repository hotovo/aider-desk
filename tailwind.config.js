const defaultTheme = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        // Theme-based colors
        bg: {
          primary: 'var(--color-bg-primary)',
          'primary-light': 'var(--color-bg-primary-light)',
          'primary-light-strong': 'var(--color-bg-primary-light-strong)',
          secondary: 'var(--color-bg-secondary)',
          'secondary-light': 'var(--color-bg-secondary-light)',
          'secondary-light-strongest': 'var(--color-bg-secondary-light-strongest)',
          tertiary: 'var(--color-bg-tertiary)',
          'tertiary-emphasis': 'var(--color-bg-tertiary-emphasis)',
          'tertiary-strong': 'var(--color-bg-tertiary-strong)',
          fourth: 'var(--color-bg-fourth)',
          'fourth-muted': 'var(--color-bg-fourth-muted)',
          'fourth-emphasis': 'var(--color-bg-fourth-emphasis)',
          fifth: 'var(--color-bg-fifth)',
          selection: 'var(--color-bg-selection)',
          'code-block': 'var(--color-bg-code-block)',
          'diff-viewer-old-primary': 'var(--color-bg-diff-viewer-old-primary)',
          'diff-viewer-old-secondary': 'var(--color-bg-diff-viewer-old-secondary)',
          'diff-viewer-new-primary': 'var(--color-bg-diff-viewer-new-primary)',
          'diff-viewer-new-secondary': 'var(--color-bg-diff-viewer-new-secondary)',

        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary: 'var(--color-text-tertiary)',
          muted: 'var(--color-text-muted)',
          'muted-light': 'var(--color-text-muted-light)',
          'muted-dark': 'var(--color-text-muted-dark)',
          dark: 'var(--color-text-dark)',
          error: 'var(--color-error)',
        },
        border: {
          dark: 'var(--color-border-dark)',
          'dark-light': 'var(--color-border-dark-light)',
          'dark-light-strong': 'var(--color-border-dark-light-strong)',
          default: 'var(--color-border-default)',
          'default-dark': 'var(--color-border-default-dark)',
          accent: 'var(--color-border-accent)',
          light: 'var(--color-border-light)',
        },
        accent: {
          primary: 'var(--color-accent-primary)',
          secondary: 'var(--color-accent-secondary)',
          light: 'var(--color-accent-light)',
        },
        success: 'var(--color-success)',
        'success-light': 'var(--color-success-light)',
        'success-subtle': 'var(--color-success-subtle)',
        'success-muted': 'var(--color-success-muted)',
        'success-emphasis': 'var(--color-success-emphasis)',

        warning: 'var(--color-warning)',
        'warning-light': 'var(--color-warning-light)',
        'warning-subtle': 'var(--color-warning-subtle)',
        'warning-emphasis': 'var(--color-warning-emphasis)',
        'warning-text': 'var(--color-warning-text)',

        error: 'var(--color-error)',
        'error-light': 'var(--color-error-light)',
        'error-lighter': 'var(--color-error-lighter)',
        'error-dark': 'var(--color-error-dark)',
        'error-subtle': 'var(--color-error-subtle)',
        'error-muted': 'var(--color-error-muted)',
        'error-emphasis': 'var(--color-error-emphasis)',
        'error-strong': 'var(--color-error-strong)',

        info: 'var(--color-info)',
        'info-light': 'var(--color-info-light)',
        'info-lighter': 'var(--color-info-lighter)',
        'info-lightest': 'var(--color-info-lightest)',
        'info-subtle': 'var(--color-info-subtle)',
        'info-light-muted': 'var(--color-info-light-muted)',
        'info-light-emphasis': 'var(--color-info-light-emphasis)',


        input: {
          bg: 'var(--color-input-bg)',
          border: 'var(--color-input-border)',
          text: 'var(--color-input-text)',
        },
        agent: {
          'auto-approve': 'var(--color-agent-auto-approve)',
          'aider-tools': 'var(--color-agent-aider-tools)',
          'power-tools': 'var(--color-agent-power-tools)',
          'todo-tools': 'var(--color-agent-todo-tools)',
          'context-files': 'var(--color-agent-context-files)',
          'repo-map': 'var(--color-agent-repo-map)',
        },
        button: {
          primary: 'var(--color-button-primary)',
          'primary-light': 'var(--color-button-primary-light)',
          'primary-subtle': 'var(--color-button-primary-subtle)',
          'primary-emphasis': 'var(--color-button-primary-emphasis)',
          'primary-text': 'var(--color-button-primary-text)',
          secondary: 'var(--color-button-secondary)',
          'secondary-light': 'var(--color-button-secondary-light)',
          'secondary-subtle': 'var(--color-button-secondary-subtle)',
          'secondary-emphasis': 'var(--color-button-secondary-emphasis)',
          'secondary-text': 'var(--color-button-secondary-text)',
          danger: 'var(--color-button-danger)',
          'danger-light': 'var(--color-button-danger-light)',
          'danger-subtle': 'var(--color-button-danger-subtle)',
          'danger-emphasis': 'var(--color-button-danger-emphasis)',
          'danger-text': 'var(--color-button-danger-text)',
        },
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
