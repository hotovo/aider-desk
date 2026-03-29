import { resolve } from 'path';
import { builtinModules as builtins } from 'module';

import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const ROOT = resolve(__dirname, '..', '..');
const PKG = resolve(__dirname);

export default defineConfig({
  build: {
    outDir: 'out',
    lib: {
      entry: {
        runner: resolve(ROOT, 'src/main/server/runner.ts'),
        cli: resolve(PKG, 'src/cli/index.ts'),
      },
      formats: ['cjs'],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: [
        ...builtins,
        'better-sqlite3',
        '@homebridge/node-pty-prebuilt-multiarch',
        '@huggingface/transformers',
        '@lancedb/lancedb',
        '@mariozechner/pi-tui',
        'commander',
      ],
    },
    emptyOutDir: true,
    target: 'node20',
    ssr: true,
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
