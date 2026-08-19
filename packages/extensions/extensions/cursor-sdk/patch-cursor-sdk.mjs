import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SDK_VERSION = '1.0.23';
const PATCH_VERSION = '1.0.23-shell-cwd-1';
const extensionDir = dirname(fileURLToPath(import.meta.url));
const sdkDir = join(extensionDir, 'node_modules', '@cursor', 'sdk');
const sdkPackage = JSON.parse(readFileSync(join(sdkDir, 'package.json'), 'utf8'));

if (sdkPackage.version !== SDK_VERSION) {
  throw new Error(`Cursor SDK shell cwd patch expects @cursor/sdk ${SDK_VERSION}, found ${sdkPackage.version}`);
}

// ShellCoreExecutor.getCwd() backs the default working directory of every shell
// tool call site (LocalShellExecutor, LocalShellStreamExecutor,
// LocalBackgroundShellExecutor, ShellCoreExecutor.execute). Upstream it returns
// the terminal executor's tracked cwd, which is seeded from process.cwd() of
// the host process instead of the agent workspace. Fall back to the workspace
// path so commands without an explicit workingDirectory run in the project dir.
const original = 'async getCwd(){return this.executor.getCwd()}';
const patched = 'async getCwd(){return this.workspacePath||await this.executor.getCwd()}';
const marker = `/* aiderdesk-shell-cwd-patch ${PATCH_VERSION} */`;

const patchBundle = (filePath) => {
  let source = readFileSync(filePath, 'utf8');
  if (source.includes(marker)) return true;
  if (!source.includes(original)) return false;
  if (source.includes(patched)) {
    throw new Error(`Cursor SDK bundle ${filePath} contains an unrecognized shell cwd patch; reinstall dependencies before patching`);
  }
  const occurrences = source.split(original).length - 1;
  if (occurrences !== 1) {
    throw new Error(`Cursor SDK bundle ${filePath} contains ${occurrences} shell getCwd sites, expected 1`);
  }

  source = `${marker}${source}`;
  source = source.replaceAll(original, patched);
  writeFileSync(filePath, source);
  return true;
};

const patchedBundles = ['esm', 'cjs'].flatMap((format) => {
  const directory = join(sdkDir, 'dist', format);
  return readdirSync(directory)
    .filter((fileName) => fileName.endsWith('.js'))
    .map((fileName) => join(directory, fileName))
    .filter(patchBundle);
});

if (patchedBundles.length !== 2) {
  throw new Error(`Expected to patch two Cursor SDK bundles, patched ${patchedBundles.length}`);
}

console.log(`Patched @cursor/sdk ${SDK_VERSION} shell cwd fallback (${PATCH_VERSION})`);
