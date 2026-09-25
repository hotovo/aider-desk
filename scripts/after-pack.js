const fs = require('fs');
const path = require('path');

const nodeModulesDir = path.join(__dirname, '..', 'node_modules');

const restore = (dir, rel) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const src = path.join(dir, entry.name);
    const dest = path.join(nodeModulesDir, rel, entry.name);
    if (entry.isDirectory()) {
      restore(src, path.join(rel, entry.name));
    } else if (!fs.existsSync(dest)) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.renameSync(src, dest);
    }
  }
};

// Moves everything packaged-pruned in scripts/before-pack.js back into node_modules,
// so the dev environment and other platform builds keep all platform binaries.
exports.default = async function () {
  const backupRoot = path.join(nodeModulesDir, '.pruned-backup');
  if (!fs.existsSync(backupRoot)) return;

  for (const key of fs.readdirSync(backupRoot)) {
    const keyDir = path.join(backupRoot, key);
    restore(keyDir, '');
    fs.rmSync(keyDir, { recursive: true, force: true });
  }
};
