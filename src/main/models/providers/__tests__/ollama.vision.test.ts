import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadOllamaModels } from '../ollama';

import type { OllamaProvider } from '@common/agent';
import type { ProviderProfile, SettingsData } from '@common/types';

describe('loadOllamaModels vision capability detection', () => {
  const originalFetch = global.fetch;

  const settings = { aider: { environmentVariables: '', options: '' } } as unknown as SettingsData;
  const profile: ProviderProfile = {
    id: 'ollama-test',
    provider: { name: 'ollama', baseUrl: 'http://localhost:11434' } as unknown as OllamaProvider,
  };

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  const mockFetch = (handler: (url: string, init?: RequestInit) => Promise<unknown> | unknown) => {
    global.fetch = vi.fn(handler) as unknown as typeof fetch;
  };

  it('sets supportsVision from /api/show capabilities', async () => {
    mockFetch(async (url, init) => {
      const u = String(url);
      if (u.endsWith('/api/tags')) {
        return { ok: true, status: 200, statusText: 'OK', json: async () => ({ models: [{ name: 'llava:7b' }, { name: 'qwen3:35b' }] }) };
      }
      if (u.endsWith('/api/show')) {
        const body = JSON.parse(String(init?.body));
        if (body.name === 'llava:7b') {
          return { ok: true, status: 200, statusText: 'OK', json: async () => ({ capabilities: ['completion', 'vision', 'tools'] }) };
        }
        return { ok: true, status: 200, statusText: 'OK', json: async () => ({ capabilities: ['completion', 'tools'] }) };
      }
      return { ok: false, status: 404, statusText: 'Not Found', text: async () => 'not found' };
    });

    const result = await loadOllamaModels(profile, settings);

    expect(result.success).toBe(true);
    expect(result.models).toHaveLength(2);
    const llava = result.models.find((m) => m.id === 'llava:7b');
    const qwen = result.models.find((m) => m.id === 'qwen3:35b');
    expect(llava?.supportsVision).toBe(true);
    expect(qwen?.supportsVision).toBe(false);
  });

  it('defaults supportsVision to false when /api/show fails', async () => {
    mockFetch(async (url) => {
      const u = String(url);
      if (u.endsWith('/api/tags')) {
        return { ok: true, status: 200, statusText: 'OK', json: async () => ({ models: [{ name: 'mystery:1' }] }) };
      }
      if (u.endsWith('/api/show')) {
        throw new Error('network error');
      }
      return { ok: false, status: 404, statusText: 'Not Found', text: async () => 'not found' };
    });

    const result = await loadOllamaModels(profile, settings);

    expect(result.success).toBe(true);
    expect(result.models).toHaveLength(1);
    expect(result.models[0].supportsVision).toBe(false);
  });
});
