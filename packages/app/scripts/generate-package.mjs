import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
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

const runnerJs = readFileSync(resolve(PKG_DIR, 'out', 'server', 'runner.js'), 'utf8');

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
  return pkgName;
};

let match;
while ((match = requireRegex.exec(runnerJs)) !== null) {
  const pkg = extractPackageName(match[1]);
  if (pkg) requiredPackages.add(pkg);
}
while ((match = dynamicImportRegex.exec(runnerJs)) !== null) {
  const pkg = extractPackageName(match[1]);
  if (pkg) requiredPackages.add(pkg);
}

const rootPkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
const template = JSON.parse(readFileSync(resolve(PKG_DIR, 'package.json.template'), 'utf8'));

const dependencies = {};
for (const pkg of [...requiredPackages].sort()) {
  let version = rootPkg.dependencies?.[pkg] || rootPkg.devDependencies?.[pkg];
  if (version && version.startsWith('workspace:')) {
    const wsPkg = JSON.parse(readFileSync(resolve(ROOT, 'node_modules', pkg, 'package.json'), 'utf8'));
    version = wsPkg.version;
  }
  if (version) {
    dependencies[pkg] = version;
  } else {
    console.warn(`Warning: version not found for "${pkg}" in root package.json`);
  }
}

template.version = rootPkg.version;
template.dependencies = { ...template.dependencies, ...dependencies };

const outputPath = resolve(PKG_DIR, 'package.json');
writeFileSync(outputPath, JSON.stringify(template, null, 2) + '\n');

console.log(`Generated ${outputPath}`);
console.log(`Found ${Object.keys(dependencies).length} dependencies from runner.js`);
