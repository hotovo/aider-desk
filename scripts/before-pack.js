const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

exports.default = async function(context) {
  const arch = context.arch === 1 ? 'x64' : context.arch === 3 ? 'arm64' : undefined;
  const platform = context.packager.platform.name;

  if (platform === 'mac') {
    console.log(`Preparing uv binary for macOS ${arch}...`);
    if (arch === 'x64' || arch === 'arm64') {
      const sourceDir = path.join(__dirname, '..', 'resources', `macos-${arch}`);
      const targetDir = path.join(__dirname, '..', 'resources', 'macos');
      const sourceFile = path.join(sourceDir, 'uv');
      const targetFile = path.join(targetDir, 'uv');

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      if (fs.existsSync(sourceFile)) {
        fs.copyFileSync(sourceFile, targetFile);
        console.log(`uv binary for macOS ${arch} copied successfully.`);
      } else {
        console.error(`uv binary for macOS ${arch} not found at ${sourceFile}`);
      }
    }
  } else if (platform === 'win') {
    console.log(`Preparing uv binary for Windows ${arch}...`);
    if (arch === 'x64' || arch === 'arm64') {
      const sourceDir = path.join(__dirname, '..', 'resources', `win-${arch}`);
      const targetDir = path.join(__dirname, '..', 'resources', 'win');
      const sourceFile = path.join(sourceDir, 'uv.exe');
      const targetFile = path.join(targetDir, 'uv.exe');

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      if (fs.existsSync(sourceFile)) {
        fs.copyFileSync(sourceFile, targetFile);
        console.log(`uv binary for Windows ${arch} copied successfully.`);
      } else {
        console.error(`uv binary for Windows ${arch} not found at ${sourceFile}`);
      }
    }
  } else if (platform === 'linux') {
    console.log(`Preparing uv binary for Linux ${arch}...`);
    if (arch === 'x64' || arch === 'arm64') {
      const sourceDir = path.join(__dirname, '..', 'resources', `linux-${arch}`);
      const targetDir = path.join(__dirname, '..', 'resources', 'linux');
      const sourceFile = path.join(sourceDir, 'uv');
      const targetFile = path.join(targetDir, 'uv');

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      if (fs.existsSync(sourceFile)) {
        fs.copyFileSync(sourceFile, targetFile);
        console.log(`uv binary for Linux ${arch} copied successfully.`);
      } else {
        console.error(`uv binary for Linux ${arch} not found at ${sourceFile}`);
      }
    }
  }
};
