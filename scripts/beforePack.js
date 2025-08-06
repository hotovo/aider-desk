const { execSync } = require('child_process');

exports.default = async function(context) {
  const { arch } = context;
  if (context.packager.platform.name === 'mac') {
    if (arch === 'x64' || arch === 'arm64') {
      console.log(`Running pack:mac:${arch}`);
      execSync(`npm run pack:mac:${arch}`, { stdio: 'inherit' });
    }
  }
};
