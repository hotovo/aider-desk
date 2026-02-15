/**
 * Post-build script to fix ESM imports in tsc output:
 * 1. Add .js extensions to relative imports (Node ESM requires them)
 * 2. Rewrite @/* path aliases to relative paths
 *
 * TypeScript with moduleResolution: "bundler" doesn't add extensions
 * and doesn't rewrite path aliases in emitted output.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, dirname, relative, posix } from 'path';

function getJsFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getJsFiles(fullPath));
    } else if (entry.name.endsWith('.js')) {
      results.push(fullPath);
    }
  }
  return results;
}

function resolveImportPath(importPath, file, distDir) {
  // Rewrite @/* alias to relative path
  if (importPath.startsWith('@/')) {
    const aliasTarget = importPath.slice(2); // remove '@/'
    const targetAbsolute = join(distDir, aliasTarget);
    let rel = relative(dirname(file), targetAbsolute);
    // Convert to posix-style path separators
    rel = rel.split('\\').join('/');
    if (!rel.startsWith('.')) {
      rel = './' + rel;
    }
    return rel;
  }
  return importPath;
}

function addExtension(importPath, file, distDir) {
  // Skip if already has a file extension
  if (/\.\w+$/.test(importPath)) {
    return importPath;
  }

  // Check if it's a directory with an index.js
  const resolvedDir = join(dirname(file), importPath);
  if (existsSync(resolvedDir) && statSync(resolvedDir).isDirectory()) {
    const indexPath = join(resolvedDir, 'index.js');
    if (existsSync(indexPath)) {
      return importPath + '/index.js';
    }
  }

  // Add .js extension
  return importPath + '.js';
}

const distDir = join(process.cwd(), 'dist');
if (!existsSync(distDir)) {
  console.log('No dist directory found, skipping.');
  process.exit(0);
}

const files = getJsFiles(distDir);
let fixedCount = 0;

for (const file of files) {
  let content = readFileSync(file, 'utf-8');
  let modified = false;

  // Add __dirname/__filename polyfill if the file uses them
  if (content.includes('__dirname') || content.includes('__filename')) {
    const polyfill = `import { fileURLToPath as __esm_fileURLToPath } from 'url';\nimport { dirname as __esm_dirname } from 'path';\nconst __filename = __esm_fileURLToPath(import.meta.url);\nconst __dirname = __esm_dirname(__filename);\n`;
    content = polyfill + content;
    modified = true;
  }

  // Match: from '...' / import '...' / import('...')
  content = content.replace(
    /((?:from|import)\s*\(?['"])((?:\.\.?\/|@\/)[^'"]*?)(['"]\)?)/g,
    (match, prefix, importPath, quote) => {
      let newPath = resolveImportPath(importPath, file, distDir);
      newPath = addExtension(newPath, file, distDir);
      if (newPath !== importPath) {
        modified = true;
        return `${prefix}${newPath}${quote}`;
      }
      return match;
    }
  );

  if (modified) {
    writeFileSync(file, content);
    fixedCount++;
  }
}

console.log(`Fixed ESM imports in ${fixedCount}/${files.length} files under ${distDir}`);
