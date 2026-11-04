vi.mock('@common/agent', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@common/agent')>()),
  AVAILABLE_PROVIDERS: [],
}));

vi.mock('@/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/constants', () => ({
  AIDER_DESK_CACHE_DIR: '/test-cache',
  AIDER_DESK_DATA_DIR: '/test-data',
}));

vi.mock('@/store', () => ({ Store: vi.fn() }));
vi.mock('@/events', () => ({ EventManager: vi.fn() }));
vi.mock('@/task/task', () => ({ Task: vi.fn() }));

vi.mock('fs', () => {
  const promises = {
    access: vi.fn().mockRejectedValue(new Error('not found')),
    readFile: vi.fn().mockRejectedValue(new Error('not found')),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
  };
  return { promises, default: { promises } };
});

vi.mock('../providers/anthropic', () => ({ anthropicProviderStrategy: {} }));
vi.mock('../providers/anthropic-compatible', () => ({ anthropicCompatibleProviderStrategy: {} }));
vi.mock('../providers/azure', () => ({ azureProviderStrategy: {} }));
vi.mock('../providers/bedrock', () => ({ bedrockProviderStrategy: {} }));
vi.mock('../providers/cerebras', () => ({ cerebrasProviderStrategy: {} }));
vi.mock('../providers/clinepass', () => ({ clinePassProviderStrategy: {} }));
vi.mock('../providers/deepseek', () => ({ deepseekProviderStrategy: {} }));
vi.mock('../providers/gemini', () => ({ geminiProviderStrategy: {} }));
vi.mock('../providers/gpustack', () => ({ gpustackProviderStrategy: {} }));
vi.mock('../providers/groq', () => ({ groqProviderStrategy: {} }));
vi.mock('../providers/alibaba-plan', () => ({ alibabaPlanProviderStrategy: {} }));
vi.mock('../providers/kimi-plan', () => ({ kimiPlanProviderStrategy: {} }));
vi.mock('../providers/litellm', () => ({ litellmProviderStrategy: {} }));
vi.mock('../providers/lm-studio', () => ({ lmStudioProviderStrategy: {} }));
vi.mock('../providers/minimax', () => ({ minimaxProviderStrategy: {} }));
vi.mock('../providers/mistral', () => ({ mistralProviderStrategy: {} }));
vi.mock('../providers/neuralwatt', () => ({ neuralwattProviderStrategy: {} }));
vi.mock('../providers/ollama', () => ({ ollamaProviderStrategy: {} }));
vi.mock('../providers/openai', () => ({ openaiProviderStrategy: {} }));
vi.mock('../providers/openai-compatible', () => ({ openaiCompatibleProviderStrategy: {} }));
vi.mock('../providers/opencode', () => ({ opencodeProviderStrategy: {} }));
vi.mock('../providers/opencode-go', () => ({ opencodeGoProviderStrategy: {} }));
vi.mock('../providers/openrouter', () => ({ openrouterProviderStrategy: {} }));
vi.mock('../providers/requesty', () => ({ requestyProviderStrategy: {} }));
vi.mock('../providers/synthetic', () => ({ syntheticProviderStrategy: {} }));
vi.mock('../providers/vertex-ai', () => ({ vertexAiProviderStrategy: {} }));
vi.mock('../providers/zai-plan', () => ({
  zaiPlanProviderStrategy: {
    getUsageReport: vi.fn().mockReturnValue({
      model: 'zai-plan/glm-5.3',
      sentTokens: 35,
      receivedTokens: 136,
      cacheReadTokens: 11008,
      cacheWriteTokens: 0,
      messageCost: 0,
      agentTotalCost: 0,
    }),
  },
}));

import { promises as fs } from 'fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModelModality } from '@common/types';

import { openaiProviderStrategy } from '../providers/openai';
import { zaiPlanProviderStrategy } from '../providers/zai-plan';

import type { LanguageModelUsage } from 'ai';
import type { Model, ProviderProfile, SettingsData } from '@common/types';
import type { Task } from '@/task/task';
import type { Store } from '@/store';
import type { EventManager } from '@/events';

const ModelManagerModule = await import('../model-manager');
const { ModelManager } = ModelManagerModule;

const task = {} as unknown as Task;

const zaiProfile = {
  id: 'zai-plan',
  name: 'ZAI Plan',
  provider: { name: 'zai-plan' },
} as unknown as ProviderProfile;

const usage = {
  inputTokens: 11043,
  outputTokens: 136,
} as LanguageModelUsage;

const setProviderModels = (manager: InstanceType<typeof ModelManager>, models: Record<string, Model[]>) => {
  (manager as unknown as { providerModels: Record<string, Model[]> }).providerModels = models;
};

const createManager = (providers: ProviderProfile[] = []) => {
  const store = {
    getProviders: vi.fn(() => providers),
    getSettings: vi.fn(() => ({}) as SettingsData),
    setProviders: vi.fn(),
  } as unknown as Store;
  const eventManager = {
    sendProviderModelsUpdated: vi.fn(),
    sendSettingsUpdated: vi.fn(),
    sendProvidersUpdated: vi.fn(),
  } as unknown as EventManager;
  return new ModelManager(store, eventManager);
};

describe('ModelManager - getUsageReport', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network disabled')));
    vi.mocked(zaiPlanProviderStrategy.getUsageReport).mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back to a minimal model instead of throwing when the model is not loaded', () => {
    const manager = createManager();
    setProviderModels(manager, { 'zai-plan': [] });

    const report = manager.getUsageReport(task, zaiProfile, 'glm-5.3', usage);

    expect(report.model).toBe('zai-plan/glm-5.3');
    expect(zaiPlanProviderStrategy.getUsageReport).toHaveBeenCalledWith(task, zaiProfile, { id: 'glm-5.3', providerId: 'zai-plan' }, usage, undefined);
  });

  it('uses the loaded model settings when available', () => {
    const manager = createManager();
    const loadedModel: Model = { id: 'glm-5.3', providerId: 'zai-plan', temperature: 0.7 };
    setProviderModels(manager, { 'zai-plan': [loadedModel] });

    manager.getUsageReport(task, zaiProfile, 'glm-5.3', usage);

    expect(zaiPlanProviderStrategy.getUsageReport).toHaveBeenCalledWith(task, zaiProfile, loadedModel, usage, undefined);
  });

  it('forwards provider tool approvals through the extension strategy wrapper', async () => {
    const manager = createManager();
    const createLlm = vi.fn().mockReturnValue('test-model');
    const provider = {
      id: 'native-test',
      name: 'Native Test',
      provider: { name: 'native-test' },
      strategy: { createLlm, loadModels: vi.fn().mockResolvedValue({ success: true, models: [] }) },
    };
    manager.registerExtensionProviders([{ extensionId: 'test', extensionName: 'Test', provider }]);
    const profile = manager.getExtensionProviderProfiles()[0];
    const model: Model = { id: 'free', providerId: profile.id };
    const approveTool = vi.fn(async (): Promise<[boolean, string?]> => [true]);
    expect(await manager.createLlm(profile, model, {} as SettingsData, '/workspace', {}, 'system', undefined, 'session', approveTool)).toBe('test-model');
    expect(createLlm).toHaveBeenCalledExactlyOnceWith(profile, model, {}, '/workspace', {}, 'system', undefined, undefined, 'session', approveTool);
  });

  it('still throws for unsupported providers', () => {
    const manager = createManager();
    const unknownProfile = {
      id: 'unknown',
      provider: { name: 'unknown-provider' },
    } as unknown as ProviderProfile;

    expect(() => manager.getUsageReport(task, unknownProfile, 'glm-5.3', usage)).toThrow('Unsupported LLM provider');
  });
});

describe('ModelManager streaming requirements', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network disabled')));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    [{}, {}, {}, false, false],
    [{ requireStreaming: true }, {}, {}, true, false],
    [{ requireStreaming: true }, { disableStreaming: false }, {}, true, false],
    [{ requireStreaming: true }, { disableStreaming: true }, {}, false, true],
    [{}, { requireStreaming: true }, { disableStreaming: true }, false, true],
    [{}, { disableStreaming: true }, { requireStreaming: true }, true, false],
    [{ requireStreaming: true }, {}, { requireStreaming: false }, false, false],
    [{}, { requireStreaming: true }, { requireStreaming: false }, false, false],
    [{}, {}, { disableStreaming: true, requireStreaming: true }, true, false],
  ])('resolves model %j, provider %j and overrides %j', (modelFlags, providerFlags, overrides, required, disabled) => {
    const manager = createManager();
    const provider = { id: 'test', provider: { name: 'openai', apiKey: '', ...providerFlags } } as ProviderProfile;
    setProviderModels(manager, { test: [{ id: 'model', providerId: 'test', ...modelFlags, providerOverrides: overrides }] });
    expect(manager.isStreamingRequired(provider, 'model')).toBe(required);
    expect(manager.isStreamingDisabled(provider, 'model')).toBe(disabled);
  });

  it('uses provider defaults when a model is not loaded', () => {
    const manager = createManager();
    const provider = { id: 'test', provider: { name: 'openai', apiKey: '', requireStreaming: true } } as ProviderProfile;
    expect(manager.isStreamingRequired(provider, 'missing')).toBe(true);
    expect(manager.isStreamingDisabled(provider, 'missing')).toBe(false);
  });
});

describe('ModelManager getModelModalities', () => {
  const profile = { id: 'personal-openai', name: 'My account', provider: { name: 'openai' } } as ProviderProfile;
  const modalities = { input: [ModelModality.Text, ModelModality.Image], output: [ModelModality.Text] };

  beforeEach(() => {
    vi.mocked(fs.access).mockRejectedValue(new Error('not found'));
    vi.mocked(fs.readFile).mockRejectedValue(new Error('not found'));
    Object.assign(openaiProviderStrategy, {
      hasEnvVars: () => false,
      loadModels: vi.fn(async () => ({ success: true, models: [{ id: 'vision', providerId: profile.id }] })),
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          openai: {
            models: {
              vision: { id: 'vision', limit: { context: 1000, output: 100 }, modalities },
              plain: { id: 'plain', limit: { context: 1000, output: 100 } },
            },
          },
        }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(openaiProviderStrategy, 'loadModels');
    Reflect.deleteProperty(openaiProviderStrategy, 'hasEnvVars');
  });

  it('returns models.dev metadata', async () => {
    const manager = createManager([profile]);
    await manager.waitForInit();
    expect(manager.getModelModalities(profile.id, 'vision')).toEqual(modalities);
  });

  it('returns undefined for models without any modality source', async () => {
    const manager = createManager([profile]);
    await manager.waitForInit();
    expect(manager.getModelModalities(profile.id, 'plain')).toBeUndefined();
  });

  it('returns undefined for missing providers and models', async () => {
    const manager = createManager([profile]);
    await manager.waitForInit();
    expect(manager.getModelModalities('missing-provider', 'vision')).toBeUndefined();
    expect(manager.getModelModalities(profile.id, 'no-such-model')).toBeUndefined();
  });

  it('returns provider-declared modalities', async () => {
    const declared = { input: [], output: [] };
    vi.mocked(openaiProviderStrategy.loadModels).mockResolvedValue({ success: true, models: [{ id: 'vision', providerId: profile.id, modalities: declared }] });
    const manager = createManager([profile]);
    await manager.waitForInit();
    expect(manager.getModelModalities(profile.id, 'vision')).toEqual(declared);
  });

  it('returns persisted overrides', async () => {
    const manager = createManager([profile]);
    await manager.waitForInit();
    await manager.upsertModel(profile.id, 'plain', { id: 'plain', providerId: profile.id, modalities });
    expect(manager.getModelModalities(profile.id, 'plain')).toEqual(modalities);
  });
});

describe('ModelManager modalities', () => {
  const profile = { id: 'personal-openai', name: 'My account', provider: { name: 'openai' } } as ProviderProfile;
  const modalities = { input: [ModelModality.Text, ModelModality.Image], output: [ModelModality.Text] };

  beforeEach(() => {
    vi.mocked(fs.access).mockRejectedValue(new Error('not found'));
    vi.mocked(fs.readFile).mockRejectedValue(new Error('not found'));
    vi.mocked(fs.writeFile).mockClear();
    Object.assign(openaiProviderStrategy, {
      hasEnvVars: () => false,
      loadModels: vi.fn(async () => ({ success: true, models: [{ id: 'vision', providerId: profile.id }] })),
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          openai: {
            models: {
              vision: { id: 'vision', limit: { context: 1000, output: 100 }, modalities },
              'image-generator': { id: 'image-generator', limit: { context: 1000, output: 100 } },
              future: { id: 'future', limit: { context: 1000, output: 100 }, modalities: { input: ['text', 'future-format'], output: ['image'] } },
            },
          },
        }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(openaiProviderStrategy, 'loadModels');
    Reflect.deleteProperty(openaiProviderStrategy, 'hasEnvVars');
  });

  it('loads models.dev metadata using provider type, without confusing vision and generation', async () => {
    const manager = createManager([profile]);
    await manager.waitForInit();
    expect(manager.getModelSettings(profile.id, 'vision')?.modalities).toEqual(modalities);
    expect(manager.getModelSettings(profile.id, 'vision')?.modalities?.output).not.toContain(ModelModality.Image);
    expect(await manager.getProviderModels()).toMatchObject({ models: [{ modalities }] });
    const cacheWrite = vi.mocked(fs.writeFile).mock.calls.find(([file]) => String(file).endsWith('provider-models.json'));
    expect(JSON.parse(String(cacheWrite?.[1])).providerModels[profile.id][0].modalities).toEqual(modalities);
  });

  it('preserves unknown modalities and ignores future modality values', async () => {
    vi.mocked(openaiProviderStrategy.loadModels).mockResolvedValue({
      success: true,
      models: [
        { id: 'image-generator', providerId: profile.id },
        { id: 'future', providerId: profile.id },
      ],
    });
    const manager = createManager([profile]);
    await manager.waitForInit();
    expect(manager.getModelSettings(profile.id, 'image-generator')?.modalities).toBeUndefined();
    expect(manager.getModelModalities(profile.id, 'image-generator')).toBeUndefined();
    expect((await manager.getProviderModels()).models?.find((model) => model.id === 'image-generator')?.modalities).toBeUndefined();
    expect(manager.getModelSettings(profile.id, 'future')?.modalities).toEqual({ input: [ModelModality.Text], output: [ModelModality.Image] });
  });

  it('preserves provider-declared modalities over models.dev metadata', async () => {
    const declared = { input: [], output: [ModelModality.Image] };
    vi.mocked(openaiProviderStrategy.loadModels).mockResolvedValue({ success: true, models: [{ id: 'vision', providerId: profile.id, modalities: declared }] });
    const manager = createManager([profile]);
    await manager.waitForInit();
    expect(manager.getModelSettings(profile.id, 'vision')?.modalities).toEqual(declared);
  });

  it('keeps modality metadata when loading legacy overrides without the field', async () => {
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockImplementation(async (file) => {
      if (String(file).endsWith('/models.json')) {
        return JSON.stringify({ version: 1, models: [{ id: 'vision', providerId: profile.id, supportsTools: false }] });
      }
      throw new Error('not found');
    });
    const manager = createManager([profile]);
    await manager.waitForInit();
    expect(manager.getModelSettings(profile.id, 'vision')).toMatchObject({ modalities, supportsTools: false });
  });

  it('retains explicit modalities for custom models absent from the provider list', async () => {
    const manager = createManager([profile]);
    await manager.waitForInit();
    const custom: Model = {
      id: 'custom',
      providerId: profile.id,
      isCustom: true,
      modalities: { input: [ModelModality.Text, ModelModality.Audio, ModelModality.Video, ModelModality.Pdf], output: [ModelModality.Image] },
    };
    await manager.upsertModel(profile.id, custom.id, custom);
    expect(manager.getModelSettings(profile.id, custom.id)?.modalities).toEqual(custom.modalities);
  });

  it('keeps inherited modalities live after unrelated single and bulk saves', async () => {
    const manager = createManager([profile]);
    await manager.waitForInit();
    const inherited = manager.getModelSettings(profile.id, 'vision')!;
    expect(inherited.hasModalitiesOverride).toBe(false);
    await manager.upsertModel(profile.id, inherited.id, { ...inherited, temperature: 0.5 });
    await manager.updateModels([{ providerId: profile.id, modelId: inherited.id, model: { ...inherited, isHidden: true } }]);
    const writes = vi.mocked(fs.writeFile).mock.calls.filter(([file]) => String(file).endsWith('/models.json'));
    for (const write of writes) {
      const saved = JSON.parse(String(write[1])).models[0];
      expect(saved).not.toHaveProperty('modalities');
      expect(saved).not.toHaveProperty('hasModalitiesOverride');
    }
    const updated = { input: [ModelModality.Text, ModelModality.Image, ModelModality.Pdf], output: [ModelModality.Text] };
    vi.mocked(openaiProviderStrategy.loadModels).mockResolvedValue({
      success: true,
      models: [{ id: inherited.id, providerId: profile.id, modalities: updated }],
    });
    await manager.getProviderModels(true);
    expect(manager.getModelSettings(profile.id, inherited.id)).toMatchObject({ modalities: updated, hasModalitiesOverride: false });
  });

  it('preserves explicit overrides through unrelated single and bulk saves', async () => {
    const manager = createManager([profile]);
    await manager.waitForInit();
    const explicit = { input: [], output: [] };
    await manager.upsertModel(profile.id, 'vision', { id: 'vision', providerId: profile.id, modalities: explicit });
    const model = manager.getModelSettings(profile.id, 'vision')!;
    expect(model.hasModalitiesOverride).toBe(true);
    await manager.upsertModel(profile.id, model.id, { ...model, temperature: 0.5 });
    await manager.updateModels([{ providerId: profile.id, modelId: model.id, model: { ...model, isHidden: true } }]);
    expect(manager.getModelSettings(profile.id, model.id)).toMatchObject({ modalities: explicit, hasModalitiesOverride: true });
    const writes = vi.mocked(fs.writeFile).mock.calls.filter(([file]) => String(file).endsWith('/models.json'));
    for (const write of writes) {
      const saved = JSON.parse(String(write[1])).models[0];
      expect(saved.modalities).toEqual(explicit);
      expect(saved).not.toHaveProperty('hasModalitiesOverride');
    }
  });

  it('preserves unknown modalities for custom models without storing a modality override', async () => {
    const manager = createManager([profile]);
    await manager.waitForInit();
    await manager.upsertModel(profile.id, 'custom', { id: 'custom', providerId: profile.id, isCustom: true });
    expect(manager.getModelModalities(profile.id, 'custom')).toBeUndefined();
    expect(manager.getModelSettings(profile.id, 'custom')).toMatchObject({
      hasModalitiesOverride: false,
    });
  });

  it('persists overrides, reloads them, and allows returning to provider metadata', async () => {
    const manager = createManager([profile]);
    await manager.waitForInit();
    const override: Model = { id: 'vision', providerId: profile.id, modalities: { input: [], output: [ModelModality.Image] } };
    await manager.upsertModel(profile.id, override.id, override);
    expect(manager.getModelSettings(profile.id, override.id)?.modalities).toEqual(override.modalities);
    const saved = vi.mocked(fs.writeFile).mock.calls.find(([file]) => String(file).endsWith('/models.json'));
    expect(JSON.parse(String(saved?.[1])).models[0].modalities).toEqual(override.modalities);

    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockImplementation(async (file) => {
      if (String(file).endsWith('/models.json')) {
        return String(saved?.[1]);
      }
      throw new Error('not found');
    });
    const restored = createManager([profile]);
    await restored.waitForInit();
    expect(restored.getModelSettings(profile.id, override.id)?.modalities).toEqual(override.modalities);

    await restored.updateModels([{ providerId: profile.id, modelId: override.id, model: { ...override, modalities: { input: [], output: [] } } }]);
    expect(restored.getModelSettings(profile.id, override.id)?.modalities).toEqual({ input: [], output: [] });
    await restored.upsertModel(profile.id, override.id, { ...override, modalities: undefined });
    expect(restored.getModelSettings(profile.id, override.id)?.modalities).toEqual(modalities);
  });
});
