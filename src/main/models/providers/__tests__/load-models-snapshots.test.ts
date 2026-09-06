/**
 * Phase 0 behavior-locking tests for load<L>Models: request URLs, auth headers,
 * response mappers, and the {models, success, error} result shapes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderProfile, SettingsData } from '@common/types';

import { loadGroqModels } from '../groq';
import { loadCerebrasModels } from '../cerebras';
import { loadMistralModels } from '../mistral';
import { loadDeepseekModels } from '../deepseek';
import { neuralwattProviderStrategy } from '../neuralwatt';
import { syntheticProviderStrategy } from '../synthetic';
import { zaiPlanProviderStrategy } from '../zai-plan';
import { opencodeProviderStrategy } from '../opencode';
import { opencodeGoProviderStrategy } from '../opencode-go';
import { openrouterProviderStrategy } from '../openrouter';
import { requestyProviderStrategy } from '../requesty';
import { gpustackProviderStrategy } from '../gpustack';

import { envMock, profileFor, settings } from './test-utils';

vi.mock('@/logger');

vi.mock('@/utils/environment', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/environment')>();
  const { envMock } = await import('./test-utils');
  return { ...actual, getEffectiveEnvironmentVariable: envMock.getEffectiveEnvironmentVariable };
});

const mockFetch = (payload: unknown, init?: { ok?: boolean; status?: number; statusText?: string; text?: string }) => {
  const response = {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    text: async () => init?.text ?? 'body',
    json: async () => payload,
  };
  (global.fetch as any) = vi.fn().mockResolvedValue(response);
  return global.fetch as any;
};

type Row = {
  name: string;
  loadModels: (profile: ProviderProfile, settings: SettingsData) => Promise<{ models: unknown[]; success: boolean; error?: string }>;
  provider: Record<string, unknown>;
  apiKey: string;
  url: string;
  payload: unknown;
  /** env var consulted when provider.apiKey is missing */
  envKey: string;
  /** expected ids of returned models */
  ids: string[];
  /** extra assertions on the first returned model */
  firstModel?: Record<string, unknown>;
};

const rows: Row[] = [
  {
    name: 'groq',
    loadModels: loadGroqModels,
    provider: { name: 'groq', apiKey: 'sk-groq' },
    apiKey: 'sk-groq',
    url: 'https://api.groq.com/openai/v1/models',
    payload: { data: [{ id: 'llama-3' }, { id: 'mixtral' }] },
    envKey: 'GROQ_API_KEY',
    ids: ['llama-3', 'mixtral'],
  },
  {
    name: 'cerebras',
    loadModels: loadCerebrasModels,
    provider: { name: 'cerebras', apiKey: 'sk-cer' },
    apiKey: 'sk-cer',
    url: 'https://api.cerebras.ai/v1/models',
    payload: { data: [{ id: 'llama3.1', max_context_length: 128000 }] },
    envKey: 'CEREBRAS_API_KEY',
    ids: ['llama3.1'],
    firstModel: { maxInputTokens: 128000 },
  },
  {
    name: 'mistral',
    loadModels: loadMistralModels,
    provider: { name: 'mistral', apiKey: 'sk-mistral' },
    apiKey: 'sk-mistral',
    url: 'https://api.mistral.ai/v1/models',
    payload: { data: [{ id: 'mistral-large' }, { id: 'mistral-large' }] },
    envKey: 'MISTRAL_API_KEY',
    ids: ['mistral-large'],
    firstModel: { temperature: 0.7 },
  },
  {
    name: 'deepseek',
    loadModels: loadDeepseekModels,
    provider: { name: 'deepseek', apiKey: 'sk-ds' },
    apiKey: 'sk-ds',
    url: 'https://api.deepseek.com/v1/models',
    payload: { data: [{ id: 'deepseek-chat' }] },
    envKey: 'DEEPSEEK_API_KEY',
    ids: ['deepseek-chat'],
  },
  {
    name: 'neuralwatt',
    loadModels: neuralwattProviderStrategy.loadModels,
    provider: { name: 'neuralwatt', apiKey: 'sk-nw' },
    apiKey: 'sk-nw',
    url: 'https://api.neuralwatt.com/v1/models',
    payload: { data: [{ id: 'nw-model' }] },
    envKey: 'NEURALWATT_API_KEY',
    ids: ['nw-model'],
  },
  {
    name: 'synthetic',
    loadModels: syntheticProviderStrategy.loadModels,
    provider: { name: 'synthetic', apiKey: 'sk-syn' },
    apiKey: 'sk-syn',
    url: 'https://api.synthetic.new/openai/v1/models',
    payload: { data: [{ id: 'hf:zai-org' }] },
    envKey: 'SYNTHETIC_API_KEY',
    ids: ['hf:zai-org'],
  },
  {
    name: 'opencode',
    loadModels: opencodeProviderStrategy.loadModels,
    provider: { name: 'opencode', apiKey: 'sk-zen' },
    apiKey: 'sk-zen',
    url: 'https://opencode.ai/zen/v1/models',
    payload: { object: 'list', data: [{ id: 'claude-sonnet-4' }] },
    envKey: 'OPENCODE_API_KEY',
    ids: ['claude-sonnet-4'],
  },
  {
    name: 'opencode-go',
    loadModels: opencodeGoProviderStrategy.loadModels,
    provider: { name: 'opencode-go', apiKey: 'sk-zengo' },
    apiKey: 'sk-zengo',
    url: 'https://opencode.ai/zen/go/v1/models',
    payload: { object: 'list', data: [{ id: 'minimax-m3' }] },
    envKey: 'OPENCODE_GO_API_KEY',
    ids: ['minimax-m3'],
  },
  {
    name: 'requesty',
    loadModels: requestyProviderStrategy.loadModels,
    provider: { name: 'requesty', apiKey: 'sk-req' },
    apiKey: 'sk-req',
    url: 'https://router.requesty.ai/v1/models',
    payload: {
      data: [
        {
          id: 'openai/gpt-5',
          created: 1,
          owned_by: 'openai',
          input_price: 0.0000015,
          caching_price: 0.0000019,
          cached_price: 0.0000002,
          output_price: 0.000006,
          max_output_tokens: 16384,
          context_window: 400000,
          supports_caching: true,
          supports_vision: true,
          supports_computer_use: false,
          supports_reasoning: true,
          description: 'test',
        },
      ],
    },
    envKey: 'REQUESTY_API_KEY',
    ids: ['openai/gpt-5'],
    firstModel: { maxInputTokens: 400000, inputCostPerToken: 0.0000015, outputCostPerToken: 0.000006 },
  },
  {
    name: 'openrouter',
    loadModels: openrouterProviderStrategy.loadModels,
    provider: { name: 'openrouter', apiKey: 'sk-or' },
    apiKey: 'sk-or',
    url: 'https://openrouter.ai/api/v1/models',
    payload: {
      data: [
        {
          id: 'anthropic/claude-sonnet-4',
          name: 'Claude',
          created: 1,
          description: 'test',
          top_provider: { is_moderated: true, context_length: 200000, max_completion_tokens: 64000 },
          pricing: { prompt: '0.000003', completion: '0.000015', input_cache_read: '0.0000003', input_cache_write: '0.00000375' },
          context_length: 200000,
        },
      ],
    },
    envKey: 'OPENROUTER_API_KEY',
    ids: ['anthropic/claude-sonnet-4'],
    firstModel: {
      maxInputTokens: 200000,
      maxOutputTokensLimit: 64000,
      inputCostPerToken: 0.000003,
      outputCostPerToken: 0.000015,
      cacheReadInputTokenCost: 0.0000003,
      cacheWriteInputTokenCost: 0.00000375,
    },
  },
];

describe.each(rows)('$name loadModels', (row) => {
  beforeEach(() => {
    envMock.vars.clear();
  });

  it('requests the expected URL with the provider apiKey as Bearer token and maps models', async () => {
    const fetchMock = mockFetch(row.payload);

    const result = await row.loadModels(profileFor(row.provider), settings);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(row.url);
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({ Authorization: `Bearer ${row.apiKey}` });

    expect(result.success).toBe(true);
    expect(result.models.map((m) => (m as { id: string }).id)).toEqual(row.ids);
    expect(result.models[0]).toMatchObject({ id: row.ids[0], providerId: 'p1', ...(row.firstModel ?? {}) });
  });

  it('falls back to the env var when apiKey is missing', async () => {
    envMock.vars.set(row.envKey, { value: 'env-key', source: 'environment' });
    const fetchMock = mockFetch(row.payload);

    const result = await row.loadModels(profileFor({ ...row.provider, apiKey: undefined }), settings);

    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({ Authorization: 'Bearer env-key' });
    expect(result.success).toBe(true);
  });

  it('returns {models: [], success: false, error} on non-OK responses', async () => {
    mockFetch({}, { ok: false, status: 401, statusText: 'Unauthorized', text: 'denied' });

    const result = await row.loadModels(profileFor(row.provider), settings);

    expect(result.models).toEqual([]);
    expect(result.success).toBe(false);
    expect(result.error).toContain('401');
  });

  it('returns {models: [], success: false} with no error and no request when no credential exists', async () => {
    const fetchMock = vi.fn();
    (global.fetch as any) = fetchMock;

    const result = await row.loadModels(profileFor({ ...row.provider, apiKey: undefined }), settings);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({ models: [], success: false });
  });
});

describe('zai-plan loadModels credential resolution (unified on ZAI_API_KEY — Phase 1 fix)', () => {
  it('does not consult OPENAI_API_KEY for loadModels anymore', async () => {
    envMock.vars.set('OPENAI_API_KEY', { value: 'env-oai', source: 'environment' });
    const fetchMock = mockFetch({ data: [{ id: 'glm-4.6' }] });

    const result = await zaiPlanProviderStrategy.loadModels(profileFor({ name: 'zai-plan' }), settings);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({ models: [], success: false });
  });

  it('resolves credentials via ZAI_API_KEY like createLlm and the Aider mapping', async () => {
    envMock.vars.set('ZAI_API_KEY', { value: 'env-zai', source: 'environment' });
    const fetchMock = mockFetch({ data: [{ id: 'glm-4.6' }] });

    const result = await zaiPlanProviderStrategy.loadModels(profileFor({ name: 'zai-plan' }), settings);

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.z.ai/api/paas/v4/models');
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({ Authorization: 'Bearer env-zai' });
    expect(result).toEqual({ models: [{ id: 'glm-4.6', providerId: 'p1', temperature: 0.7 }], success: true });
  });
});

describe('gpustack loadModels', () => {
  it('maps data.items[].name (not data.data[].id) and requests ${baseUrl}/v1/models', async () => {
    const fetchMock = mockFetch({ items: [{ name: 'qwen2.5', meta: { max_model_len: 32768 } }, { name: 'llama3' }] });
    envMock.vars.clear();

    const result = await gpustackProviderStrategy.loadModels(profileFor({ name: 'gpustack', apiKey: 'sk-gpu', baseUrl: 'https://gpu.example' }), settings);

    expect(fetchMock.mock.calls[0][0]).toBe('https://gpu.example/v1/models');
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({ Authorization: 'Bearer sk-gpu' });
    expect(result).toEqual({
      success: true,
      models: [
        { id: 'qwen2.5', providerId: 'p1', maxInputTokens: 32768 },
        { id: 'llama3', providerId: 'p1', maxInputTokens: undefined },
      ],
    });
  });

  it('returns the error shape on failure', async () => {
    mockFetch({}, { ok: false, status: 500, statusText: 'Server Error', text: 'boom' });

    const result = await gpustackProviderStrategy.loadModels(profileFor({ name: 'gpustack', apiKey: 'sk-gpu', baseUrl: 'https://gpu.example' }), settings);

    expect(result.models).toEqual([]);
    expect(result.success).toBe(false);
    expect(result.error).toContain('500');
  });
});

afterEach(() => {
  envMock.vars.clear();
  vi.restoreAllMocks();
});
