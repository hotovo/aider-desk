const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Arch } = require("electron-builder");

exports.default = async function(context) {
  const arch = context.arch === Arch.x64 ? 'x64' : context.arch === Arch.arm64 ? 'arm64' : undefined;
  const platform = context.packager.platform.name;

  if (platform === 'mac') {
    console.log(`Preparing resources for macOS ${arch}...`);
    if (arch === 'x64' || arch === 'arm64') {
      const sourceDir = path.join(__dirname, '..', 'resources', `macos-${arch}`);
      const targetDir = path.join(__dirname, '..', 'resources', 'macos');

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      if (fs.existsSync(sourceDir)) {
        const files = fs.readdirSync(sourceDir);
        let copiedCount = 0;

        files.forEach(file => {
          const sourceFile = path.join(sourceDir, file);
          const targetFile = path.join(targetDir, file);

          if (fs.statSync(sourceFile).isFile()) {
            fs.copyFileSync(sourceFile, targetFile);
            copiedCount++;
          }
        });

        console.log(`${copiedCount} files for macOS ${arch} copied successfully.`);
      } else {
        console.error(`Source directory for macOS ${arch} not found at ${sourceDir}`);
      }
    }
  } else if (platform === 'win') {
    console.log(`Preparing resources for Windows ${arch}...`);
    if (arch === 'x64' || arch === 'arm64') {
      const sourceDir = path.join(__dirname, '..', 'resources', `win-${arch}`);
      const targetDir = path.join(__dirname, '..', 'resources', 'win');

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      if (fs.existsSync(sourceDir)) {
        const files = fs.readdirSync(sourceDir);
        let copiedCount = 0;

        files.forEach(file => {
          const sourceFile = path.join(sourceDir, file);
          const targetFile = path.join(targetDir, file);

          if (fs.statSync(sourceFile).isFile()) {
            fs.copyFileSync(sourceFile, targetFile);
            copiedCount++;
          }
        });

        console.log(`${copiedCount} files for Windows ${arch} copied successfully.`);
      } else {
        console.error(`Source directory for Windows ${arch} not found at ${sourceDir}`);
      }
    }
  } else if (platform === 'linux') {
    console.log(`Preparing resources for Linux ${arch}...`);
    if (arch === 'x64' || arch === 'arm64') {
      const sourceDir = path.join(__dirname, '..', 'resources', `linux-${arch}`);
      const targetDir = path.join(__dirname, '..', 'resources', 'linux');

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      if (fs.existsSync(sourceDir)) {
        const files = fs.readdirSync(sourceDir);
        let copiedCount = 0;

        files.forEach(file => {
          const sourceFile = path.join(sourceDir, file);
          const targetFile = path.join(targetDir, file);

          if (fs.statSync(sourceFile).isFile()) {
            fs.copyFileSync(sourceFile, targetFile);
            copiedCount++;
          }
        });

        console.log(`${copiedCount} files for Linux ${arch} copied successfully.`);
      } else {
        console.error(`Source directory for Linux ${arch} not found at ${sourceDir}`);
      }
    }
  }
};
