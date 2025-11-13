import { vi } from 'vitest';

// Mock process.resourcesPath for test environment
Object.defineProperty(process, 'resourcesPath', {
  value: '/tmp/test-resources',
  writable: true,
});

// Mock Electron modules
const mockApp = {
  getPath: vi.fn((path: string) => {
    switch (path) {
      case 'userData':
        return '/tmp/test-user-data';
      default:
        return '/tmp/test';
    }
  }),
  setPath: vi.fn(),
};

const mockBrowserWindow = vi.fn().mockImplementation(() => ({
  webContents: {
    send: vi.fn(),
  },
}));

const mockIpcMain = {
  on: vi.fn(),
  handle: vi.fn(),
  removeListener: vi.fn(),
  removeAllListeners: vi.fn(),
};

const mockDialog = {
  showOpenDialog: vi.fn(),
  showSaveDialog: vi.fn(),
  showErrorBox: vi.fn(),
};

const mockShell = {
  openExternal: vi.fn(),
  showItemInFolder: vi.fn(),
};

const mockClipboard = {
  writeText: vi.fn(),
  readText: vi.fn(),
};

// Mock electron module
vi.mock('electron', () => ({
  app: mockApp,
  BrowserWindow: mockBrowserWindow,
  ipcMain: mockIpcMain,
  dialog: mockDialog,
  shell: mockShell,
  clipboard: mockClipboard,
}));

// Mock @electron-toolkit/utils
vi.mock('@electron-toolkit/utils', () => ({
  is: {
    dev: true, // Set to true in test to use __dirname
    prod: false,
  },
  electronApp: {
    setAppUserModelId: vi.fn(),
  },
  optimizer: {
    watchWindowShortcuts: vi.fn(),
  },
}));

// Export mocks for potential use in tests
export { mockApp, mockBrowserWindow, mockIpcMain, mockDialog, mockShell, mockClipboard };
