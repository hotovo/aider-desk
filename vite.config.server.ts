import { resolve } from 'path';
import { builtinModules as builtins } from 'module';

import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  define: {
    'process.env.POSTHOG_PUBLIC_API_KEY': JSON.stringify(process.env.POSTHOG_PUBLIC_API_KEY ?? ''),
  },
  build: {
    outDir: 'out/server',
    lib: {
      entry: resolve(__dirname, 'src/main/server/runner.ts'),
      formats: ['cjs'],
      fileName: 'runner',
    },
    rollupOptions: {
      external: [...builtins, '@homebridge/node-pty-prebuilt-multiarch', '@probelabs/probe', '@huggingface/transformers', '@lancedb/lancedb'],
      output: {
        entryFileNames: 'runner.js',
      },
    },
    emptyOutDir: true,
    target: 'node20',
    ssr: true,
  },
  plugins: [
    tsconfigPaths({
      projects: [resolve(__dirname, 'tsconfig.server.json')],
    }),
  ],
});
