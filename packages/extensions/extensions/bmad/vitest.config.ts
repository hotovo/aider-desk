import { defineConfig } from 'vitest/config';

// Local test config: keeps `npm test` in this folder deterministic and prevents
// vitest from picking up the parent workspace's config (which only includes __tests__ dirs).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
});
