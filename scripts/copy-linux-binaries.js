/**
 * Copy Linux platform-specific binaries to resources/linux based on TARGETARCH
 * This script is called during the build process to select the correct binaries
 * for the architecture being built.
 */

const fs = require('fs');
const path = require('path');

// Get architecture from environment variable or command line argument
const arch = process.env.TARGETARCH || process.argv[2];

if (!arch || (arch !== 'amd64' && arch !== 'arm64')) {
  console.error('Error: TARGETARCH must be either "amd64" or "arm64"');
  console.error('Usage: node scripts/copy-linux-binaries.js [amd64|arm64]');
  console.error('   Or set TARGETARCH environment variable');
  process.exit(1);
}

const archDirName = arch === 'amd64' ? 'linux-x64' : 'linux-arm64';
const sourceDir = path.join(__dirname, '..', 'resources', archDirName);
const targetDir = path.join(__dirname, '..', 'resources', 'linux');

console.log(`Preparing Linux binaries for ${arch} (using ${archDirName})...`);

// Check if source directory exists
if (!fs.existsSync(sourceDir)) {
  console.error(`Error: Source directory not found: ${sourceDir}`);
  process.exit(1);
}

// Create target directory if it doesn't exist
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
  console.log(`Created target directory: ${targetDir}`);
}

// Copy all binaries from source to target
const files = fs.readdirSync(sourceDir);
let copiedCount = 0;

for (const file of files) {
  const sourceFile = path.join(sourceDir, file);
  const targetFile = path.join(targetDir, file);

  try {
    // Remove existing file if it exists
    if (fs.existsSync(targetFile)) {
      fs.unlinkSync(targetFile);
    }

    // Copy the file
    fs.copyFileSync(sourceFile, targetFile);
    copiedCount++;

    const stats = fs.statSync(targetFile);
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`  Copied ${file} (${sizeKB} KB)`);
  } catch (error) {
    console.error(`Error copying ${file}:`, error.message);
  }
}

console.log(`Successfully copied ${copiedCount} files for Linux ${arch}`);
console.log(`Source: ${sourceDir}`);
console.log(`Target: ${targetDir}`);
