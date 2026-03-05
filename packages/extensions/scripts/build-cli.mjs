import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const distDir = join(rootDir, 'dist');
const outputFile = join(distDir, 'cli.js');

// Ensure dist directory exists
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

// Build CLI with esbuild
console.log('Building CLI with esbuild...');
execSync('esbuild src/cli.ts --bundle --platform=node --outfile=dist/cli.js --format=esm --packages=external', {
  cwd: rootDir,
  stdio: 'inherit'
});

// Build runtime module with esbuild
console.log('Building runtime module with esbuild...');
execSync('esbuild src/runtime.ts --bundle --platform=node --outfile=dist/runtime.js --format=esm', {
  cwd: rootDir,
  stdio: 'inherit'
});

// Read the built file
const content = readFileSync(outputFile, 'utf-8');

// Prepend shebang
const withShebang = '#!/usr/bin/env node\n' + content;

// Write back
writeFileSync(outputFile, withShebang, { mode: 0o755 });

console.log('✓ CLI built successfully with shebang');
