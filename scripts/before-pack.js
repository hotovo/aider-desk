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
  }
};
