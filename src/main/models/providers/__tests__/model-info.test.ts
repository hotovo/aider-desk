/**
 * Regression test for the descriptor factory dropping the default getModelInfo:
 * the pre-refactor cerebras/groq/deepseek/mistral/neuralwatt/clinepass strategies
 * each declared `getModelInfo: getDefaultModelInfo`; createStrategyFromDescriptor
 * silently omitted it, so model-manager.enrichWithModelInfo (which gates on
 * `if (strategy.getModelInfo)`) skipped enrichment and those providers' models
 * lost limits/pricing metadata (zero-cost usage reports).
 */
import { describe, expect, it, vi } from 'vitest';
import { ModelInfo, ProviderProfile } from '@common/types';

import { createStrategyFromDescriptor, ProviderDescriptor } from '../strategy-factory';
import { getDefaultModelInfo } from '../default';
import { cerebrasProviderStrategy } from '../cerebras';
import { groqProviderStrategy } from '../groq';
import { deepseekProviderStrategy } from '../deepseek';
import { mistralProviderStrategy } from '../mistral';
import { neuralwattProviderStrategy } from '../neuralwatt';
import { clinePassProviderStrategy } from '../clinepass';
import { syntheticProviderStrategy } from '../synthetic';
import { zaiPlanProviderStrategy } from '../zai-plan';
import { openaiCompatibleProviderStrategy } from '../openai-compatible';

import type { LlmProviderStrategy } from '@/models';

vi.mock('@/logger');

const minimalDescriptor: ProviderDescriptor = {
  name: 'test-provider',
  label: 'Test Provider',
  sdkFactory: (): never => {
    throw new Error('not used in this test');
  },
  modelsLoader: { type: 'static', items: () => [] },
  aider: { prefix: 'test', apiKeyEnv: 'TEST_API_KEY' },
};

describe('createStrategyFromDescriptor model info', () => {
  it('generated strategy exposes the default getModelInfo', () => {
    const strategy = createStrategyFromDescriptor(minimalDescriptor);
    expect(strategy.getModelInfo).toBe(getDefaultModelInfo);
  });

  it('default getModelInfo resolves provider.id/modelId first, then provider.name/modelId', () => {
    const provider = { id: 'p1', name: 'my-profile', provider: {} } as unknown as ProviderProfile;
    const modelInfoByName = { id: 'info-by-name' } as unknown as ModelInfo;
    const modelInfoById = { id: 'info-by-id' } as unknown as ModelInfo;

    // canonical identity (profile id) wins
    let found = getDefaultModelInfo(provider, 'm1', { 'p1/m1': modelInfoById, 'my-profile/m1': modelInfoByName });
    expect(found).toBe(modelInfoById);

    // falls back to the profile name only when the canonical id has no entry
    found = getDefaultModelInfo(provider, 'm1', { 'my-profile/m1': modelInfoByName });
    expect(found).toBe(modelInfoByName);

    // nothing found
    expect(getDefaultModelInfo(provider, 'm1', {})).toBeUndefined();
  });

  it('a user-facing profile name never shadows a matching canonical id', () => {
    // Profile whose display name equals another catalog provider slug ("google"):
    // its models must be enriched with ITS OWN provider's metadata, not Google's.
    const provider = { id: 'openai', name: 'google', provider: {} } as unknown as ProviderProfile;
    const openaiInfo = { maxInputTokens: 128000 } as unknown as ModelInfo;
    const googleInfo = { maxInputTokens: 1000000 } as unknown as ModelInfo;

    expect(getDefaultModelInfo(provider, 'gemini-2.0-flash', { 'openai/gemini-2.0-flash': openaiInfo, 'google/gemini-2.0-flash': googleInfo })).toBe(
      openaiInfo,
    );
  });

  it('generated strategy getModelInfo enriches models via modelsInfo lookup', () => {
    const strategy = createStrategyFromDescriptor(minimalDescriptor);
    const provider = { id: 'p1', name: 'my-profile', provider: {} } as unknown as ProviderProfile;
    const info = { maxInputTokens: 8192, inputCostPerToken: 0.1, outputCostPerToken: 0.2 } as unknown as ModelInfo;

    expect(strategy.getModelInfo?.(provider, 'llama-3', { 'my-profile/llama-3': info })).toBe(info);
  });

  // Characterization (intentional widening): the pre-refactor openai-compatible strategy
  // had NO getModelInfo, so enrichWithModelInfo skipped it entirely. The generated
  // descriptor strategy now exposes the default lookup, giving openai-compatible the
  // same modelsInfo metadata (token limits / pricing) as every other simple provider.
  it('openai-compatible descriptor strategy exposes default getModelInfo and returns model metadata', () => {
    expect(openaiCompatibleProviderStrategy.getModelInfo).toBe(getDefaultModelInfo);

    const profile = { id: 'p1', name: 'my-profile', provider: { name: 'my-vllm' } } as unknown as ProviderProfile;
    const info = { maxInputTokens: 32768, inputCostPerToken: 0.000001, outputCostPerToken: 0.000002 } as unknown as ModelInfo;

    expect(openaiCompatibleProviderStrategy.getModelInfo?.(profile, 'llama-3', { 'my-profile/llama-3': info })).toBe(info);
    expect(openaiCompatibleProviderStrategy.getModelInfo?.(profile, 'unknown-model', {})).toBeUndefined();
  });

  it.each([
    ['cerebras', cerebrasProviderStrategy],
    ['groq', groqProviderStrategy],
    ['deepseek', deepseekProviderStrategy],
    ['mistral', mistralProviderStrategy],
    ['neuralwatt', neuralwattProviderStrategy],
    ['clinepass', clinePassProviderStrategy],
  ])('%s descriptor strategy keeps getModelInfo for enrichment', (_name, strategy: LlmProviderStrategy) => {
    expect(strategy.getModelInfo).toBe(getDefaultModelInfo);
  });

  it.each([
    ['synthetic', syntheticProviderStrategy, 'synthetic'],
    ['zai-plan', zaiPlanProviderStrategy, 'zai-coding-plan'],
  ])('%s bespoke getModelInfo override still wins over the default', (_name, strategy: LlmProviderStrategy, prefix: string) => {
    expect(strategy.getModelInfo).not.toBe(getDefaultModelInfo);
    const provider = { id: 'p1', name: 'my-profile', provider: {} } as unknown as ProviderProfile;
    const info = { id: 'override-info' } as unknown as ModelInfo;
    expect(strategy.getModelInfo?.(provider, 'm1', { [`${prefix}/m1`]: info })).toBe(info);
  });
});
