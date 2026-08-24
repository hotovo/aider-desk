import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactCompiler from 'eslint-plugin-react-compiler';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import prettierPlugin from 'eslint-plugin-prettier/recommended';
import reactPlugin from 'eslint-plugin-react';
import i18nextPlugin from 'eslint-plugin-i18next';

const ignores = [
  'build',
  'dist',
  'node_modules',
  'out',
  '**/__fixtures__/**',
  'docs-site',
  'packages/app',
  'packages/extensions',
  'packages/tree-sitter-utils',
  '.aider-desk'
];

const noReactNamespaceEventTypes = {
  selector: "TSTypeReference > TSQualifiedName[left.name='React'][right.name=/Event/]",
  message: "Import React event types directly instead of using the React namespace (e.g., `import { MouseEvent } from 'react';`).",
};

const noCreateContextOutsideContextsDir = {
  selector: "CallExpression[callee.name='createContext']",
  message: 'Prefer Zustand stores over React Context for shared state; create contexts only in src/renderer/src/contexts/.',
};

const noInlinePropTypes = {
  selector:
    "VariableDeclarator[id.name=/^[A-Z]/] > ArrowFunctionExpression > :matches(Identifier, ObjectPattern)[typeAnnotation.typeAnnotation.type='TSTypeLiteral']",
  message:
    'Extract inline prop types into a dedicated `type Props` (or `<Component>Props`) declared directly above the component definition.',
};

export default tseslint.config({ ignores }, {
  ignores,
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
    'react-compiler': reactCompiler,
  },
  rules: {
    ...reactHooks.configs.recommended.rules,
    'import/no-unresolved': 'off',
    'import/no-extraneous-dependencies': [
      'warn',
      {
        devDependencies: true,
        peerDependencies: true,
        optionalDependencies: true,
      },
    ],
    'no-console': ['warn'],
    'no-unused-vars': 'off',
    quotes: ['error', 'single', { avoidEscape: true }],
    'curly': ['error', 'all'],

    'no-restricted-syntax': [
      'error',
      noReactNamespaceEventTypes,
      noInlinePropTypes,
    ],

    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'react',
            importNames: ['default'],
            message: "Default React import is unnecessary; use named imports instead (e.g., `import { useState } from 'react';`).",
          },
        ],
        patterns: [
          {
            group: [
              'classnames',
              'class-names',
              '@mui/icons-material',
              '@mui/icons-material/*',
              '@heroicons/*',
              'lucide-react',
              'react-feather',
              'phosphor-react',
              '@phosphor-icons/*',
              '@tabler/icons*',
              '@blueprintjs/icons',
              '@radix-ui/react-icons',
            ],
            message: 'Use the react-icons library for icons.',
          },
        ],
      },
    ],

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
        varsIgnorePattern: '^_'
      }
    ],

    '@typescript-eslint/no-restricted-types': [
      'error',
      {
        types: {
          'React.FC': 'Do not type components with React.FC; use typed props argument instead: ({ ... }: Props) => ...',
          'FC': 'Do not type components with FC; use typed props argument instead: ({ ... }: Props) => ...',
        },
      },
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
    'react-compiler/react-compiler': 'warn',
  }
}, {
  files: ['src/renderer/src/**/*.{ts,tsx}'],
  ignores: ['src/renderer/src/contexts/**'],
  rules: {
    'no-restricted-syntax': [
      'error',
      noReactNamespaceEventTypes,
      noCreateContextOutsideContextsDir,
    ],
  },
}, {
  files: ['src/renderer/src/**/*.tsx'],
  ignores: ['**/__tests__/**', 'src/renderer/src/icons/**'],
  plugins: { i18next: i18nextPlugin },
  rules: {
    'i18next/no-literal-string': ['error', {
      mode: 'jsx-text-only',
      ignoreCallee: ['Trans'],
    }],
  },
}, {
  files: ['**/__tests__/**/*.test.ts'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off'
  }
});
