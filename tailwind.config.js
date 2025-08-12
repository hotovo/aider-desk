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
          primaryLight: 'var(--color-bg-primary-light)',
          primaryLightStrong: 'var(--color-bg-primary-light-strong)',
          secondary: 'var(--color-bg-secondary)',
          secondaryLight: 'var(--color-bg-secondary-light)',
          secondaryLightStrongest: 'var(--color-bg-secondary-light-strongest)',
          tertiary: 'var(--color-bg-tertiary)',
          tertiaryEmphasis: 'var(--color-bg-tertiary-emphasis)',
          tertiaryStrong: 'var(--color-bg-tertiary-strong)',
          fourth: 'var(--color-bg-fourth)',
          fourthMuted: 'var(--color-bg-fourth-muted)',
          fourthEmphasis: 'var(--color-bg-fourth-emphasis)',
          fifth: 'var(--color-bg-fifth)',
          selection: 'var(--color-bg-selection)',
          codeBlock: 'var(--color-bg-code-block)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary: 'var(--color-text-tertiary)',
          muted: 'var(--color-text-muted)',
          mutedLight: 'var(--color-text-muted-light)',
          mutedDark: 'var(--color-text-muted-dark)',
          dark: 'var(--color-text-dark)',
          error: 'var(--color-error)',
        },
        border: {
          dark: 'var(--color-border-dark)',
          darkLight: 'var(--color-border-dark-light)',
          darkLightStrong: 'var(--color-border-dark-light-strong)',
          default: 'var(--color-border-default)',
          defaultDark: 'var(--color-border-default-dark)',
          accent: 'var(--color-border-accent)',
          light: 'var(--color-border-light)',
        },
        accent: {
          primary: 'var(--color-accent-primary)',
          secondary: 'var(--color-accent-secondary)',
          light: 'var(--color-accent-light)',
        },
        success: 'var(--color-success)',
        successLight: 'var(--color-success-light)',
        successSubtle: 'var(--color-success-subtle)',
        successMuted: 'var(--color-success-muted)',
        successEmphasis: 'var(--color-success-emphasis)',

        warning: 'var(--color-warning)',
        warningLight: 'var(--color-warning-light)',
        warningSubtle: 'var(--color-warning-subtle)',
        warningEmphasis: 'var(--color-warning-emphasis)',
        warningText: 'var(--color-warning-text)',

        error: 'var(--color-error)',
        errorLight: 'var(--color-error-light)',
        errorLighter: 'var(--color-error-lighter)',
        errorDark: 'var(--color-error-dark)',
        errorSubtle: 'var(--color-error-subtle)',
        errorMuted: 'var(--color-error-muted)',
        errorEmphasis: 'var(--color-error-emphasis)',
        errorStrong: 'var(--color-error-strong)',

        info: 'var(--color-info)',
        infoLight: 'var(--color-info-light)',
        infoLighter: 'var(--color-info-lighter)',
        infoLightest: 'var(--color-info-lightest)',
        infoSubtle: 'var(--color-info-subtle)',
        infoLightMuted: 'var(--color-info-light-muted)',
        infoLightEmphasis: 'var(--color-info-light-emphasis)',


        input: {
          bg: 'var(--color-input-bg)',
          border: 'var(--color-input-border)',
          text: 'var(--color-input-text)',
        },
        agent: {
          autoApprove: 'var(--color-agent-autoapprove)',
          aiderTools: 'var(--color-agent-aidertools)',
          powerTools: 'var(--color-agent-powertools)',
          todoTools: 'var(--color-agent-todotools)',
          contextFiles: 'var(--color-agent-contextfiles)',
          repoMap: 'var(--color-agent-repomap)',
        },
        diffViewerBgOldPrimary: 'var(--color-diffviewer-bg-old-primary)',
        diffViewerBgOldSecondary: 'var(--color-diffviewer-bg-old-secondary)',
        diffViewerBgNewPrimary: 'var(--color-diffviewer-bg-new-primary)',
        diffViewerBgNewSecondary: 'var(--color-diffviewer-bg-new-secondary)',
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
