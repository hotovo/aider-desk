import path from 'path';

import { getElectronApp, isDev, isElectron } from '@/app';
import { isBunBinary } from '@/bun-resources';

if (process.env.AIDER_DESK_DATA_DIR) {
  const app = getElectronApp();
  if (app) {
    app.setPath('userData', process.env.AIDER_DESK_DATA_DIR);
  }
} else {
  if (isDev()) {
    const app = getElectronApp();
    if (app) {
      app.setPath('userData', `${app.getPath('userData')}-dev`);
    }
  }
}

export const getDataDir = (): string => {
  if (process.env.AIDER_DESK_DATA_DIR) {
    return process.env.AIDER_DESK_DATA_DIR;
  }

  if (isElectron()) {
    return getElectronApp()!.getPath('userData');
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const envPaths = require('env-paths').default;
  return envPaths(isDev() ? 'aider-desk-dev' : 'aider-desk').data;
};

export const getResourceDir = (): string => {
  if (process.env.AIDER_DESK_RESOURCES_DIR) {
    return process.env.AIDER_DESK_RESOURCES_DIR;
  }

  if (isElectron()) {
    return isDev() ? path.join(__dirname, '..', '..', 'resources') : process.resourcesPath;
  }

  // For Bun binaries, use the temp extraction directory
  if (isBunBinary()) {
    return path.join(process.env.TMPDIR || '/tmp', 'aider-desk-resources');
  }

  return path.join(__dirname, '..', 'resources');
};
