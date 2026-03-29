import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync, rmSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..', '..', '..');
const PKG_DIR = resolve(__dirname, '..');

const ELECTRON_PACKAGES = [
  'electron',
  'electron-updater',
  '@electron-toolkit/preload',
  '@electron-toolkit/utils',
];

const NODE_BUILTINS = new Set([
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console',
  'constants', 'crypto', 'dgram', 'diagnostics_channel', 'dns', 'domain',
  'events', 'fs', 'http', 'http2', 'https', 'inspector', 'module', 'net',
  'os', 'path', 'perf_hooks', 'process', 'punycode', 'querystring', 'readline',
  'repl', 'stream', 'string_decoder', 'sys', 'timers', 'tls', 'trace_events',
  'tty', 'url', 'util', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib',
  'node:assert', 'node:async_hooks', 'node:buffer', 'node:child_process',
  'node:cluster', 'node:console', 'node:constants', 'node:crypto', 'node:dgram',
  'node:diagnostics_channel', 'node:dns', 'node:domain', 'node:events',
  'node:fs', 'node:http', 'node:http2', 'node:https', 'node:inspector',
  'node:module', 'node:net', 'node:os', 'node:path', 'node:perf_hooks',
  'node:process', 'node:punycode', 'node:querystring', 'node:readline',
  'node:repl', 'node:stream', 'node:string_decoder', 'node:sys', 'node:timers',
  'node:tls', 'node:trace_events', 'node:tty', 'node:url', 'node:util',
  'node:v8', 'node:vm', 'node:wasi', 'node:worker_threads', 'node:zlib',
  'node:sqlite',
  'undici',
]);

// Packages that are already in the committed package.json CLI deps
const CLI_PACKAGES = new Set([
  '@mariozechner/pi-tui',
]);

const runnerJs = readFileSync(resolve(PKG_DIR, 'out', 'runner.js'), 'utf8');
const cliJs = readFileSync(resolve(PKG_DIR, 'out', 'cli.js'), 'utf8');

const requireRegex = /require(?:\.resolve)?\(["']([^"']+)["']\)/g;
const dynamicImportRegex = /import\(["']([^"']+)["']\)/g;
const requiredPackages = new Set();

const extractPackageName = (req) => {
  if (req.startsWith('./') || req.startsWith('../')) return null;
  const pkgName = req.startsWith('@')
    ? req.split('/').slice(0, 2).join('/')
    : req.split('/')[0];
  if (NODE_BUILTINS.has(pkgName)) return null;
  if (ELECTRON_PACKAGES.includes(pkgName)) return null;
  if (CLI_PACKAGES.has(pkgName)) return null;
  return pkgName;
};

const scanFile = (content) => {
  let match;
  requireRegex.lastIndex = 0;
  while ((match = requireRegex.exec(content)) !== null) {
    const pkg = extractPackageName(match[1]);
    if (pkg) requiredPackages.add(pkg);
  }
  dynamicImportRegex.lastIndex = 0;
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    const pkg = extractPackageName(match[1]);
    if (pkg) requiredPackages.add(pkg);
  }
};

scanFile(runnerJs);
scanFile(cliJs);

const rootPkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
const pkgJson = JSON.parse(readFileSync(resolve(PKG_DIR, 'package.json'), 'utf8'));

for (const pkg of [...requiredPackages].sort()) {
  if (pkgJson.dependencies[pkg]) continue;

  let version = rootPkg.dependencies?.[pkg] || rootPkg.devDependencies?.[pkg];
  if (version && version.startsWith('workspace:')) {
    const wsPkg = JSON.parse(readFileSync(resolve(ROOT, 'node_modules', pkg, 'package.json'), 'utf8'));
    version = wsPkg.version;
  }
  if (version) {
    pkgJson.dependencies[pkg] = version;
  } else {
    console.warn(`Warning: version not found for "${pkg}" in root package.json`);
  }
}

pkgJson.version = rootPkg.version;

const outputPath = resolve(PKG_DIR, 'package.json');
writeFileSync(outputPath, JSON.stringify(pkgJson, null, 2) + '\n');

console.log(`Updated ${outputPath}`);
console.log(`Found ${Object.keys(pkgJson.dependencies).length} total dependencies`);

// Step: Copy matching patches from root
const ROOT_PATCHES_DIR = resolve(ROOT, 'patches');
const PKG_PATCHES_DIR = resolve(PKG_DIR, 'patches');

if (existsSync(ROOT_PATCHES_DIR)) {
  const patchFiles = readdirSync(ROOT_PATCHES_DIR).filter(f => f.endsWith('.patch'));

  // Extract package name from patch filename
  // Scoped: @scope+name+version.patch → @scope/name
  // Regular: name+version.patch → name
  const extractPkgName = (filename) => {
    const base = filename.replace(/\.patch$/, '');
    if (base.startsWith('@')) {
      const parts = base.split('+');
      return parts.slice(0, 2).join('/');
    }
    return base.split('+')[0];
  };

  const depNames = new Set(Object.keys(pkgJson.dependencies));
  const matchingPatches = patchFiles.filter(f => depNames.has(extractPkgName(f)));

  if (matchingPatches.length > 0) {
    rmSync(PKG_PATCHES_DIR, { recursive: true, force: true });
    mkdirSync(PKG_PATCHES_DIR, { recursive: true });

    for (const patchFile of matchingPatches) {
      copyFileSync(join(ROOT_PATCHES_DIR, patchFile), join(PKG_PATCHES_DIR, patchFile));
    }

    console.log(`Copied ${matchingPatches.length} matching patch(es): ${matchingPatches.join(', ')}`);
  } else {
    // Remove stale patches dir if no patches match
    rmSync(PKG_PATCHES_DIR, { recursive: true, force: true });
    console.log('No matching patches found.');
  }
} else {
  console.log('No patches directory found at root.');
}
