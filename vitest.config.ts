import { defineConfig, configDefaults } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    exclude: [...configDefaults.exclude, '!docs-site'],
    testTimeout: 10000,
    setupFiles: ['./vitest.setup.ts'],
  },
});
