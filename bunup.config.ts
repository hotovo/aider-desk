import {defineConfig} from 'bunup';
import {join} from 'path';
import {existsSync, readdirSync, readFileSync, statSync} from 'fs';

const rootDir = process.cwd();

const DEFAULT_PLATFORM = 'linux-x64';

const PLATFORM_BIN_DIRS = [
  'linux-x64',
  'linux-arm64',
  'linux',
  'macos-x64',
  'macos-arm64',
  'win',
];

const PLATFORM_INCLUDES: Record<string, string[]> = {
  'linux-x64': ['linux-x64', 'linux', 'connector', 'prompts'],
  'linux-arm64': ['linux-arm64', 'connector', 'prompts'],
  'darwin-x64': ['macos-x64', 'connector', 'prompts'],
  'darwin-arm64': ['macos-arm64', 'connector', 'prompts'],
  'windows-x64': ['win', 'connector', 'prompts'],
};

function shouldIncludeResource(relativePath: string, platform: string): boolean {
  const includeDirs = PLATFORM_INCLUDES[platform] || PLATFORM_INCLUDES[DEFAULT_PLATFORM];
  const firstSegment = relativePath.split('/')[0];
  
  if (!PLATFORM_BIN_DIRS.includes(firstSegment)) {
    return true;
  }
  
  return includeDirs.includes(firstSegment);
}

function readDirRecursive(dir, baseDir = dir, addResourcesPrefix = false, platform = 'linux-x64') {
  const files = {};

  function traverse(currentDir) {
    for (const entry of readdirSync(currentDir)) {
      const fullPath = join(currentDir, entry);
      const relativePath = fullPath.replace(baseDir + '/', '');
      const stats = statSync(fullPath);

      if (stats.isDirectory()) {
        traverse(fullPath);
      } else {
        if (!shouldIncludeResource(relativePath, platform)) {
          continue;
        }
        const relativeFromRoot = addResourcesPrefix ? join('resources', relativePath) : relativePath;
        files[relativeFromRoot] = fullPath;
      }
    }
  }

  traverse(dir);
  return files;
}

const PLATFORM_TARGETS: Record<string, Bun.Build.Target> = {
  'linux-x64': 'bun-linux-x64',
  'linux-arm64': 'bun-linux-arm64',
  'darwin-x64': 'bun-darwin-x64',
  'darwin-arm64': 'bun-darwin-arm64',
  'windows-x64': 'bun-windows-x64',
};

function getPlatformTarget(platform: string): Bun.Build.Target {
  return PLATFORM_TARGETS[platform] || 'bun-linux-x64';
}

const platforms = process.env.BUNUP_TARGET_PLATFORM
  ? [process.env.BUNUP_TARGET_PLATFORM]
  : ['linux-x64', 'linux-arm64', 'darwin-x64', 'darwin-arm64', 'windows-x64'];

const outDir = 'out/bun';
const resourcesDir = join(rootDir, 'resources');
const rendererDir = join(rootDir, 'out', 'renderer');

const configs = platforms.map((platform) => {
  const rendererFiles = existsSync(rendererDir)
    ? readDirRecursive(rendererDir, rendererDir, false, platform)
    : {};

  const resourcesFiles = existsSync(resourcesDir)
    ? readDirRecursive(resourcesDir, resourcesDir, true, platform)
    : {};

  const allTextFiles = {
    ...resourcesFiles,
    ...Object.fromEntries(
      Object.entries(rendererFiles).map(([path, fullPath]) => [
        `out/renderer/${path}`,
        fullPath,
      ])
    ),
    'package.json': join(rootDir, 'package.json'),
  };

  const isWindows = platform.startsWith('windows');
  const extension = isWindows ? '.exe' : '';

  return {
    name: `runner-${platform}`,
    entry: 'src/main/server/runner.ts',
    compile: {
      target: getPlatformTarget(platform),
      outfile: `runner-${platform}${extension}`,
    },
    outDir,
    target: 'bun',
    define: {
      __BUN_BUILD_DIR__: JSON.stringify(rootDir),
    },
    files: allTextFiles,
    minify: false,
    sourcemap: 'inline',
    packages: 'bundle',
    splitting: false,
    clean: false,
  };
});

export default defineConfig(configs);
