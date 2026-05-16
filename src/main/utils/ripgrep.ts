import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

import AdmZip from 'adm-zip';

import logger from '@/logger';
import { AIDER_DESK_BIN_DIR, RIPGREP_BINARY_PATH } from '@/constants';

const RIPGREP_VERSION = '15.1.0';
const RIPGREP_BASE_URL = `https://github.com/BurntSushi/ripgrep/releases/download/${RIPGREP_VERSION}`;

const getRipgrepAssetName = (): string => {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'win32') {
    return arch === 'arm64' ? `ripgrep-${RIPGREP_VERSION}-aarch64-pc-windows-msvc.zip` : `ripgrep-${RIPGREP_VERSION}-x86_64-pc-windows-msvc.zip`;
  }

  if (platform === 'darwin') {
    return arch === 'arm64' ? `ripgrep-${RIPGREP_VERSION}-aarch64-apple-darwin.tar.gz` : `ripgrep-${RIPGREP_VERSION}-x86_64-apple-darwin.tar.gz`;
  }

  // linux - use musl for broader compatibility
  if (arch === 'arm64') {
    return `ripgrep-${RIPGREP_VERSION}-aarch64-unknown-linux-gnu.tar.gz`;
  }

  return `ripgrep-${RIPGREP_VERSION}-x86_64-unknown-linux-musl.tar.gz`;
};

const isRipgrepAvailable = (): boolean => {
  try {
    if (!fs.existsSync(RIPGREP_BINARY_PATH)) {
      return false;
    }

    const result = execSync(`"${RIPGREP_BINARY_PATH}" --version`, {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
    });

    if (!result.includes('ripgrep')) {
      return false;
    }

    logger.debug(`ripgrep is available at ${RIPGREP_BINARY_PATH}: ${result.trim()}`);
    return true;
  } catch {
    return false;
  }
};

const downloadRipgrep = async (): Promise<void> => {
  const filename = getRipgrepAssetName();
  const url = `${RIPGREP_BASE_URL}/${filename}`;

  if (!fs.existsSync(AIDER_DESK_BIN_DIR)) {
    fs.mkdirSync(AIDER_DESK_BIN_DIR, { recursive: true });
  }

  const tempFile = path.join(AIDER_DESK_BIN_DIR, filename);
  const rgExeName = process.platform === 'win32' ? 'rg.exe' : 'rg';

  try {
    logger.info(`Downloading ripgrep from ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(tempFile, buffer);

    if (filename.endsWith('.tar.gz')) {
      const { extract } = await import('tar');
      await extract({
        cwd: AIDER_DESK_BIN_DIR,
        file: tempFile,
        strip: 1,
      });
    } else if (filename.endsWith('.zip')) {
      const zip = new AdmZip(tempFile);
      const entry = zip.getEntry(rgExeName) || zip.getEntries().find((e) => e.entryName.endsWith(rgExeName));
      if (entry) {
        fs.writeFileSync(path.join(AIDER_DESK_BIN_DIR, rgExeName), entry.getData());
      } else {
        throw new Error(`Could not find ${rgExeName} in zip archive`);
      }
    }

    if (process.platform !== 'win32') {
      fs.chmodSync(path.join(AIDER_DESK_BIN_DIR, rgExeName), 0o755);
    }

    logger.info(`ripgrep downloaded successfully to ${AIDER_DESK_BIN_DIR}`);
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
};

let ripgrepEnsured = false;
let ripgrepEnsurePromise: Promise<void> | null = null;

export const ensureRipgrepBinary = async (): Promise<boolean> => {
  if (ripgrepEnsured) {
    return true;
  }

  if (!ripgrepEnsurePromise) {
    ripgrepEnsurePromise = (async () => {
      if (isRipgrepAvailable()) {
        ripgrepEnsured = true;
        return;
      }

      await downloadRipgrep();

      if (!isRipgrepAvailable()) {
        throw new Error('ripgrep binary not found after download');
      }

      ripgrepEnsured = true;
    })();
  }

  try {
    await ripgrepEnsurePromise;
    return true;
  } catch (error) {
    ripgrepEnsurePromise = null;
    logger.error('Failed to ensure ripgrep binary:', error);
    return false;
  }
};
