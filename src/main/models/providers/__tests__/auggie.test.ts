import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProviderProfile, SettingsData, Model } from '@common/types';

describe('Auggie provider', () => {
  const settings = {
    aider: {
      options: '',
      environmentVariables: '',
      addRuleFiles: false,
      autoCommits: true,
      cachingEnabled: true,
      watchFiles: true,
      confirmBeforeEdit: false,
    },
  } as SettingsData;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('does not load the Auggie SDK when the provider module itself is imported', async () => {
    let sdkLoaded = false;

    vi.doMock('@augmentcode/auggie-sdk', () => {
      sdkLoaded = true;
      return {
        AugmentLanguageModel: class {},
        resolveAugmentCredentials: vi.fn(),
      };
    });

    await import('../auggie');

    expect(sdkLoaded).toBe(false);
  });

  it('loads the Auggie SDK lazily when creating an LLM', async () => {
    let sdkLoaded = false;
    const resolveAugmentCredentials = vi.fn().mockResolvedValue({ apiKey: 'token-from-session', apiUrl: 'https://api.augmentcode.com' });

    class MockAugmentLanguageModel {
      public modelId: string;
      public config: unknown;

      constructor(modelId: string, config: unknown) {
        this.modelId = modelId;
        this.config = config;
      }
    }

    vi.doMock('@augmentcode/auggie-sdk', () => {
      sdkLoaded = true;
      return {
        AugmentLanguageModel: MockAugmentLanguageModel,
        resolveAugmentCredentials,
      };
    });

    const { createAuggieLlm } = await import('../auggie');

    const profile = {
      id: 'auggie-profile',
      name: 'Auggie',
      provider: {
        name: 'auggie',
      },
    } as ProviderProfile;
    const model = { id: 'augment/model', providerId: 'auggie-profile' } as Model;
    const llm = (await createAuggieLlm(profile, model, settings, '/project')) as unknown as MockAugmentLanguageModel;

    expect(sdkLoaded).toBe(true);
    expect(resolveAugmentCredentials).toHaveBeenCalledTimes(1);
    expect(llm).toBeInstanceOf(MockAugmentLanguageModel);
    expect(llm.modelId).toBe('augment/model');
    expect(llm.config).toEqual({ apiKey: 'token-from-session', apiUrl: 'https://api.augmentcode.com' });
  });

  it('uses SDK-compatible model IDs and maps legacy IDs forward', async () => {
    class MockAugmentLanguageModel {
      public modelId: string;

      constructor(modelId: string) {
        this.modelId = modelId;
      }
    }

    vi.doMock('@augmentcode/auggie-sdk', () => ({
      AugmentLanguageModel: MockAugmentLanguageModel,
      resolveAugmentCredentials: vi.fn().mockResolvedValue({
        apiKey: 'token-from-session',
        apiUrl: 'https://i1.api.augmentcode.com',
      }),
    }));

    const { createAuggieLlm, loadAuggieModels } = await import('../auggie');

    const profile = {
      id: 'auggie-profile',
      provider: { name: 'auggie' },
    } as ProviderProfile;

    const modelsResponse = await loadAuggieModels(profile, settings);
    expect(modelsResponse.success).toBe(true);
    expect(modelsResponse.models?.map((model) => model.id)).toEqual([
      'claude-haiku-4-5',
      'claude-sonnet-4',
      'claude-sonnet-4-5',
      'claude-opus-4-5',
      'claude-opus-4-6',
      'gpt-5-1',
      'gpt-5-2',
      'gpt-5-4',
    ]);

    const llm = (await createAuggieLlm(
      profile,
      { id: 'claude-sonnet-4-5', providerId: 'auggie-profile' } as Model,
      settings,
      '/project',
    )) as unknown as MockAugmentLanguageModel;

    expect(llm.modelId).toBe('claude-sonnet-4-5');
  });
});
