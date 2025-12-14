const fs = require('fs');
const path = require('path');

exports.default = async function(context) {
  const arch = context.arch === 1 ? 'x64' : context.arch === 3 ? 'arm64' : undefined;
  const platform = context.packager.platform.name;

  // Rename AppImage for ARM64 Linux builds
  if (platform === 'linux' && arch === 'arm64') {
    console.log('Renaming AppImage for Linux ARM64...');
    const distDir = path.join(__dirname, '..', 'dist');

    if (fs.existsSync(distDir)) {
      const files = fs.readdirSync(distDir);

      for (const file of files) {
        if (file.endsWith('.AppImage') && !file.includes('-arm64')) {
          const oldPath = path.join(distDir, file);
          const newFileName = file.replace('.AppImage', '-arm64.AppImage');
          const newPath = path.join(distDir, newFileName);

          if (fs.existsSync(oldPath)) {
            fs.renameSync(oldPath, newPath);
            console.log(`Renamed ${file} to ${newFileName}`);
          }
        }
      }
    }
  }
};
