import { afterEach, describe, expect, it, vi } from 'vitest';
import { OllamaProvider } from '@common/agent';
import { ProviderProfile, SettingsData } from '@common/types';

import { loadOllamaModels } from '../ollama';

vi.mock('@/logger');

const profile: ProviderProfile = {
  id: 'ollama-test',
  provider: { name: 'ollama', baseUrl: 'http://localhost:11434' } as OllamaProvider,
} as unknown as ProviderProfile;

const settings = {
  aider: { environmentVariables: '', options: '' },
} as unknown as SettingsData;

const mockFetch = (payload: unknown) => {
  (global.fetch as any) = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => payload,
  } as any);
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadOllamaModels', () => {
  it('sets maxInputTokens from the model context_length when present', async () => {
    mockFetch({
      models: [
        { name: 'model-a:latest', details: { context_length: 262144 } },
        { name: 'model-b:latest', details: {} },
      ],
    });

    const result = await loadOllamaModels(profile, settings);

    expect(result.success).toBe(true);
    expect(result.models).toEqual([
      { id: 'model-a:latest', providerId: 'ollama-test', maxInputTokens: 262144 },
      { id: 'model-b:latest', providerId: 'ollama-test', maxInputTokens: undefined },
    ]);
  });

  it('ignores non-positive or missing context_length', async () => {
    mockFetch({
      models: [{ name: 'model-zero:latest', details: { context_length: 0 } }, { name: 'model-none:latest' }],
    });

    const result = await loadOllamaModels(profile, settings);

    expect(result.models).toEqual([
      { id: 'model-zero:latest', providerId: 'ollama-test', maxInputTokens: undefined },
      { id: 'model-none:latest', providerId: 'ollama-test', maxInputTokens: undefined },
    ]);
  });
});
