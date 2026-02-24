import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import prettierPlugin from 'eslint-plugin-prettier/recommended';
import reactPlugin from 'eslint-plugin-react';

export default tseslint.config({ ignores: ['build', 'dist', 'node_modules', 'out', '**/__fixtures__/**'] }, {
  ignores: ['build', 'dist', 'node_modules', 'out', '**/__fixtures__/**'],
  extends: [
    js.configs.recommended,
    ...tseslint.configs.recommended,
    importPlugin.flatConfigs.recommended,
    reactPlugin.configs.flat.recommended,
    prettierPlugin,
  ],
  files: ['**/*.{ts,tsx}'],
  languageOptions: {
    ecmaVersion: 2020,
    globals: globals.browser
  },
  settings: {
    react: {
      version: 'detect'
    },
    "import/resolver": {
      node: {
        extensions: [".js", ".jsx", ".ts", ".tsx"],
      },
      typescript: {},
    }
  },
  plugins: {
    'react': reactPlugin,
    'react-hooks': reactHooks,
  },
  rules: {
    ...reactHooks.configs.recommended.rules,
    'import/no-unresolved': 'off',
    'no-console': ['warn'],
    'no-unused-vars': 'off',
    quotes: ['error', 'single', { avoidEscape: true }],
    'curly': ['error', 'all'],

    'prettier/prettier': [
      'error',
      {
        printWidth: 160,
        singleQuote: true,
        semi: true,
        trailingComma: 'all',
        endOfLine: 'auto'
      }
    ],

    'func-style': ["error", "expression"],

    'import/order': [
      'error',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
          'type'
        ],
        'newlines-between': 'always',
      },
    ],

    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }
    ],

    'react/prop-types': 0,
    '@typescript-eslint/explicit-module-boundary-types': 0,

    'padding-line-between-statements': [
      0,
      {
        blankLine: 'always',
        prev: '*',
        next: '*'
      },
      {
        blankLine: 'any',
        prev: 'import',
        next: '*'
      },
      {
        blankLine: 'any',
        prev: 'export',
        next: '*'
      },
      {
        blankLine: 'any',
        prev: 'case',
        next: '*'
      },
      {
        blankLine: 'any',
        prev: 'const',
        next: 'const'
      }
    ],

    'react/function-component-definition': [
      1,
      {
        namedComponents: 'arrow-function',
        unnamedComponents: 'arrow-function'
      }
    ],

    'react/jsx-uses-react': 0,
    'react/react-in-jsx-scope': 0,

    'react/jsx-curly-brace-presence': [
      'error',
      {
        props: 'never',
        children: 'never'
      }
    ],

    'react-hooks/purity': 'warn',
    'react-hooks/set-state-in-effect': 'warn',
    'react-hooks/refs': 'warn',
  }
}, {
  files: ['**/__tests__/**/*.test.ts'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off'
  }
});
