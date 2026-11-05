import { resolve } from 'path';

import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

import { rendererStartupPlugin } from './scripts/renderer-startup-plugin';

const posthogDefine = {
  'process.env.POSTHOG_PUBLIC_API_KEY': JSON.stringify(process.env.POSTHOG_PUBLIC_API_KEY ?? ''),
};

export default defineConfig({
  main: {
    define: posthogDefine,
    plugins: [
      tsconfigPaths({
        projects: [resolve(__dirname, 'tsconfig.node.json')],
      }),
    ],
  },
  preload: {
    plugins: [
      tsconfigPaths({
        projects: [resolve(__dirname, 'tsconfig.node.json'), resolve(__dirname, 'tsconfig.web.json')],
      }),
    ],
  },
  renderer: {
    publicDir: resolve(__dirname, 'src/renderer/public'),
    worker: {
      format: 'es',
    },
    optimizeDeps: {
      include: ['ghostty-web'],
      exclude: [],
    },
    build: {
      minify: 'esbuild',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          progress: resolve(__dirname, 'src/renderer/progress.html'),
        },
      },
    },
    plugins: [
      rendererStartupPlugin(),
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
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${process.env.AIDER_DESK_PORT || '24337'}`,
        },
        '/socket.io': {
          target: `http://127.0.0.1:${process.env.AIDER_DESK_PORT || '24337'}`,
          ws: true,
        },
      },
    },
  },
});
