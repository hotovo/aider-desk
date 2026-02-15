import path from 'path';
import { createRequire } from 'module';

import { getElectronApp, isDev, isElectron } from '@/app';

const _require = createRequire(import.meta.url);

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
  const envPaths = _require('env-paths').default;
  return envPaths(isDev() ? 'aider-desk-dev' : 'aider-desk').data;
};

export const getResourceDir = (): string => {
  if (process.env.AIDER_DESK_RESOURCES_DIR) {
    return process.env.AIDER_DESK_RESOURCES_DIR;
  }

  if (isElectron()) {
    return isDev() ? path.join(__dirname, '..', '..', 'resources') : process.resourcesPath;
  }
  return path.join(__dirname, '..', 'resources');
};
