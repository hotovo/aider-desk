import { resolve } from 'path';
import { readFileSync } from 'fs';

import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

// Read workspace package deps so they get externalized too
function getWorkspaceDeps(...pkgPaths: string[]): string[] {
  const deps = new Set<string>();
  for (const pkgPath of pkgPaths) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    for (const dep of Object.keys(pkg.dependencies || {})) {
      deps.add(dep);
    }
    for (const dep of Object.keys(pkg.optionalDependencies || {})) {
      deps.add(dep);
    }
  }
  // Don't include workspace packages - we want those bundled
  deps.delete('@aider-desk/common');
  deps.delete('@aider-desk/core');
  deps.delete('@aider-desk/ui');
  return [...deps];
}

const workspaceDeps = getWorkspaceDeps(
  resolve(__dirname, '../../packages/core/package.json'),
  resolve(__dirname, '../../packages/common/package.json'),
);

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        exclude: ['@aider-desk/core', '@aider-desk/common'],
        include: workspaceDeps,
      }),
      tsconfigPaths({
        projects: [
          resolve(__dirname, 'tsconfig.node.json'),
          resolve(__dirname, '../../packages/core/tsconfig.json'),
          resolve(__dirname, '../../packages/common/tsconfig.json'),
        ],
      }),
    ],
    resolve: {
      alias: {
        '@aider-desk/core': resolve(__dirname, '../../packages/core/src'),
        '@aider-desk/common': resolve(__dirname, '../../packages/common/src'),
      },
    },
    build: {
      outDir: 'out/main',
    },
  },
  preload: {
    plugins: [
      externalizeDepsPlugin({ exclude: ['@aider-desk/common'] }),
      tsconfigPaths({
        projects: [
          resolve(__dirname, 'tsconfig.node.json'),
          resolve(__dirname, '../../packages/common/tsconfig.json'),
        ],
      }),
    ],
    resolve: {
      alias: {
        '@aider-desk/common': resolve(__dirname, '../../packages/common/src'),
      },
    },
    build: {
      outDir: 'out/preload',
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    publicDir: resolve(__dirname, 'src/renderer/public'),
    build: {
      outDir: 'out/renderer',
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
        projects: [
          resolve(__dirname, 'tsconfig.web.json'),
          resolve(__dirname, '../../packages/ui/tsconfig.json'),
          resolve(__dirname, '../../packages/common/tsconfig.json'),
        ],
      }),
    ],
    resolve: {
      alias: {
        '@aider-desk/ui/fonts': resolve(__dirname, '../../packages/ui/src/fonts.css'),
        '@aider-desk/ui/styles': resolve(__dirname, '../../packages/ui/src/main.css'),
        '@aider-desk/ui': resolve(__dirname, '../../packages/ui/src'),
        '@aider-desk/common': resolve(__dirname, '../../packages/common/src'),
      },
    },
    server: {
      host: '0.0.0.0',
      hmr: process.env.NO_HMR === 'true' ? false : undefined,
    },
  },
});
