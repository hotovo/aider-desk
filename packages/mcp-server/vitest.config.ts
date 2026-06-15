import { resolve } from 'path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      AIDER_DESK_MCP_TESTING: 'true',
    },
    include: ['src/**/__tests__/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist'],
  },
  resolve: {
    alias: {
      '@common': resolve(__dirname, 'packages/common/src'),
    },
  },
});
