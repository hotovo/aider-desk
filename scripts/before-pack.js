const fs = require('fs');
const path = require('path');
const { Arch } = require('electron-builder');

const NodeArch = {
  x64: 'x64',
  arm64: 'arm64',
};

const nodePlatform = (platformName) => (platformName === 'mac' ? 'darwin' : platformName === 'linux' ? 'linux' : 'win32');

const pruneToBackup = (nodeModulesDir, relPaths, key) => {
  const target = path.join(nodeModulesDir, '.pruned-backup', key);
  for (const rel of relPaths) {
    const src = path.join(nodeModulesDir, rel);
    const dest = path.join(target, rel);
    if (!fs.existsSync(src)) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.renameSync(src, dest);
    console.log(`Pruned ${rel} from package`);
  }
};

const pruneOnnxruntimeNode = (nodeModulesDir, nodePlatformName, nodeArch, key) => {
  const dirRelative = 'onnxruntime-node/bin/napi-v3';
  const dir = path.join(nodeModulesDir, dirRelative);
  if (!fs.existsSync(dir)) return;

  const pruned = [];
  for (const platformDir of fs.readdirSync(dir)) {
    if (!fs.statSync(path.join(dir, platformDir)).isDirectory()) continue;
    if (platformDir !== nodePlatformName) {
      pruned.push(`${dirRelative}/${platformDir}`);
    } else if (nodeArch) {
      const platformDirPath = path.join(dir, platformDir);
      for (const archDir of fs.readdirSync(platformDirPath)) {
        if (archDir === nodeArch) continue;
        pruned.push(`${dirRelative}/${platformDir}/${archDir}`);
      }
      const archDirPath = path.join(platformDirPath, nodeArch);
      if (fs.existsSync(archDirPath)) {
        // CUDA and TensorRT execution providers are loaded dynamically and are not used (embeddings run on CPU); they add ~344MB on linux/x64.
        for (const file of fs.readdirSync(archDirPath)) {
          if (file.includes('providers_cuda') || file.includes('providers_tensorrt')) {
            pruned.push(`${dirRelative}/${platformDir}/${nodeArch}/${file}`);
          }
        }
      }
    }
  }
  pruneToBackup(nodeModulesDir, pruned, key);
};

const pruneLanceDb = (nodeModulesDir, nodePlatformName, nodeArch, key) => {
  const dirRelative = '@lancedb';
  const dir = path.join(nodeModulesDir, dirRelative);
  if (!fs.existsSync(dir)) return;
  if (!nodeArch) return;

  const subdirs = fs.readdirSync(dir).filter((d) => fs.statSync(path.join(dir, d)).isDirectory());
  // lancedb ships glibc (gnu) and musl builds; our Linux targets (AppImage/deb/rpm) use glibc, so only keep the gnu flavor
  const wanted = subdirs.filter((d) => d !== 'lancedb' && d.includes(`lancedb-${nodePlatformName}-${nodeArch}-`) && (nodePlatformName !== 'linux' || d.endsWith('-gnu')));
  // only prune when we found a matching subpackage for the current platform/arch, otherwise keep everything to be safe
  if (wanted.length > 0) {
    pruneToBackup(nodeModulesDir, subdirs.filter((d) => d !== 'lancedb' && !wanted.includes(d)).map((d) => `${dirRelative}/${d}`), key);
  }
};

// Moves platform-mismatched native binaries away from node_modules for the duration of packaging,
// so they are not included in the bundle; restored again in scripts/after-pack.js.
exports.default = async function (context) {
  const arch = context.arch === Arch.x64 ? 'x64' : context.arch === Arch.arm64 ? 'arm64' : undefined;
  const platformName = context.packager.platform.name;
  if (!arch || !platformName) return;

  const nodeModulesDir = path.join(__dirname, '..', 'node_modules');
  const nodePlatformName = nodePlatform(platformName);
  const key = `${nodePlatformName}-${arch}`;

  console.log(`Pruning native modules before packing for ${key}...`);
  pruneOnnxruntimeNode(nodeModulesDir, nodePlatformName, arch, key);
  pruneLanceDb(nodeModulesDir, nodePlatformName, arch, key);
};
