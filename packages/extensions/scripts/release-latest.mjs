import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Read package.json to get name and version
const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
const { name, version } = pkg;

console.log(`\n🏷️  Tagging ${name}@${version} as "latest"\n`);

// Tag current version as latest
execSync(`npm dist-tag add ${name}@${version} latest`, {
  cwd: rootDir,
  stdio: 'inherit'
});

console.log(`\n✅ Tagged ${name}@${version} with dist-tag "latest"`);