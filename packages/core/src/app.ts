import { createRequire } from 'module';
import type { App } from 'electron';

const _require = createRequire(import.meta.url);

export const isElectron = (): boolean => {
  try {
    return process.versions.electron !== undefined;
  } catch {
    return false;
  }
};

let electronApp: App | null = null;
export const getElectronApp = (): App | null => {
  if (!isElectron()) {
    return null;
  }
  if (electronApp) {
    return electronApp;
  }

  electronApp = _require('electron').app as App;
  return electronApp;
};

export const isDev = (): boolean => {
  if (isElectron()) {
    const { is } = _require('@electron-toolkit/utils');
    return is.dev;
  }
  return process.env.NODE_ENV !== 'production';
};
