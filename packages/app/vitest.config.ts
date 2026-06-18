import { resolve } from 'path';

import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

const ROOT = resolve(__dirname, '..', '..');

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'out'],
  },
  resolve: {
    alias: {
      '@/': resolve(ROOT, 'src/main/') + '/',
      '@common/': resolve(ROOT, 'packages/common/src/') + '/',
    },
  },
  plugins: [
    tsconfigPaths({
      projects: [resolve(ROOT, 'tsconfig.server.json')],
    }),
  ],
});
