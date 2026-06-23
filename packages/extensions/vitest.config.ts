import { resolve } from 'path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'extensions/**/__tests__/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: ['node_modules', 'dist', 'out'],
  },
  resolve: {
    alias: {
      '@aiderdesk/extensions': resolve(__dirname, 'extensions.d.ts'),
    },
  },
});
