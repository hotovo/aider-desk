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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

const createManager = () => {
  const store = {
    getProviders: vi.fn(() => []),
    getSettings: vi.fn(() => ({}) as SettingsData),
    setProviders: vi.fn(),
  } as unknown as Store;
  const eventManager = {
    sendProviderModelsUpdated: vi.fn(),
    sendSettingsUpdated: vi.fn(),
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

  it('still throws for unsupported providers', () => {
    const manager = createManager();
    const unknownProfile = {
      id: 'unknown',
      provider: { name: 'unknown-provider' },
    } as unknown as ProviderProfile;

    expect(() => manager.getUsageReport(task, unknownProfile, 'glm-5.3', usage)).toThrow('Unsupported LLM provider');
  });
});
