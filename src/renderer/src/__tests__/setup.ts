import '@testing-library/jest-dom';
import { vi } from 'vitest';

import { globalMockApi } from './mocks/api';

// Suppress specific console warnings during tests
// eslint-disable-next-line no-console
const originalConsoleWarn = console.warn;
// eslint-disable-next-line no-console
console.warn = (...args: unknown[]) => {
  const warning = args[0];
  if (typeof warning === 'string' && warning.includes('HotkeysProvider')) {
    return;
  }
  originalConsoleWarn(...args);
};

// Mock focus-trap-react
vi.mock('focus-trap-react', () => ({
  FocusTrap: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock i18next
vi.mock('i18next', () => ({
  default: {
    t: (key: string, options?: Record<string, unknown>) => {
      if (options?.extensionName && options?.componentId) {
        return `Extension UI Error: ${options.extensionName}/${options.componentId}`;
      }
      return key;
    },
  },
  t: (key: string, options?: Record<string, unknown>) => {
    if (options?.extensionName && options?.componentId) {
      return `Extension UI Error: ${options.extensionName}/${options.componentId}`;
    }
    return key;
  },
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { provider?: string }) => options?.provider || key,
    i18n: {
      changeLanguage: vi.fn(),
    },
  }),
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock Electron APIs for renderer process
Object.defineProperty(window, 'electron', {
  value: {
    showSaveDialog: vi.fn(() => Promise.resolve({ canceled: false, filePath: '/mock/path' })),
    showOpenDialog: vi.fn(() => Promise.resolve({ canceled: false, filePaths: ['/mock/path'] })),
  },
  writable: true,
});

// Mock ApplicationAPI for renderer process
Object.defineProperty(window, 'api', {
  value: globalMockApi,
  writable: true,
});
