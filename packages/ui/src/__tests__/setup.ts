import '@testing-library/jest-dom';
import { vi } from 'vitest';

import { globalMockApi } from './mocks/api';

// Mock focus-trap-react
vi.mock('focus-trap-react', () => ({
  FocusTrap: ({ children }: { children: React.ReactNode }) => children,
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
