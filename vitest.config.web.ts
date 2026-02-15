import { resolve } from 'path';

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    env: {
      AIDER_DESK_WEB_TESTING: 'true',
    },
    include: ['packages/ui/src/**/__tests__/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'out'],
    setupFiles: ['./packages/ui/src/__tests__/setup.ts'],
  },
  plugins: [
    react(),
    tsconfigPaths({
      projects: [
        resolve(__dirname, 'packages/ui/tsconfig.json'),
        resolve(__dirname, 'packages/common/tsconfig.json'),
      ],
    }),
  ],
});
