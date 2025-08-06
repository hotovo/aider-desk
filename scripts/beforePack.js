const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

exports.default = async function(context) {
  console.log('beforePack hook started');
  const arch = context.arch === 1 ? 'x64' : context.arch === 3 ? 'arm64' : undefined;
  const platform = context.packager.platform.name;
  console.log(`Platform: ${platform}, Arch: ${arch}`);

  if (platform === 'mac') {
    if (arch === 'x64' || arch === 'arm64') {
      const sourceDir = path.join(__dirname, '..', 'resources', `macos-${arch}`);
      const targetDir = path.join(__dirname, '..', 'resources', 'macos');
      const sourceFile = path.join(sourceDir, 'uv');
      const targetFile = path.join(targetDir, 'uv');

      console.log(`Source directory: ${sourceDir}`);
      console.log(`Target directory: ${targetDir}`);
      console.log(`Source file: ${sourceFile}`);
      console.log(`Target file: ${targetFile}`);

      if (!fs.existsSync(targetDir)) {
        console.log('Target directory does not exist, creating it...');
        fs.mkdirSync(targetDir, { recursive: true });
      }

      if (fs.existsSync(sourceFile)) {
        console.log('Source file exists, copying to target...');
        fs.copyFileSync(sourceFile, targetFile);
        console.log('File copied successfully.');
      } else {
        console.error('Source file does not exist!');
      }
    }
  }
  console.log('beforePack hook finished');
};
