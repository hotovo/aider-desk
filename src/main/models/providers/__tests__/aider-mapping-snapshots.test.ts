/**
 * Phase 0 behavior-locking tests for get<L>AiderMapping: modelName prefixes and
 * environmentVariables contents. Every provider configured with an explicit
 * provider.apiKey (so no env resolution should take place beyond silence).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderProfile, SettingsData } from '@common/types';

import { groqProviderStrategy } from '../groq';
import { cerebrasProviderStrategy } from '../cerebras';
import { mistralProviderStrategy } from '../mistral';
import { deepseekProviderStrategy } from '../deepseek';
import { openaiProviderStrategy } from '../openai';
import { openaiCompatibleProviderStrategy } from '../openai-compatible';
import { anthropicProviderStrategy } from '../anthropic';
import { anthropicCompatibleProviderStrategy } from '../anthropic-compatible';
import { azureProviderStrategy } from '../azure';
import { bedrockProviderStrategy } from '../bedrock';
import { vertexAiProviderStrategy } from '../vertex-ai';
import { geminiProviderStrategy } from '../gemini';
import { minimaxProviderStrategy } from '../minimax';
import { neuralwattProviderStrategy } from '../neuralwatt';
import { syntheticProviderStrategy } from '../synthetic';
import { zaiPlanProviderStrategy } from '../zai-plan';
import { alibabaPlanProviderStrategy } from '../alibaba-plan';
import { kimiPlanProviderStrategy } from '../kimi-plan';
import { litellmProviderStrategy } from '../litellm';
import { gpustackProviderStrategy } from '../gpustack';
import { clinePassProviderStrategy } from '../clinepass';
import { opencodeProviderStrategy } from '../opencode';
import { opencodeGoProviderStrategy } from '../opencode-go';
import { openrouterProviderStrategy } from '../openrouter';
import { requestyProviderStrategy } from '../requesty';
import { ollamaProviderStrategy } from '../ollama';
import { lmStudioProviderStrategy } from '../lm-studio';

import { envMock, profileFor, settings } from './test-utils';

vi.mock('@/logger');

vi.mock('@/utils/environment', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/environment')>();
  const { envMock } = await import('./test-utils');
  return { ...actual, getEffectiveEnvironmentVariable: envMock.getEffectiveEnvironmentVariable };
});

beforeEach(() => {
  envMock.reset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

type MappingRow = {
  name: string;
  getAiderMapping: (
    profile: ProviderProfile,
    modelId: string,
    settings: SettingsData,
    projectDir: string,
  ) => { modelName: string; environmentVariables: Record<string, string> };
  provider: Record<string, unknown>;
  /** model id passed to the mapping (defaults to 'm1') */
  modelId?: string;
  modelName: string;
  environmentVariables: Record<string, string>;
};

const rows: MappingRow[] = [
  {
    name: 'groq',
    getAiderMapping: groqProviderStrategy.getAiderMapping!,
    provider: { name: 'groq', apiKey: 'sk-groq' },
    modelName: 'groq/m1',
    environmentVariables: { GROQ_API_KEY: 'sk-groq' },
  },
  {
    name: 'cerebras',
    getAiderMapping: cerebrasProviderStrategy.getAiderMapping!,
    provider: { name: 'cerebras', apiKey: 'sk-cer' },
    modelName: 'cerebras/m1',
    environmentVariables: { CEREBRAS_API_KEY: 'sk-cer' },
  },
  {
    name: 'mistral',
    getAiderMapping: mistralProviderStrategy.getAiderMapping!,
    provider: { name: 'mistral', apiKey: 'sk-mistral' },
    modelName: 'mistral/m1',
    environmentVariables: { MISTRAL_API_KEY: 'sk-mistral' },
  },
  {
    name: 'deepseek',
    getAiderMapping: deepseekProviderStrategy.getAiderMapping!,
    provider: { name: 'deepseek', apiKey: 'sk-ds' },
    modelName: 'deepseek/m1',
    environmentVariables: { DEEPSEEK_API_KEY: 'sk-ds' },
  },
  {
    name: 'openai',
    getAiderMapping: openaiProviderStrategy.getAiderMapping!,
    provider: { name: 'openai', apiKey: 'sk-oai' },
    modelName: 'openai/m1',
    environmentVariables: { OPENAI_API_BASE: '', OPENAI_API_KEY: 'sk-oai' },
  },
  {
    name: 'openai-compatible',
    getAiderMapping: openaiCompatibleProviderStrategy.getAiderMapping!,
    provider: { name: 'custom-vllm', apiKey: 'sk-c', baseUrl: 'https://vllm.example/v1' },
    modelName: 'openai/m1',
    environmentVariables: { OPENAI_API_KEY: 'sk-c', OPENAI_API_BASE: 'https://vllm.example/v1' },
  },
  {
    name: 'anthropic',
    getAiderMapping: anthropicProviderStrategy.getAiderMapping!,
    provider: { name: 'anthropic', apiKey: 'sk-ant' },
    modelName: 'anthropic/m1',
    environmentVariables: { ANTHROPIC_API_KEY: 'sk-ant' },
  },
  {
    name: 'anthropic-compatible',
    getAiderMapping: anthropicCompatibleProviderStrategy.getAiderMapping!,
    provider: { name: 'anthropic-compatible', apiKey: 'sk-antc', baseUrl: 'https://api.example.com/v1' },
    modelName: 'anthropic/m1',
    environmentVariables: { ANTHROPIC_API_KEY: 'sk-antc', ANTHROPIC_BASE_URL: 'https://api.example.com' },
  },
  {
    name: 'azure',
    getAiderMapping: azureProviderStrategy.getAiderMapping!,
    provider: { name: 'azure', apiKey: 'sk-az', resourceName: 'my-resource', apiVersion: '2024-12-01-preview' },
    modelName: 'azure/m1',
    environmentVariables: {
      AZURE_API_KEY: 'sk-az',
      AZURE_API_BASE: 'https://my-resource.openai.azure.com/',
      AZURE_API_VERSION: '2024-12-01-preview',
    },
  },
  {
    name: 'bedrock',
    getAiderMapping: bedrockProviderStrategy.getAiderMapping!,
    provider: {
      name: 'bedrock',
      accessKeyId: 'AKIA-TEST',
      secretAccessKey: 'secret',
      region: 'us-east-1',
      sessionToken: 'token',
    },
    modelName: 'bedrock/m1',
    environmentVariables: {
      AWS_ACCESS_KEY_ID: 'AKIA-TEST',
      AWS_SECRET_ACCESS_KEY: 'secret',
      AWS_DEFAULT_REGION: 'us-east-1',
      AWS_SESSION_TOKEN: 'token',
    },
  },
  {
    name: 'vertex-ai',
    getAiderMapping: vertexAiProviderStrategy.getAiderMapping!,
    provider: { name: 'vertex-ai', project: 'my-project', location: 'us-central1', googleCloudCredentialsJson: '{"json":true}' },
    modelName: 'vertex_ai/m1',
    environmentVariables: {
      VERTEXAI_PROJECT: 'my-project',
      VERTEXAI_LOCATION: 'us-central1',
      GOOGLE_APPLICATION_CREDENTIALS_JSON: '{"json":true}',
    },
  },
  {
    name: 'gemini',
    getAiderMapping: geminiProviderStrategy.getAiderMapping!,
    provider: { name: 'gemini', apiKey: 'sk-gem', customBaseUrl: 'https://gemini.example' },
    modelName: 'gemini/m1',
    environmentVariables: { GEMINI_API_KEY: 'sk-gem', GEMINI_API_BASE: 'https://gemini.example' },
  },
  {
    name: 'minimax',
    getAiderMapping: minimaxProviderStrategy.getAiderMapping!,
    provider: { name: 'minimax', apiKey: 'sk-mmx' },
    modelName: 'openai/m1',
    environmentVariables: { OPENAI_API_BASE: 'https://api.minimax.io/v1', OPENAI_API_KEY: 'sk-mmx' },
  },
  {
    name: 'neuralwatt',
    getAiderMapping: neuralwattProviderStrategy.getAiderMapping!,
    provider: { name: 'neuralwatt', apiKey: 'sk-nw' },
    modelName: 'openai/m1',
    environmentVariables: { OPENAI_API_KEY: 'sk-nw', OPENAI_API_BASE: 'https://api.neuralwatt.com/v1' },
  },
  {
    name: 'synthetic',
    getAiderMapping: syntheticProviderStrategy.getAiderMapping!,
    provider: { name: 'synthetic', apiKey: 'sk-syn' },
    modelName: 'openai/m1',
    environmentVariables: { OPENAI_API_KEY: 'sk-syn', OPENAI_API_BASE: 'https://api.synthetic.new/openai/v1' },
  },
  {
    name: 'zai-plan',
    getAiderMapping: zaiPlanProviderStrategy.getAiderMapping!,
    provider: { name: 'zai-plan', apiKey: 'sk-zai' },
    modelName: 'openai/m1',
    environmentVariables: { OPENAI_API_KEY: 'sk-zai', OPENAI_API_BASE: 'https://api.z.ai/api/coding/paas/v4' },
  },
  {
    name: 'alibaba-plan',
    getAiderMapping: alibabaPlanProviderStrategy.getAiderMapping!,
    provider: { name: 'alibaba-plan', apiKey: 'sk-ali' },
    modelName: 'openai/m1',
    environmentVariables: { OPENAI_API_KEY: 'sk-ali', OPENAI_API_BASE: 'https://coding-intl.dashscope.aliyuncs.com/v1' },
  },
  {
    name: 'kimi-plan',
    getAiderMapping: kimiPlanProviderStrategy.getAiderMapping!,
    provider: { name: 'kimi-plan', apiKey: 'sk-kimi' },
    modelName: 'anthropic/m1',
    environmentVariables: { ANTHROPIC_API_KEY: 'sk-kimi', ANTHROPIC_BASE_URL: 'https://api.kimi.com/coding' },
  },
  {
    name: 'litellm',
    getAiderMapping: litellmProviderStrategy.getAiderMapping!,
    provider: { name: 'litellm', apiKey: 'sk-lite', baseUrl: 'https://proxy.example/' },
    modelName: 'litellm/m1',
    environmentVariables: { LITELLM_API_KEY: 'sk-lite', LITELLM_API_BASE: 'https://proxy.example' },
  },
  {
    name: 'gpustack',
    getAiderMapping: gpustackProviderStrategy.getAiderMapping!,
    provider: { name: 'gpustack', apiKey: 'sk-gpu', baseUrl: 'https://gpu.example' },
    modelName: 'openai/m1',
    environmentVariables: { OPENAI_API_KEY: 'sk-gpu', OPENAI_API_BASE: 'https://gpu.example/v1-openai' },
  },
  {
    name: 'clinepass',
    getAiderMapping: clinePassProviderStrategy.getAiderMapping!,
    provider: { name: 'clinepass', apiKey: 'sk-cline' },
    modelName: 'openai/cline-pass/m1',
    environmentVariables: { OPENAI_API_BASE: 'https://api.cline.bot/api/v1', OPENAI_API_KEY: 'sk-cline' },
  },
  {
    name: 'opencode',
    getAiderMapping: opencodeProviderStrategy.getAiderMapping!,
    provider: { name: 'opencode', apiKey: 'sk-zen' },
    modelName: 'openai/m1',
    environmentVariables: { OPENAI_API_KEY: 'sk-zen', OPENAI_API_BASE: 'https://opencode.ai/zen/v1' },
  },
  {
    name: 'opencode-go (openai endpoint)',
    getAiderMapping: opencodeGoProviderStrategy.getAiderMapping!,
    provider: { name: 'opencode-go', apiKey: 'sk-zengo' },
    modelName: 'openai/m1',
    environmentVariables: { OPENAI_API_KEY: 'sk-zengo', OPENAI_API_BASE: 'https://opencode.ai/zen/go/v1' },
  },
  {
    name: 'opencode-go (anthropic endpoint)',
    getAiderMapping: opencodeGoProviderStrategy.getAiderMapping!,
    provider: { name: 'opencode-go', apiKey: 'sk-zengo' },
    modelId: 'minimax-m3',
    modelName: 'anthropic/minimax-m3',
    environmentVariables: { ANTHROPIC_API_KEY: 'sk-zengo', ANTHROPIC_BASE_URL: 'https://opencode.ai/zen/go' },
  },
  {
    name: 'openrouter',
    getAiderMapping: openrouterProviderStrategy.getAiderMapping!,
    provider: { name: 'openrouter', apiKey: 'sk-or' },
    modelName: 'openrouter/m1',
    environmentVariables: { OPENROUTER_API_KEY: 'sk-or' },
  },
  {
    name: 'requesty',
    getAiderMapping: requestyProviderStrategy.getAiderMapping!,
    provider: { name: 'requesty', apiKey: 'sk-req' },
    modelName: 'openai/m1',
    environmentVariables: { OPENAI_API_BASE: 'https://router.requesty.ai/v1', OPENAI_API_KEY: 'sk-req' },
  },
  {
    name: 'ollama',
    getAiderMapping: ollamaProviderStrategy.getAiderMapping!,
    provider: { name: 'ollama', baseUrl: 'http://localhost:11434/api' },
    modelName: 'ollama_chat/m1',
    environmentVariables: { OLLAMA_API_BASE: 'http://localhost:11434' },
  },
  {
    name: 'lm-studio',
    getAiderMapping: lmStudioProviderStrategy.getAiderMapping!,
    provider: { name: 'lmstudio', baseUrl: 'http://localhost:1234/v1' },
    modelName: 'lm_studio/m1',
    environmentVariables: { LM_STUDIO_API_BASE: 'http://localhost:1234/v1', LM_STUDIO_API_KEY: 'dummy-api-key' },
  },
];

describe.each(rows)('$name getAiderMapping', (row) => {
  it('locks the modelName prefix and environmentVariables (explicit apiKey)', () => {
    expect(row.getAiderMapping(profileFor(row.provider), row.modelId ?? 'm1', settings, '/proj')).toEqual({
      modelName: row.modelName,
      environmentVariables: row.environmentVariables,
    });
  });
});

describe('edge cases', () => {
  it('openai mapping clears OPENAI_API_BASE even without an apiKey', () => {
    const mapping = openaiProviderStrategy.getAiderMapping!(profileFor({ name: 'openai' }), 'm1', settings, '/proj');
    expect(mapping).toEqual({ modelName: 'openai/m1', environmentVariables: { OPENAI_API_BASE: '' } });
  });

  it('anthropic-compatible appends /v1 removal only: bare baseUrl passed through untouched', () => {
    const mapping = anthropicCompatibleProviderStrategy.getAiderMapping!(
      profileFor({ name: 'anthropic-compatible', apiKey: 'sk-antc', baseUrl: 'https://api.example.com' }),
      'm1',
      settings,
      '/proj',
    );
    expect(mapping.environmentVariables.ANTHROPIC_BASE_URL).toBe('https://api.example.com');
  });

  it('opencode-go selects the anthropic shape purely from the model id', () => {
    const mapping = opencodeGoProviderStrategy.getAiderMapping!(profileFor({ name: 'opencode-go', apiKey: 'sk-zengo' }), 'gpt-5.6-luna', settings, '/proj');
    expect(mapping.modelName).toBe('openai/gpt-5.6-luna');
    expect(mapping.environmentVariables).toEqual({
      OPENAI_API_KEY: 'sk-zengo',
      OPENAI_API_BASE: 'https://opencode.ai/zen/go/v1',
    });
  });

  it('providers with no credential in the mapping produce no env key (no throw)', () => {
    const mapping = groqProviderStrategy.getAiderMapping!(profileFor({ name: 'groq' }), 'm1', settings, '/proj');
    expect(mapping).toEqual({ modelName: 'groq/m1', environmentVariables: {} });
    expect(envMock.lookups).toEqual([]);
  });

  // Each provider name maps to its own strategy object so every it.each iteration
  // genuinely exercises that provider's getAiderMapping (previously all five
  // iterations ran the synthetic strategy, leaving the other four untested).
  const strategiesWithEnvFallback = {
    synthetic: syntheticProviderStrategy,
    'zai-plan': zaiPlanProviderStrategy,
    'kimi-plan': kimiPlanProviderStrategy,
    'alibaba-plan': alibabaPlanProviderStrategy,
    minimax: minimaxProviderStrategy,
  };

  it.each(['synthetic', 'zai-plan', 'kimi-plan', 'alibaba-plan', 'minimax'] as const)('%s: explicit provider.apiKey wins over the env fallback', (name) => {
    // No env mock value is queued: with an explicit provider key these strategies
    // must not consult the env fallback at all, so a mockReturnValueOnce would
    // pile up unused. The absence of any env lookup is asserted via envMock.lookups.
    const mapping = strategiesWithEnvFallback[name].getAiderMapping!(profileFor({ name, apiKey: 'sk-explicit' }), 'm1', settings, '/proj');

    const keyEnvVar = Object.entries(mapping.environmentVariables).find(([key]) => /API_KEY/.test(key))!;
    expect(keyEnvVar[1]).toBe('sk-explicit');
    // with an explicit key the env fallback must not even be consulted
    expect(envMock.lookups).toEqual([]);
  });

  it('kills the trailing /api from ollama base URLs', () => {
    const mapping = ollamaProviderStrategy.getAiderMapping!(profileFor({ name: 'ollama', baseUrl: 'http://host:11434' }), 'm1', settings, '/proj');
    expect(mapping.environmentVariables).toEqual({ OLLAMA_API_BASE: 'http://host:11434' });
  });
});
