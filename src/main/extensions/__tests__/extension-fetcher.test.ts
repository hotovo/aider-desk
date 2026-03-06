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

  describe('getAvailableExtensions - Promise Caching', () => {
    it('should cache the promise and return it on subsequent calls', async () => {
      const repositories = ['https://github.com/owner/repo'];
      const mockExtensions = [{ id: 'ext1', name: 'Extension 1', version: '1.0.0', type: 'single' as const, repositoryUrl: repositories[0] }];

      // Mock the internal method to track calls
      const internalSpy = vi
        .spyOn(fetcher as unknown as { getAvailableExtensionsInternal: () => Promise<unknown[]> }, 'getAvailableExtensionsInternal')
        .mockResolvedValue(mockExtensions);

      // First call
      const result1 = await fetcher.getAvailableExtensions(repositories);

      // Second call without forceRefresh
      const result2 = await fetcher.getAvailableExtensions(repositories);

      // Verify the internal method was only called once
      expect(internalSpy).toHaveBeenCalledTimes(1);

      // Verify both calls return the same result
      expect(result1).toEqual(mockExtensions);
      expect(result2).toEqual(mockExtensions);
    });

    it('should use cached promise on subsequent calls', async () => {
      const repositories = ['https://github.com/owner/repo'];
      const mockExtensions = [{ id: 'ext1', name: 'Extension 1', version: '1.0.0', type: 'single' as const, repositoryUrl: repositories[0] }];

      vi.spyOn(fetcher as unknown as { getAvailableExtensionsInternal: () => Promise<unknown[]> }, 'getAvailableExtensionsInternal').mockResolvedValue(
        mockExtensions,
      );

      // First call
      const result1 = await fetcher.getAvailableExtensions(repositories);

      // Access the internal promise field to verify it's cached
      const cachedPromise = (fetcher as unknown as { getAvailableExtensionsPromise: Promise<unknown[]> | null }).getAvailableExtensionsPromise;
      expect(cachedPromise).not.toBeNull();

      // Second call should use the same cached promise
      const result2 = await fetcher.getAvailableExtensions(repositories);

      // Verify the cached promise is still the same
      const cachedPromise2 = (fetcher as unknown as { getAvailableExtensionsPromise: Promise<unknown[]> | null }).getAvailableExtensionsPromise;
      expect(cachedPromise2).toBe(cachedPromise);

      // Verify both results are the same
      expect(result1).toEqual(mockExtensions);
      expect(result2).toEqual(mockExtensions);
    });

    it('should create a new promise when forceRefresh is true', async () => {
      const repositories = ['https://github.com/owner/repo'];
      const mockExtensions1 = [{ id: 'ext1', name: 'Extension 1', version: '1.0.0', type: 'single' as const, repositoryUrl: repositories[0] }];
      const mockExtensions2 = [{ id: 'ext2', name: 'Extension 2', version: '2.0.0', type: 'single' as const, repositoryUrl: repositories[0] }];

      const internalSpy = vi
        .spyOn(fetcher as unknown as { getAvailableExtensionsInternal: () => Promise<unknown[]> }, 'getAvailableExtensionsInternal')
        .mockResolvedValueOnce(mockExtensions1)
        .mockResolvedValueOnce(mockExtensions2);

      // First call without forceRefresh
      const result1 = await fetcher.getAvailableExtensions(repositories, false);

      // Second call with forceRefresh = true
      const result2 = await fetcher.getAvailableExtensions(repositories, true);

      // Verify the internal method was called twice
      expect(internalSpy).toHaveBeenCalledTimes(2);

      // Verify both calls return their respective results
      expect(result1).toEqual(mockExtensions1);
      expect(result2).toEqual(mockExtensions2);

      // Verify forceRefresh was passed correctly
      expect(internalSpy).toHaveBeenNthCalledWith(1, repositories, false);
      expect(internalSpy).toHaveBeenNthCalledWith(2, repositories, true);
    });

    it('should clear cached promise when an error occurs', async () => {
      const repositories = ['https://github.com/owner/repo'];
      const mockError = new Error('Fetch failed');

      const internalSpy = vi
        .spyOn(fetcher as unknown as { getAvailableExtensionsInternal: () => Promise<unknown[]> }, 'getAvailableExtensionsInternal')
        .mockRejectedValue(mockError);

      // First call should throw
      await expect(fetcher.getAvailableExtensions(repositories)).rejects.toThrow('Fetch failed');

      // Verify the cached promise is cleared
      const cachedPromise = (fetcher as unknown as { getAvailableExtensionsPromise: Promise<unknown[]> | null }).getAvailableExtensionsPromise;
      expect(cachedPromise).toBeNull();

      // Second call should also throw and call the internal method again (not use cache)
      await expect(fetcher.getAvailableExtensions(repositories)).rejects.toThrow('Fetch failed');

      // Verify internal method was called twice (once for each call since cache was cleared)
      expect(internalSpy).toHaveBeenCalledTimes(2);
    });

    it('should cache new promise after error is cleared', async () => {
      const repositories = ['https://github.com/owner/repo'];
      const mockError = new Error('Fetch failed');
      const mockExtensions = [{ id: 'ext1', name: 'Extension 1', version: '1.0.0', type: 'single' as const, repositoryUrl: repositories[0] }];

      const internalSpy = vi
        .spyOn(fetcher as unknown as { getAvailableExtensionsInternal: () => Promise<unknown[]> }, 'getAvailableExtensionsInternal')
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce(mockExtensions);

      // First call should throw and clear the cache
      await expect(fetcher.getAvailableExtensions(repositories)).rejects.toThrow('Fetch failed');

      // Second call should succeed and cache the new promise
      const result1 = await fetcher.getAvailableExtensions(repositories);

      // Third call should return the cached promise
      const result2 = await fetcher.getAvailableExtensions(repositories);

      // Verify internal method was called twice (once for error, once for success)
      expect(internalSpy).toHaveBeenCalledTimes(2);

      // Verify both successful calls return the same result
      expect(result1).toEqual(mockExtensions);
      expect(result2).toEqual(mockExtensions);
    });

    it('should handle concurrent calls without forceRefresh', async () => {
      const repositories = ['https://github.com/owner/repo'];
      const mockExtensions = [{ id: 'ext1', name: 'Extension 1', version: '1.0.0', type: 'single' as const, repositoryUrl: repositories[0] }];

      let resolvePromise: (value: unknown[]) => void;
      const pendingPromise = new Promise<unknown[]>((resolve) => {
        resolvePromise = resolve;
      });

      const internalSpy = vi
        .spyOn(fetcher as unknown as { getAvailableExtensionsInternal: () => Promise<unknown[]> }, 'getAvailableExtensionsInternal')
        .mockReturnValue(pendingPromise);

      // Start multiple concurrent calls before the promise resolves
      const promise1 = fetcher.getAvailableExtensions(repositories);
      const promise2 = fetcher.getAvailableExtensions(repositories);
      const promise3 = fetcher.getAvailableExtensions(repositories);

      // Verify the internal promise field is set
      const cachedPromise = (fetcher as unknown as { getAvailableExtensionsPromise: Promise<unknown[]> | null }).getAvailableExtensionsPromise;
      expect(cachedPromise).not.toBeNull();

      // Resolve the promise
      resolvePromise!(mockExtensions);

      // Await all promises
      const results = await Promise.all([promise1, promise2, promise3]);

      // Verify internal method was only called once (all concurrent calls use the same cached promise)
      expect(internalSpy).toHaveBeenCalledTimes(1);

      // Verify all results are the same
      expect(results[0]).toEqual(mockExtensions);
      expect(results[1]).toEqual(mockExtensions);
      expect(results[2]).toEqual(mockExtensions);
    });

    it('should cache new promise when forceRefresh is true and subsequent calls use cache', async () => {
      const repositories = ['https://github.com/owner/repo'];
      const mockExtensions = [{ id: 'ext1', name: 'Extension 1', version: '1.0.0', type: 'single' as const, repositoryUrl: repositories[0] }];

      const internalSpy = vi
        .spyOn(fetcher as unknown as { getAvailableExtensionsInternal: () => Promise<unknown[]> }, 'getAvailableExtensionsInternal')
        .mockResolvedValue(mockExtensions);

      // First call with forceRefresh = true should create and cache a new promise
      const result1 = await fetcher.getAvailableExtensions(repositories, true);

      // Verify the promise is cached
      const cachedPromise1 = (fetcher as unknown as { getAvailableExtensionsPromise: Promise<unknown[]> | null }).getAvailableExtensionsPromise;
      expect(cachedPromise1).not.toBeNull();

      // Second call without forceRefresh should use the cached promise
      const result2 = await fetcher.getAvailableExtensions(repositories, false);

      // Verify the cached promise is still the same
      const cachedPromise2 = (fetcher as unknown as { getAvailableExtensionsPromise: Promise<unknown[]> | null }).getAvailableExtensionsPromise;
      expect(cachedPromise2).toBe(cachedPromise1);

      // Third call without forceRefresh should also use the cached promise
      const result3 = await fetcher.getAvailableExtensions(repositories, false);

      // Verify internal method was only called once (for the forceRefresh call)
      expect(internalSpy).toHaveBeenCalledTimes(1);

      // Verify all results are the same
      expect(result1).toEqual(mockExtensions);
      expect(result2).toEqual(mockExtensions);
      expect(result3).toEqual(mockExtensions);
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
