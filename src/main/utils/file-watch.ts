import * as fs from 'fs';
import { execSync } from 'child_process';

import { FileWatchMode } from '@common/types';

import logger from '@/logger';

let isDockerCache: boolean | undefined;

const isDocker = (): boolean => {
  if (isDockerCache !== undefined) {
    return isDockerCache;
  }

  try {
    isDockerCache = fs.existsSync('/.dockerenv') || fs.existsSync('/run/.containerenv');
  } catch {
    isDockerCache = false;
  }

  return isDockerCache;
};

const isNetworkDrive = (drivePath: string): boolean => {
  try {
    const driveLetter = drivePath.charAt(0).toUpperCase();
    const output = execSync(`net use ${driveLetter}:`, {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output.includes('\\\\') || output.includes('//');
  } catch {
    return false;
  }
};

export const shouldUsePolling = (watchPath: string, mode: FileWatchMode = FileWatchMode.Auto): boolean => {
  if (mode === FileWatchMode.Polling) {
    return true;
  }

  if (mode === FileWatchMode.Native) {
    return false;
  }

  // FileWatchMode.Auto
  if (isDocker()) {
    logger.debug(`[FileWatch] Docker environment detected, using polling for ${watchPath}`);
    return true;
  }

  if (process.platform === 'win32') {
    const isUncPath = watchPath.startsWith('\\\\') || watchPath.startsWith('//');
    const isNetworkLetterDrive = /^[A-Za-z]:/.test(watchPath) && isNetworkDrive(watchPath);

    if (isUncPath || isNetworkLetterDrive) {
      logger.debug(`[FileWatch] Network path detected (${watchPath}), using polling`);
      return true;
    }
  }

  return false;
};
