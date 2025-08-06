const { execSync } = require('child_process');

const arch = process.env.ARCH;

if (process.platform === 'darwin') {
  if (arch === 'x64' || arch === 'arm64') {
    console.log(`Running pack:mac:${arch}`);
    execSync(`npm run pack:mac:${arch}`, { stdio: 'inherit' });
  }
}
