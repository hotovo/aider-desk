import { resolve } from 'path';

import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin(),
      tsconfigPaths({
        projects: [resolve(__dirname, 'tsconfig.node.json')],
      }),
    ],
  },
  preload: {
    plugins: [
      externalizeDepsPlugin(),
      tsconfigPaths({
        projects: [resolve(__dirname, 'tsconfig.node.json'), resolve(__dirname, 'tsconfig.web.json')],
      }),
    ],
  },
  renderer: {
    publicDir: resolve(__dirname, 'src/renderer/public'),
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          progress: resolve(__dirname, 'src/renderer/progress.html'),
        },
      },
    },
    plugins: [
      react({
        babel: {
          plugins: ['babel-plugin-react-compiler'],
        },
      }),
      tsconfigPaths({
        projects: [resolve(__dirname, 'tsconfig.web.json')],
      }),
    ],
    server: {
      host: '0.0.0.0',
      hmr: process.env.NO_HMR === 'true' ? false : undefined,
    },
  },
});
