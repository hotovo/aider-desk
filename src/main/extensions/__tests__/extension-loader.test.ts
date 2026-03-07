import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Extension, ExtensionMetadata } from '@common/extensions';
import { createJiti } from 'jiti';

import { ExtensionLoader } from '../extension-loader';

// Mock logger
vi.mock('@/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock jiti
vi.mock('jiti', () => ({
  createJiti: vi.fn(() => ({
    import: vi.fn(),
  })),
}));

describe('ExtensionLoader', () => {
  let loader: ExtensionLoader;
  let mockJitiImport: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockJitiImport = vi.fn();
    (createJiti as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      import: mockJitiImport,
    });
    loader = new ExtensionLoader();
  });

  it('should load a valid extension', async () => {
    const mockMetadata: ExtensionMetadata = {
      name: 'test-ext',
      version: '1.0.0',
      description: 'Test extension',
      author: 'Tester',
    };

    class TestExtension implements Extension {
      static metadata = mockMetadata;
    }

    mockJitiImport.mockResolvedValue({ default: TestExtension });

    const result = await loader.loadExtension('/path/to/ext.ts');

    expect(result).not.toBeNull();
    expect(result?.metadata).toEqual(mockMetadata);
    expect(result?.extension).toBeInstanceOf(TestExtension);
  });

  it('should return null if default export is missing', async () => {
    mockJitiImport.mockResolvedValue({});
    const result = await loader.loadExtension('/path/to/ext.ts');
    expect(result).toBeNull();
  });

  it('should return null if default export is not a class', async () => {
    mockJitiImport.mockResolvedValue({ default: {} });
    const result = await loader.loadExtension('/path/to/ext.ts');
    expect(result).toBeNull();
  });

  it('should return null on import error', async () => {
    mockJitiImport.mockRejectedValue(new Error('Import failed'));
    const result = await loader.loadExtension('/path/to/ext.ts');
    expect(result).toBeNull();
  });
});
