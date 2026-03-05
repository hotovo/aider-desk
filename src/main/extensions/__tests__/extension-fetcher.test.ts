import * as fsPromises from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ExtensionFetcher } from '../extension-fetcher';

// Mock the shell utility
vi.mock('@/utils/shell', () => ({
  execWithShellPath: vi.fn(),
}));

// Mock logger
vi.mock('@/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ExtensionFetcher', () => {
  let fetcher: ExtensionFetcher;

  beforeEach(() => {
    vi.clearAllMocks();
    fetcher = new ExtensionFetcher();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Capabilities Metadata Extraction', () => {
    // Helper to create temp test file and test metadata extraction
    const createAndTestMetadata = async (fileContent: string): Promise<unknown> => {
      const realTempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'ext-test-'));
      const extDir = path.join(realTempDir, 'test-extension');
      await fsPromises.mkdir(extDir);
      const extFile = path.join(extDir, 'index.ts');
      await fsPromises.writeFile(extFile, fileContent);

      try {
        const testFetcher = new ExtensionFetcher();
        // Access private method via type assertion
        const getStaticMetadata = (testFetcher as unknown as { getStaticMetadata: (filePath: string) => unknown }).getStaticMetadata.bind(testFetcher);
        return getStaticMetadata(extFile);
      } finally {
        await fsPromises.rm(realTempDir, { recursive: true, force: true });
      }
    };

    it('should extract capabilities from extension metadata', async () => {
      const mockFileContent = `
        export class MyExtension implements Extension {
          static metadata: ExtensionMetadata = {
            name: 'My Extension',
            version: '1.0.0',
            description: 'A test extension',
            author: 'Test Author',
            capabilities: ['tools', 'commands', 'ui-elements'],
          };
        }
      `;

      const metadata = await createAndTestMetadata(mockFileContent);

      expect(metadata).toEqual({
        name: 'My Extension',
        version: '1.0.0',
        description: 'A test extension',
        author: 'Test Author',
        capabilities: ['tools', 'commands', 'ui-elements'],
      });
    });

    it('should handle extensions without capabilities', async () => {
      const mockFileContent = `
        export class MyExtension implements Extension {
          static metadata: ExtensionMetadata = {
            name: 'Simple Extension',
            version: '2.0.0',
            description: 'A simple extension without capabilities',
          };
        }
      `;

      const metadata = await createAndTestMetadata(mockFileContent);

      expect(metadata).toEqual({
        name: 'Simple Extension',
        version: '2.0.0',
        description: 'A simple extension without capabilities',
      });
      expect(metadata).not.toHaveProperty('capabilities');
    });

    it('should handle empty capabilities array', async () => {
      const mockFileContent = `
        export class MyExtension implements Extension {
          static metadata: ExtensionMetadata = {
            name: 'Empty Caps Extension',
            version: '1.0.0',
            capabilities: [],
          };
        }
      `;

      const metadata = await createAndTestMetadata(mockFileContent);

      expect(metadata).toEqual({
        name: 'Empty Caps Extension',
        version: '1.0.0',
        capabilities: [],
      });
    });

    it('should handle metadata with variable reference', async () => {
      const mockFileContent = `
        const metadata: ExtensionMetadata = {
          name: 'Variable Extension',
          version: '1.0.0',
          capabilities: ['tools'],
        };

        export class VariableExtension implements Extension {
          static metadata = metadata;
        }
      `;

      const metadata = await createAndTestMetadata(mockFileContent);

      expect(metadata).toEqual({
        name: 'Variable Extension',
        version: '1.0.0',
        capabilities: ['tools'],
      });
    });

    it('should return null for files without metadata', async () => {
      const mockFileContent = `
        export class NoMetadataExtension implements Extension {
          // No static metadata property
        }
      `;

      const metadata = await createAndTestMetadata(mockFileContent);

      expect(metadata).toBeNull();
    });

    it('should handle single capability', async () => {
      const mockFileContent = `
        export class MyExtension implements Extension {
          static metadata: ExtensionMetadata = {
            name: 'Single Cap Extension',
            version: '1.0.0',
            capabilities: ['tools'],
          };
        }
      `;

      const metadata = await createAndTestMetadata(mockFileContent);

      expect(metadata).toEqual({
        name: 'Single Cap Extension',
        version: '1.0.0',
        capabilities: ['tools'],
      });
    });

    it('should handle JavaScript files (.js)', async () => {
      const realTempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'ext-test-'));
      const extDir = path.join(realTempDir, 'js-extension');
      await fsPromises.mkdir(extDir);
      const extFile = path.join(extDir, 'index.js');
      const mockFileContent = `
        export class JsExtension {
          static metadata = {
            name: 'JS Extension',
            version: '1.0.0',
            capabilities: ['tools', 'commands'],
          };
        }
      `;
      await fsPromises.writeFile(extFile, mockFileContent);

      try {
        const testFetcher = new ExtensionFetcher();
        const getStaticMetadata = (testFetcher as unknown as { getStaticMetadata: (filePath: string) => unknown }).getStaticMetadata.bind(testFetcher);
        const metadata = getStaticMetadata(extFile);

        expect(metadata).toEqual({
          name: 'JS Extension',
          version: '1.0.0',
          capabilities: ['tools', 'commands'],
        });
      } finally {
        await fsPromises.rm(realTempDir, { recursive: true, force: true });
      }
    });
  });

  describe('getRawUrl', () => {
    it('should convert GitHub URL with tree path to raw URL', () => {
      const webUrl = 'https://github.com/owner/repo/tree/main/extensions';
      const rawUrl = fetcher.getRawUrl(webUrl);

      expect(rawUrl).toBe('https://raw.githubusercontent.com/owner/repo/main/extensions');
    });

    it('should convert GitHub root URL to raw URL', () => {
      const webUrl = 'https://github.com/owner/repo';
      const rawUrl = fetcher.getRawUrl(webUrl);

      expect(rawUrl).toBe('https://raw.githubusercontent.com/owner/repo/main');
    });

    it('should handle URL with trailing slash', () => {
      const webUrl = 'https://github.com/owner/repo/';
      const rawUrl = fetcher.getRawUrl(webUrl);

      expect(rawUrl).toBe('https://raw.githubusercontent.com/owner/repo/main');
    });

    it('should return null for invalid URLs', () => {
      const invalidUrl = 'not-a-valid-url';
      const rawUrl = fetcher.getRawUrl(invalidUrl);

      expect(rawUrl).toBeNull();
    });

    it('should return null for non-GitHub URLs', () => {
      const nonGithubUrl = 'https://gitlab.com/owner/repo';
      const rawUrl = fetcher.getRawUrl(nonGithubUrl);

      expect(rawUrl).toBeNull();
    });
  });
});
