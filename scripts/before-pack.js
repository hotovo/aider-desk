const fs = require('fs');
const path = require('path');
const { Arch } = require('electron-builder');

exports.default = async function(context) {
  const arch = context.arch === Arch.x64 ? 'x64' : context.arch === Arch.arm64 ? 'arm64' : undefined;
  const platform = context.packager.platform.name;

  if (platform === 'mac') {
    console.log(`Preparing binaries for macOS ${arch}...`);
    if (arch === 'x64' || arch === 'arm64') {
      const sourceDir = path.join(__dirname, '..', 'resources', `macos-${arch}`);
      const targetDir = path.join(__dirname, '..', 'resources', 'macos');

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      if (fs.existsSync(sourceDir)) {
        // Copy all files from source directory to target directory
        const files = fs.readdirSync(sourceDir);
        for (const file of files) {
          const sourceFile = path.join(sourceDir, file);
          const targetFile = path.join(targetDir, file);
          fs.copyFileSync(sourceFile, targetFile);
          console.log(`Copied ${file} for macOS ${arch}.`);
        }
        console.log(`All binaries for macOS ${arch} copied successfully.`);
      } else {
        console.error(`Source directory for macOS ${arch} not found at ${sourceDir}`);
      }
    }
  }

  if (platform === 'linux') {
    console.log(`Preparing binaries for Linux ${arch}...`);
    if (arch === 'x64' || arch === 'arm64') {
      const sourceDir = path.join(__dirname, '..', 'resources', `linux-${arch}`);
      const targetDir = path.join(__dirname, '..', 'resources', 'linux');

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      if (fs.existsSync(sourceDir)) {
        // Copy all files from source directory to target directory
        const files = fs.readdirSync(sourceDir);
        for (const file of files) {
          const sourceFile = path.join(sourceDir, file);
          const targetFile = path.join(targetDir, file);
          fs.copyFileSync(sourceFile, targetFile);
          console.log(`Copied ${file} for Linux ${arch}.`);
        }
        console.log(`All binaries for Linux ${arch} copied successfully.`);
      } else {
        console.error(`Source directory for Linux ${arch} not found at ${sourceDir}`);
      }
    }
  }
};
