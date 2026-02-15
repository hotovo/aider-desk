import { resolve } from 'path';

import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      AIDER_DESK_NODE_TESTING: 'true',
    },
    include: [
      'packages/core/src/**/__tests__/**/*.{test,spec}.{ts,tsx}',
      'packages/common/src/**/__tests__/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: ['node_modules', 'dist', 'out'],
    setupFiles: ['./src/main/__tests__/setup.ts'],
  },
  plugins: [
    tsconfigPaths({
      projects: [
        resolve(__dirname, 'packages/core/tsconfig.json'),
        resolve(__dirname, 'packages/common/tsconfig.json'),
      ],
    }),
  ],
});
