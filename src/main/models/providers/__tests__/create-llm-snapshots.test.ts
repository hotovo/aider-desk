/**
 * Phase 0 behavior-locking tests for create<L>Llm credential resolution and SDK factory args.
 *
 * These tests snapshot the CURRENT behavior of every simple/compatible provider's createLlm:
 *  - explicit profile.provider.apiKey is forwarded to the SDK factory, with profile.headers
 *  - missing apiKey falls back to the provider-specific env var via getEffectiveEnvironmentVariable
 *  - no credential at all throws the current (exact) API-key error message
 *  - baseUrl/customBaseUrl/endpoint dispatch behavior is locked as-is (no normalization yet)
 *
 * One known inconsistency is still intentionally locked (see the azure Phase 0
 * resource-name note below) so a refactor must either preserve it or update that
 * test deliberately.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Model, ProviderProfile, SettingsData } from '@common/types';

import { groqProviderStrategy } from '../groq';
import { cerebrasProviderStrategy } from '../cerebras';
import { mistralProviderStrategy } from '../mistral';
import { deepseekProviderStrategy } from '../deepseek';
import { openaiProviderStrategy } from '../openai';
import { openaiCompatibleProviderStrategy } from '../openai-compatible';
import { anthropicProviderStrategy } from '../anthropic';
import { anthropicCompatibleProviderStrategy } from '../anthropic-compatible';
import { azureProviderStrategy } from '../azure';
import { geminiProviderStrategy } from '../gemini';
import { minimaxProviderStrategy } from '../minimax';
import { neuralwattProviderStrategy } from '../neuralwatt';
import { syntheticProviderStrategy } from '../synthetic';
import { zaiPlanProviderStrategy } from '../zai-plan';
import { alibabaPlanProviderStrategy } from '../alibaba-plan';
import { kimiPlanProviderStrategy } from '../kimi-plan';
import { gpustackProviderStrategy } from '../gpustack';
import { clinePassProviderStrategy } from '../clinepass';
import { opencodeProviderStrategy } from '../opencode';
import { opencodeGoProviderStrategy } from '../opencode-go';
import { openrouterProviderStrategy } from '../openrouter';
import { requestyProviderStrategy } from '../requesty';
import { litellmProviderStrategy } from '../litellm';
import { ollamaProviderStrategy } from '../ollama';
import { lmStudioProviderStrategy } from '../lm-studio';

import { envMock, model, profileFor, sdkMock, settings } from './test-utils';

vi.mock('@/logger');

vi.mock('@/utils/environment', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/environment')>();
  const { envMock } = await import('./test-utils');
  return {
    ...actual,
    getEffectiveEnvironmentVariable: envMock.getEffectiveEnvironmentVariable,
  };
});

// ---------------------------------------------------------------------------
// SDK factory mocks — every factory records (callArgs, modelId, call kind)
// and returns a sentinel object so tests can assert identity through the
// whole chain (factory -> provider instance -> model call).
// ---------------------------------------------------------------------------
vi.mock('@ai-sdk/openai', async () => {
  const { sdkMock } = await import('./test-utils');
  return { createOpenAI: sdkMock.provider('createOpenAI') };
});
vi.mock('@ai-sdk/anthropic', async () => {
  const { sdkMock } = await import('./test-utils');
  return { createAnthropic: sdkMock.provider('createAnthropic') };
});
vi.mock('@ai-sdk/google', async () => {
  const { sdkMock } = await import('./test-utils');
  return {
    createGoogle: sdkMock.provider('createGoogle'),
    google: { tools: { googleSearch: () => ({}) } },
  };
});
vi.mock('@ai-sdk/groq', async () => {
  const { sdkMock } = await import('./test-utils');
  return { createGroq: sdkMock.provider('createGroq') };
});
vi.mock('@ai-sdk/cerebras', async () => {
  const { sdkMock } = await import('./test-utils');
  return { createCerebras: sdkMock.provider('createCerebras') };
});
vi.mock('@ai-sdk/mistral', async () => {
  const { sdkMock } = await import('./test-utils');
  return { createMistral: sdkMock.provider('createMistral') };
});
vi.mock('@ai-sdk/deepseek', async () => {
  const { sdkMock } = await import('./test-utils');
  return { createDeepSeek: sdkMock.provider('createDeepSeek') };
});
vi.mock('@ai-sdk/azure', async () => {
  const { sdkMock } = await import('./test-utils');
  return { createAzure: sdkMock.provider('createAzure') };
});
vi.mock('@ai-sdk/alibaba', async () => {
  const { sdkMock } = await import('./test-utils');
  return { createAlibaba: sdkMock.provider('createAlibaba') };
});
vi.mock('@ai-sdk/openai-compatible', async () => {
  const { sdkMock } = await import('./test-utils');
  return { createOpenAICompatible: sdkMock.provider('createOpenAICompatible') };
});
vi.mock('@openrouter/ai-sdk-provider', async () => {
  const { sdkMock } = await import('./test-utils');
  return { createOpenRouter: sdkMock.provider('createOpenRouter') };
});
vi.mock('@requesty/ai-sdk', async () => {
  const { sdkMock } = await import('./test-utils');
  return { createRequesty: sdkMock.provider('createRequesty') };
});
vi.mock('ollama-ai-provider-v2', async () => {
  const { sdkMock } = await import('./test-utils');
  return { createOllama: sdkMock.provider('createOllama') };
});
vi.mock('ai', () => ({
  wrapLanguageModel: ({ model }: { model: unknown }) => ({ wrapped: model }),
  simulateStreamingMiddleware: () => ({ simulate: true }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const makeProfile = (provider: Record<string, unknown>): ProviderProfile => profileFor(provider, { 'X-Test': 'hdr' });

const call = (factory: string, kind = 'model') => {
  const matches = sdkMock.calls.filter((c) => c.factory === factory && c.kind === kind);
  expect(matches, `expected exactly one ${factory} ${kind} call`).toHaveLength(1);
  return matches[0];
};

beforeEach(() => {
  sdkMock.reset();
  envMock.reset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

type ApiKeyRow = {
  name: string;
  createLlm: (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string) => unknown;
  provider: Record<string, unknown>;
  /** expected subset of the args passed to the SDK factory (on the explicit-apiKey path) */
  callArgs: Record<string, unknown>;
  factory: string;
  kind?: 'model' | 'responses' | 'chat';
  /** env var consulted when provider.apiKey is missing */
  envKey: string;
  /** expected model id on the factory call (defaults to 'm1') */
  modelCall?: string;
  /** env lookups expected on the explicit-apiKey path (defaults to none) */
  expectedLookups?: string[];
  /** exact error when no credential exists anywhere */
  error: string;
};

// Standard "apiKey in provider -> env -> throw" providers.
const apiKeyRows: ApiKeyRow[] = [
  {
    name: 'groq',
    createLlm: groqProviderStrategy.createLlm,
    provider: { name: 'groq', apiKey: 'sk-groq' },
    callArgs: { apiKey: 'sk-groq' },
    factory: 'createGroq',
    envKey: 'GROQ_API_KEY',
    error: 'Groq API key is required in Providers settings or Aider environment variables (GROQ_API_KEY)',
  },
  {
    name: 'cerebras',
    createLlm: cerebrasProviderStrategy.createLlm,
    provider: { name: 'cerebras', apiKey: 'sk-cer' },
    callArgs: { apiKey: 'sk-cer' },
    factory: 'createCerebras',
    envKey: 'CEREBRAS_API_KEY',
    error: 'Cerebras API key is required in Providers settings or Aider environment variables (CEREBRAS_API_KEY)',
  },
  {
    name: 'mistral',
    createLlm: mistralProviderStrategy.createLlm,
    provider: { name: 'mistral', apiKey: 'sk-mistral' },
    callArgs: { apiKey: 'sk-mistral' },
    factory: 'createMistral',
    envKey: 'MISTRAL_API_KEY',
    error: 'Mistral API key is required in Providers settings or Aider environment variables (MISTRAL_API_KEY)',
  },
  {
    name: 'deepseek',
    createLlm: deepseekProviderStrategy.createLlm,
    provider: { name: 'deepseek', apiKey: 'sk-ds' },
    callArgs: { apiKey: 'sk-ds' },
    factory: 'createDeepSeek',
    envKey: 'DEEPSEEK_API_KEY',
    error: 'Deepseek API key is required in Providers settings or Aider environment variables (DEEPSEEK_API_KEY)',
  },
  {
    name: 'openai',
    createLlm: openaiProviderStrategy.createLlm,
    provider: { name: 'openai', apiKey: 'sk-oai' },
    callArgs: { apiKey: 'sk-oai' },
    factory: 'createOpenAI',
    envKey: 'OPENAI_API_KEY',
    error: 'OpenAI API key is required in Providers settings or Aider environment variables (OPENAI_API_KEY)',
  },
  {
    name: 'anthropic',
    createLlm: anthropicProviderStrategy.createLlm,
    provider: { name: 'anthropic', apiKey: 'sk-ant' },
    callArgs: { apiKey: 'sk-ant' },
    factory: 'createAnthropic',
    envKey: 'ANTHROPIC_API_KEY',
    error: 'Anthropic API key is required in Providers settings or Aider environment variables (ANTHROPIC_API_KEY)',
  },
  {
    name: 'azure',
    createLlm: azureProviderStrategy.createLlm,
    provider: { name: 'azure', apiKey: 'sk-az', resourceName: 'test-resource' },
    callArgs: { apiKey: 'sk-az', resourceName: 'test-resource' },
    factory: 'createAzure',
    kind: 'responses',
    envKey: 'AZURE_API_KEY',
    error: 'Azure OpenAI API key is required in Providers settings or Aider environment variables (AZURE_API_KEY)',
  },
  {
    name: 'gemini',
    createLlm: geminiProviderStrategy.createLlm,
    provider: { name: 'gemini', apiKey: 'sk-gem' },
    callArgs: { apiKey: 'sk-gem', baseURL: undefined },
    factory: 'createGoogle',
    envKey: 'GEMINI_API_KEY',
    expectedLookups: ['GEMINI_API_BASE_URL'],
    error: 'Gemini API key is required in Providers settings or Aider environment variables (GEMINI_API_KEY)',
  },
  {
    name: 'minimax',
    createLlm: minimaxProviderStrategy.createLlm,
    provider: { name: 'minimax', apiKey: 'sk-mmx' },
    callArgs: { apiKey: 'sk-mmx', baseURL: 'https://api.minimax.io/anthropic/v1' },
    factory: 'createAnthropic',
    envKey: 'MINIMAX_API_KEY',
    error: 'Minimax API key is required in Providers settings or Aider environment variables (MINIMAX_API_KEY)',
  },
  {
    name: 'neuralwatt',
    createLlm: neuralwattProviderStrategy.createLlm,
    provider: { name: 'neuralwatt', apiKey: 'sk-nw' },
    callArgs: { name: 'neuralwatt', apiKey: 'sk-nw', baseURL: 'https://api.neuralwatt.com/v1' },
    factory: 'createOpenAICompatible',
    envKey: 'NEURALWATT_API_KEY',
    error: 'Neuralwatt API key is required in Providers settings or Aider environment variables (NEURALWATT_API_KEY)',
  },
  {
    name: 'synthetic',
    createLlm: syntheticProviderStrategy.createLlm,
    provider: { name: 'synthetic', apiKey: 'sk-syn' },
    callArgs: { name: 'synthetic', apiKey: 'sk-syn', baseURL: 'https://api.synthetic.new/openai/v1' },
    factory: 'createOpenAICompatible',
    envKey: 'SYNTHETIC_API_KEY',
    error: 'API key is required for synthetic. Check Providers settings or Aider environment variables (SYNTHETIC_API_KEY).',
  },
  {
    name: 'zai-plan',
    createLlm: zaiPlanProviderStrategy.createLlm,
    provider: { name: 'zai-plan', apiKey: 'sk-zai' },
    callArgs: { name: 'zai-plan', apiKey: 'sk-zai', baseURL: 'https://api.z.ai/api/coding/paas/v4' },
    factory: 'createOpenAICompatible',
    envKey: 'ZAI_API_KEY',
    error: 'API key is required for zai-plan. Check Providers settings or Aider environment variables (ZAI_API_KEY).',
  },
  {
    name: 'alibaba-plan',
    createLlm: alibabaPlanProviderStrategy.createLlm,
    provider: { name: 'alibaba-plan', apiKey: 'sk-ali' },
    callArgs: { apiKey: 'sk-ali', baseURL: 'https://coding-intl.dashscope.aliyuncs.com/v1' },
    factory: 'createAlibaba',
    envKey: 'ALIBABA_PLAN_API_KEY',
    error: 'API key is required for alibaba-plan. Check Providers settings or Aider environment variables (ALIBABA_PLAN_API_KEY).',
  },
  {
    name: 'kimi-plan',
    createLlm: kimiPlanProviderStrategy.createLlm,
    provider: { name: 'kimi-plan', apiKey: 'sk-kimi' },
    callArgs: { apiKey: 'sk-kimi', baseURL: 'https://api.kimi.com/coding/v1' },
    factory: 'createAnthropic',
    envKey: 'KIMI_PLAN_API_KEY',
    error: 'API key is required for kimi-plan. Check Providers settings or Aider environment variables (KIMI_PLAN_API_KEY).',
  },
  {
    name: 'gpustack',
    createLlm: gpustackProviderStrategy.createLlm,
    provider: { name: 'gpustack', apiKey: 'sk-gpu', baseUrl: 'https://gpu.example' },
    callArgs: { name: 'gpustack', apiKey: 'sk-gpu', baseURL: 'https://gpu.example/v1-openai' },
    factory: 'createOpenAICompatible',
    envKey: 'GPUSTACK_API_KEY',
    error: 'API key is required for gpustack. Check Providers settings or Aider environment variables (GPUSTACK_API_KEY).',
  },
  {
    name: 'clinepass',
    createLlm: clinePassProviderStrategy.createLlm,
    provider: { name: 'clinepass', apiKey: 'sk-cline' },
    callArgs: { name: 'clinepass', apiKey: 'sk-cline', baseURL: 'https://api.cline.bot/api/v1' },
    factory: 'createOpenAICompatible',
    modelCall: 'cline-pass/m1',
    envKey: 'CLINE_API_KEY',
    // resolveApiKey always consults CLINE_API_KEY, even with an explicit apiKey set
    expectedLookups: ['CLINE_API_KEY'],
    error: 'ClinePass API key is required in Providers settings or Aider environment variables (CLINE_API_KEY)',
  },
  {
    name: 'opencode',
    createLlm: opencodeProviderStrategy.createLlm,
    provider: { name: 'opencode', apiKey: 'sk-zen' },
    callArgs: { name: 'opencode', apiKey: 'sk-zen' },
    factory: 'createOpenAICompatible',
    envKey: 'OPENCODE_API_KEY',
    error: 'OpenCode API key is required in Providers settings or Aider environment variables (OPENCODE_API_KEY)',
  },
  {
    name: 'opencode-go',
    createLlm: opencodeGoProviderStrategy.createLlm,
    provider: { name: 'opencode-go', apiKey: 'sk-zengo' },
    callArgs: { name: 'opencode-go', apiKey: 'sk-zengo' },
    factory: 'createOpenAICompatible',
    envKey: 'OPENCODE_GO_API_KEY',
    error: 'OpenCode Go API key is required in Providers settings or Aider environment variables (OPENCODE_GO_API_KEY)',
  },
  {
    name: 'openrouter',
    createLlm: openrouterProviderStrategy.createLlm,
    provider: { name: 'openrouter', apiKey: 'sk-or' },
    callArgs: { apiKey: 'sk-or', compatibility: 'strict' },
    factory: 'createOpenRouter',
    kind: 'chat',
    envKey: 'OPENROUTER_API_KEY',
    error: 'OpenRouter API key is required in Providers settings or Aider environment variables (OPENROUTER_API_KEY)',
  },
  {
    name: 'requesty',
    createLlm: requestyProviderStrategy.createLlm,
    provider: { name: 'requesty', apiKey: 'sk-req' },
    callArgs: { apiKey: 'sk-req', compatibility: 'strict' },
    factory: 'createRequesty',
    envKey: 'REQUESTY_API_KEY',
    error: 'Requesty API key is required in Providers settings or Aider environment variables (REQUESTY_API_KEY)',
  },
  {
    name: 'anthropic-compatible',
    createLlm: anthropicCompatibleProviderStrategy.createLlm,
    provider: { name: 'anthropic-compatible', apiKey: 'sk-antc', baseUrl: 'https://api.example.com' },
    callArgs: { apiKey: 'sk-antc', baseURL: 'https://api.example.com/v1' },
    factory: 'createAnthropic',
    envKey: 'ANTHROPIC_API_KEY',
    error: 'API key is required for anthropic-compatible. Check Providers settings or Aider environment variables (ANTHROPIC_API_KEY).',
  },
];

describe.each(apiKeyRows)('$name createLlm', (row) => {
  it('forwards explicit apiKey, profile headers and model id to the SDK factory', () => {
    const result = row.createLlm(makeProfile(row.provider), model(), settings, '/proj');

    const c = call(row.factory, row.kind ?? 'model');
    const modelId = row.modelCall ?? 'm1';
    expect(c.model).toBe(modelId);
    expect(c.callArgs).toMatchObject({ ...row.callArgs, headers: { 'X-Test': 'hdr' } });
    expect(result).toEqual(
      row.kind && row.kind !== 'model' ? { sentinel: `${row.factory}:${row.kind}:${modelId}` } : { sentinel: `${row.factory}:${modelId}` },
    );

    // explicit apiKey must short-circuit credential env resolution
    expect(envMock.lookups).toEqual(row.expectedLookups ?? []);
  });

  it('falls back to the provider env var when apiKey is missing', () => {
    envMock.vars.set(row.envKey, { value: 'env-key', source: 'environment' });
    const provider = { ...row.provider, apiKey: undefined };

    row.createLlm(makeProfile(provider), model(), settings, '/proj');

    expect(envMock.lookups[0]).toBe(row.envKey);
    const c = call(row.factory, row.kind ?? 'model');
    expect(c.callArgs).toMatchObject({ ...row.callArgs, apiKey: 'env-key' });
  });

  it(`throws the current error when no credential exists: "${row.name}"`, () => {
    const provider = { ...row.provider, apiKey: undefined };
    expect(() => row.createLlm(makeProfile(provider), model(), settings, '/proj')).toThrow(row.error);
  });
});

describe('baseUrl forwarding (current behavior)', () => {
  it('gemini forwards customBaseUrl to createGoogle baseURL', () => {
    geminiProviderStrategy.createLlm(makeProfile({ name: 'gemini', apiKey: 'sk-gem', customBaseUrl: 'https://gemini.example' }), model(), settings, '/proj');

    const c = call('createGoogle');
    expect(c.callArgs).toMatchObject({ apiKey: 'sk-gem', baseURL: 'https://gemini.example' });
  });

  it('anthropic-compatible appends /v1 to bare base URLs', () => {
    anthropicCompatibleProviderStrategy.createLlm(
      makeProfile({ name: 'anthropic-compatible', apiKey: 'sk-antc', baseUrl: 'https://api.example.com' }),
      model(),
      settings,
      '/proj',
    );

    expect(call('createAnthropic').callArgs).toMatchObject({ baseURL: 'https://api.example.com/v1' });
  });

  it('anthropic-compatible does not double-append /v1', () => {
    anthropicCompatibleProviderStrategy.createLlm(
      makeProfile({ name: 'anthropic-compatible', apiKey: 'sk-antc', baseUrl: 'https://api.example.com/v1' }),
      model(),
      settings,
      '/proj',
    );

    expect(call('createAnthropic').callArgs).toMatchObject({ baseURL: 'https://api.example.com/v1' });
  });

  it('gpustack appends /v1-openai to the configured baseUrl', () => {
    gpustackProviderStrategy.createLlm(makeProfile({ name: 'gpustack', apiKey: 'sk-gpu', baseUrl: 'https://gpu.example' }), model(), settings, '/proj');

    expect(call('createOpenAICompatible').callArgs).toMatchObject({ baseURL: 'https://gpu.example/v1-openai' });
  });
});

describe('openai-compatible createLlm', () => {
  const create = (provider: Record<string, unknown>) => openaiCompatibleProviderStrategy.createLlm!(makeProfile(provider), model(), settings, '/proj');

  it('forwards provider name, apiKey, baseUrl and includeUsage to createOpenAICompatible', () => {
    const provider = { name: 'my-vllm', apiKey: 'sk-c', baseUrl: 'https://vllm.example/v1', trackTokenUsage: false };
    const result = create(provider);

    const c = call('createOpenAICompatible');
    expect(c.model).toBe('m1');
    expect(c.callArgs).toMatchObject({
      name: 'my-vllm',
      apiKey: 'sk-c',
      baseURL: 'https://vllm.example/v1',
      includeUsage: false,
      headers: { 'X-Test': 'hdr' },
    });
    expect(result).toEqual({ sentinel: 'createOpenAICompatible:m1' });
  });

  it('defaults includeUsage to true when trackTokenUsage is unset', () => {
    create({ name: 'my-vllm', apiKey: 'sk-c', baseUrl: 'https://vllm.example/v1' });
    expect(call('createOpenAICompatible').callArgs).toMatchObject({ includeUsage: true });
  });

  it('resolves OPENAI_API_KEY and OPENAI_API_BASE from the environment', () => {
    envMock.vars.set('OPENAI_API_KEY', { value: 'env-oai', source: 'environment' });
    envMock.vars.set('OPENAI_API_BASE', { value: 'https://env-vllm/v1', source: 'environment' });

    create({ name: 'my-vllm' });

    expect(envMock.lookups).toEqual(['OPENAI_API_KEY', 'OPENAI_API_BASE']);
    expect(call('createOpenAICompatible').callArgs).toMatchObject({ apiKey: 'env-oai', baseURL: 'https://env-vllm/v1' });
  });

  it('does not throw when only the API key is missing (apiKey is optional)', () => {
    expect(() => create({ name: 'my-vllm', baseUrl: 'https://vllm.example/v1' })).not.toThrow();
  });

  it('throws the current error when no baseUrl exists', () => {
    expect(() => create({ name: 'my-vllm' })).toThrow(
      'Base URL is required for my-vllm provider. Set it in Providers settings or via the OPENAI_API_BASE environment variable.',
    );
  });

  it('rejects an explicitly empty OPENAI_API_BASE env value like the pre-refactor !baseUrl check did', () => {
    // Regression: the generated descriptor strategy used to only reject an *absent*
    // base URL, so OPENAI_API_BASE='' reached the SDK factory as baseURL: ''.
    envMock.vars.set('OPENAI_API_BASE', { value: '', source: 'environment' });
    expect(() => create({ name: 'my-vllm' })).toThrow(
      'Base URL is required for my-vllm provider. Set it in Providers settings or via the OPENAI_API_BASE environment variable.',
    );
  });

  it('rejects an explicitly empty provider baseUrl field', () => {
    expect(() => create({ name: 'my-vllm', baseUrl: '' })).toThrow(
      'Base URL is required for my-vllm provider. Set it in Providers settings or via the OPENAI_API_BASE environment variable.',
    );
  });
});

describe('litellm createLlm', () => {
  const create = (provider: Record<string, unknown>) => litellmProviderStrategy.createLlm!(makeProfile(provider), model(), settings, '/proj');

  it('forwards LITELLM_API_KEY env-fallback and stripped baseUrl', () => {
    envMock.vars.set('LITELLM_API_KEY', { value: 'env-lite', source: 'environment' });
    envMock.vars.set('LITELLM_API_BASE', { value: 'https://proxy.example', source: 'environment' });

    create({ name: 'litellm' });

    expect(envMock.lookups).toEqual(['LITELLM_API_KEY', 'LITELLM_API_BASE']);
    const c = call('createOpenAICompatible');
    expect(c.callArgs).toMatchObject({ name: 'litellm', apiKey: 'env-lite', baseURL: 'https://proxy.example', includeUsage: true });
  });

  it('keeps a trailing slash from a provider-configured baseUrl intact in createLlm (set only stripped in the Aider mapping)', () => {
    create({ name: 'litellm', apiKey: 'sk-lite', baseUrl: 'https://proxy.example/' });
    expect(call('createOpenAICompatible').callArgs).toMatchObject({ baseURL: 'https://proxy.example/' });
  });

  it('throws the current error when no baseUrl exists', () => {
    expect(() => create({ name: 'litellm', apiKey: 'sk-lite' })).toThrow('Base URL is required for LiteLLM provider');
  });
});

describe('ollama createLlm', () => {
  it('normalizes the base URL with a trailing /api and strips trailing slashes', () => {
    const result = ollamaProviderStrategy.createLlm!(makeProfile({ name: 'ollama', baseUrl: 'http://localhost:11434/' }), model(), settings, '/proj');

    const c = call('createOllama');
    expect(c.callArgs).toMatchObject({ baseURL: 'http://localhost:11434/api', headers: { 'X-Test': 'hdr' } });
    expect(result).toEqual({ wrapped: { sentinel: 'createOllama:m1' } });
  });

  it('does not double-append /api', () => {
    ollamaProviderStrategy.createLlm!(makeProfile({ name: 'ollama', baseUrl: 'http://localhost:11434/api' }), model(), settings, '/proj');
    expect(call('createOllama').callArgs).toMatchObject({ baseURL: 'http://localhost:11434/api' });
  });

  it('resolves OLLAMA_API_BASE env var and throws the current error when missing', () => {
    expect(() => ollamaProviderStrategy.createLlm!(makeProfile({ name: 'ollama' }), model(), settings, '/proj')).toThrow(
      'Base URL is required for Ollama provider. Set it in Providers settings or via the OLLAMA_API_BASE environment variable.',
    );

    envMock.vars.set('OLLAMA_API_BASE', { value: 'http://env-ollama:11434', source: 'environment' });
    envMock.lookups.length = 0;
    ollamaProviderStrategy.createLlm!(makeProfile({ name: 'ollama' }), model(), settings, '/proj');
    expect(envMock.lookups).toEqual(['OLLAMA_API_BASE']);
    expect(call('createOllama').callArgs).toMatchObject({ baseURL: 'http://env-ollama:11434/api' });
  });
});

describe('lm-studio createLlm', () => {
  it('forwards baseUrl with the lmstudio name and includeUsage true', () => {
    lmStudioProviderStrategy.createLlm!(makeProfile({ name: 'lmstudio', baseUrl: 'http://localhost:1234/v1' }), model(), settings, '/proj');
    expect(call('createOpenAICompatible').callArgs).toMatchObject({
      name: 'lmstudio',
      baseURL: 'http://localhost:1234/v1',
      includeUsage: true,
    });
  });

  it('resolves LMSTUDIO_API_BASE env var and throws the current error when missing', () => {
    expect(() => lmStudioProviderStrategy.createLlm!(makeProfile({ name: 'lmstudio' }), model(), settings, '/proj')).toThrow(
      'Base URL is required for LMStudio provider. Set it in Providers settings or via the LMSTUDIO_API_BASE environment variable.',
    );

    envMock.vars.set('LMSTUDIO_API_BASE', { value: 'http://env-lms/v1', source: 'environment' });
    envMock.lookups.length = 0;
    lmStudioProviderStrategy.createLlm!(makeProfile({ name: 'lmstudio' }), model(), settings, '/proj');
    expect(envMock.lookups).toEqual(['LMSTUDIO_API_BASE']);
    expect(call('createOpenAICompatible').callArgs).toMatchObject({ baseURL: 'http://env-lms/v1' });
  });
});

describe('clinepass model id prefixing', () => {
  it('prefixes the model id with cline-pass/', () => {
    clinePassProviderStrategy.createLlm!(makeProfile({ name: 'clinepass', apiKey: 'sk-cline' }), model('kimi-k2.6'), settings, '/proj');

    const c = call('createOpenAICompatible');
    expect(c.model).toBe('cline-pass/kimi-k2.6');
    expect(c.callArgs).toMatchObject({ name: 'clinepass', baseURL: 'https://api.cline.bot/api/v1' });
  });
});

describe('opencode endpoint dispatch', () => {
  const create = (modelId: string) =>
    opencodeProviderStrategy.createLlm!(makeProfile({ name: 'opencode', apiKey: 'sk-zen' }), model(modelId), settings, '/proj');

  it('dispatches gpt-* model ids to createOpenAI', () => {
    expect(create('gpt-5.2')).toEqual({ sentinel: 'createOpenAI:gpt-5.2' });
    expect(call('createOpenAI').callArgs).toMatchObject({ apiKey: 'sk-zen', baseURL: 'https://opencode.ai/zen/v1' });
  });

  it('dispatches claude-* model ids to createAnthropic', () => {
    expect(create('claude-sonnet-4-5')).toEqual({ sentinel: 'createAnthropic:claude-sonnet-4-5' });
    expect(call('createAnthropic').callArgs).toMatchObject({ apiKey: 'sk-zen', baseURL: 'https://opencode.ai/zen/v1' });
  });

  it('dispatches gemini-* model ids to createGoogle', () => {
    expect(create('gemini-3-flash')).toEqual({ sentinel: 'createGoogle:gemini-3-flash' });
    expect(call('createGoogle').callArgs).toMatchObject({ apiKey: 'sk-zen', baseURL: 'https://opencode.ai/zen/v1' });
  });

  it('falls back to createOpenAICompatible for other model ids', () => {
    expect(create('qwen3-coder')).toEqual({ sentinel: 'createOpenAICompatible:qwen3-coder' });
    expect(call('createOpenAICompatible').callArgs).toMatchObject({ name: 'opencode', apiKey: 'sk-zen', baseURL: 'https://opencode.ai/zen/v1' });
  });
});

describe('opencode-go endpoint dispatch', () => {
  const create = (modelId: string) =>
    opencodeGoProviderStrategy.createLlm!(makeProfile({ name: 'opencode-go', apiKey: 'sk-zengo' }), model(modelId), settings, '/proj');

  it('uses the OpenAI responses endpoint for documented openai-responses models', () => {
    expect(create('grok-4.5')).toEqual({ sentinel: 'createOpenAI:responses:grok-4.5' });
    expect(call('createOpenAI', 'responses').callArgs).toMatchObject({ apiKey: 'sk-zengo', baseURL: 'https://opencode.ai/zen/go/v1' });
  });

  it('falls back to openai-responses for unknown gpt-* model ids', () => {
    expect(create('gpt-9-beta')).toEqual({ sentinel: 'createOpenAI:responses:gpt-9-beta' });
    expect(call('createOpenAI', 'responses').model).toBe('gpt-9-beta');
  });

  it('uses the Anthropic endpoint for documented anthropic models', () => {
    expect(create('minimax-m3')).toEqual({ sentinel: 'createAnthropic:minimax-m3' });
    expect(call('createAnthropic').callArgs).toMatchObject({ apiKey: 'sk-zengo', baseURL: 'https://opencode.ai/zen/go/v1' });
  });

  it('falls back to Anthropic for unknown minimax-*/qwen* model ids', () => {
    expect(create('minimax-m9')).toEqual({ sentinel: 'createAnthropic:minimax-m9' });
  });

  it('falls back to createOpenAICompatible for everything else', () => {
    expect(create('glmv-demo')).toEqual({ sentinel: 'createOpenAICompatible:glmv-demo' });
    expect(call('createOpenAICompatible').callArgs).toMatchObject({ name: 'opencode-go', baseURL: 'https://opencode.ai/zen/go/v1' });
  });
});

describe('openrouter createLlm', () => {
  it('adds AiderDesk referer/title headers and calls the chat endpoint with usage tracking', () => {
    const result = openrouterProviderStrategy.createLlm!(makeProfile({ name: 'openrouter', apiKey: 'sk-or' }), model(), settings, '/proj');

    const c = call('createOpenRouter', 'chat');
    expect(c.callArgs).toMatchObject({
      apiKey: 'sk-or',
      compatibility: 'strict',
      headers: {
        'X-Test': 'hdr',
        'HTTP-Referer': expect.any(String),
        'X-Title': expect.any(String),
      },
      extraBody: { provider: expect.any(Object) },
    });
    expect(c.options).toEqual({ usage: { include: true } });
    expect(result).toEqual({ sentinel: 'createOpenRouter:chat:m1' });
  });
});

describe('zai-plan credential resolution (unified on ZAI_API_KEY — Phase 1 fix)', () => {
  it('resolves ZAI_API_KEY in createLlm the same way loadModels and the Aider mapping do', () => {
    envMock.vars.set('ZAI_API_KEY', { value: 'env-zai', source: 'environment' });

    zaiPlanProviderStrategy.createLlm!(makeProfile({ name: 'zai-plan' }), model(), settings, '/proj');

    expect(envMock.lookups).toEqual(['ZAI_API_KEY']);
    expect(call('createOpenAICompatible').callArgs).toMatchObject({ apiKey: 'env-zai' });
  });

  it('ignores OPENAI_API_KEY and throws the ZAI_API_KEY error when no key exists', () => {
    envMock.vars.clear();
    envMock.lookups.length = 0;
    envMock.vars.set('OPENAI_API_KEY', { value: 'env-oai', source: 'environment' });
    expect(() => zaiPlanProviderStrategy.createLlm!(makeProfile({ name: 'zai-plan' }), model(), settings, '/proj')).toThrow(
      'API key is required for zai-plan. Check Providers settings or Aider environment variables (ZAI_API_KEY).',
    );
  });
});

describe('azure createLlm', () => {
  it('resolves the resource name from AZURE_API_BASE env var and uses the responses endpoint', () => {
    envMock.vars.set('AZURE_API_KEY', { value: 'env-az', source: 'environment' });
    envMock.vars.set('AZURE_API_BASE', { value: 'https://env-resource.openai.azure', source: 'environment' });

    azureProviderStrategy.createLlm!(makeProfile({ name: 'azure' }), model(), settings, '/proj');

    expect(envMock.lookups).toEqual(['AZURE_API_KEY', 'AZURE_API_BASE']);
    const c = call('createAzure', 'responses');
    expect(c.callArgs).toMatchObject({ apiKey: 'env-az', resourceName: 'env-resource' });
  });

  it('currently fails to extract the resource name from standard *.openai.azure.com endpoints (Phase 0 lock)', () => {
    // extractResourceNameFromEndpoint only matches hostnames ending in '.openai.azure'
    // exactly (no TLD), so the common <resource>.openai.azure.com form does NOT resolve.
    envMock.vars.set('AZURE_API_KEY', { value: 'env-az', source: 'environment' });
    envMock.vars.set('AZURE_API_BASE', { value: 'https://env-resource.openai.azure.com/', source: 'environment' });

    expect(() => azureProviderStrategy.createLlm!(makeProfile({ name: 'azure' }), model(), settings, '/proj')).toThrow(
      'Azure OpenAI resource name is required in Providers settings or Aider environment variables (AZURE_API_BASE)',
    );
  });

  it('throws the current error when the resource name is missing', () => {
    const provider = { name: 'azure', apiKey: 'sk-az' };
    expect(() => azureProviderStrategy.createLlm!(makeProfile(provider), model(), settings, '/proj')).toThrow(
      'Azure OpenAI resource name is required in Providers settings or Aider environment variables (AZURE_API_BASE)',
    );
  });
});
