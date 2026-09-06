import { createAnthropic } from '@ai-sdk/anthropic';
import { isMinimaxProvider, LlmProvider } from '@common/agent';
import { Model, ProviderProfile, Reasoning } from '@common/types';

import type { SharedV4ProviderOptions } from '@ai-sdk/provider';

import { CacheControl, LlmProviderStrategy } from '@/models';
import { createStrategyFromDescriptor } from '@/models/providers/strategy-factory';
import { getAnthropicAdaptiveThinkingOptions } from '@/models/providers/shared';

// Canonical MiniMax-M3 catalog pricing, shared with vendors of MiniMax models
// (ClinePass) so pricing cannot drift between the providers. Model ids and
// catalog metadata (e.g. maxOutputTokensLimit) stay provider-specific.
export const MINIMAX_M3_MODEL_PRICING = {
  maxInputTokens: 1000000,
  inputCostPerToken: 0.0000003, // 0.3 per 1M tokens
  outputCostPerToken: 0.0000012, // 1.2 per 1M tokens
  cacheReadInputTokenCost: 0.00000006, // 0.06 per 1M tokens
  cacheWriteInputTokenCost: 0.000000375, // 0.375 per 1M tokens
} as const;

const MINIMAX_STATIC_MODELS = [
  {
    id: 'MiniMax-M3',
    maxOutputTokensLimit: 131072,
    ...MINIMAX_M3_MODEL_PRICING,
  },
  {
    id: 'MiniMax-M2.7',
    maxInputTokens: 204800,
    maxOutputTokensLimit: 131072,
    inputCostPerToken: 0.0000003, // 0.3 per 1M tokens
    outputCostPerToken: 0.0000012, // 1.2 per 1M tokens
    cacheReadInputTokenCost: 0.00000006, // 0.06 per 1M tokens
    cacheWriteInputTokenCost: 0.000000375, // 0.375 per 1M tokens
  },
  {
    id: 'MiniMax-M2.7-highspeed',
    maxInputTokens: 204800,
    maxOutputTokensLimit: 131072,
    inputCostPerToken: 0.0000006, // 0.6 per 1M tokens
    outputCostPerToken: 0.0000024, // 2.4 per 1M tokens
    cacheReadInputTokenCost: 0.00000006, // 0.06 per 1M tokens
    cacheWriteInputTokenCost: 0.000000375, // 0.375 per 1M tokens
  },
  {
    id: 'MiniMax-M2.5',
    maxInputTokens: 204800,
    maxOutputTokensLimit: 131072,
    inputCostPerToken: 0.0000003, // 0.3 per 1M tokens
    outputCostPerToken: 0.0000012, // 1.2 per 1M tokens
    cacheReadInputTokenCost: 0.00000003, // 0.03 per 1M tokens
    cacheWriteInputTokenCost: 0.000000375, // 0.375 per 1M tokens
  },
  {
    id: 'MiniMax-M2.5-highspeed',
    maxInputTokens: 204800,
    maxOutputTokensLimit: 131072,
    inputCostPerToken: 0.0000006, // 0.6 per 1M tokens
    outputCostPerToken: 0.0000024, // 2.4 per 1M tokens
    cacheReadInputTokenCost: 0.00000003, // 0.03 per 1M tokens
    cacheWriteInputTokenCost: 0.000000375, // 0.375 per 1M tokens
  },
  {
    id: 'MiniMax-M2.1',
    maxInputTokens: 204800,
    maxOutputTokensLimit: 131072,
    inputCostPerToken: 0.0000003, // 0.3 per 1M tokens
    outputCostPerToken: 0.0000012, // 1.2 per 1M tokens
    cacheReadInputTokenCost: 0.00000003, // 0.03 per 1M tokens
    cacheWriteInputTokenCost: 0.000000375, // 0.375 per 1M tokens
  },
  {
    id: 'MiniMax-M2.1-highspeed',
    maxInputTokens: 204800,
    maxOutputTokensLimit: 131072,
    inputCostPerToken: 0.0000006, // 0.6 per 1M tokens
    outputCostPerToken: 0.0000024, // 2.4 per 1M tokens
    cacheReadInputTokenCost: 0.00000003, // 0.03 per 1M tokens
    cacheWriteInputTokenCost: 0.000000375, // 0.375 per 1M tokens
  },
  {
    id: 'MiniMax-M2',
    maxInputTokens: 204800,
    maxOutputTokensLimit: 131072,
    inputCostPerToken: 0.0000003, // 0.3 per 1M tokens
    outputCostPerToken: 0.0000012, // 1.2 per 1M tokens
    cacheReadInputTokenCost: 0.00000003, // 0.03 per 1M tokens
    cacheWriteInputTokenCost: 0.000000375, // 0.375 per 1M tokens
  },
];

// Hardcoded MiniMax catalog - no API call needed
const minimaxStaticModels = (profile: ProviderProfile): Model[] => MINIMAX_STATIC_MODELS.map((model) => ({ ...model, providerId: profile.id }));

export const getMinimaxProviderOptions = (llmProvider: LlmProvider, _model: Model, reasoning?: Reasoning): SharedV4ProviderOptions | undefined => {
  if (!isMinimaxProvider(llmProvider) || (reasoning && reasoning !== 'provider-default')) {
    return undefined;
  }

  return getAnthropicAdaptiveThinkingOptions();
};

export const minimaxProviderStrategy: LlmProviderStrategy = createStrategyFromDescriptor({
  name: 'minimax',
  label: 'Minimax',
  // MiniMax speaks the Anthropic wire protocol
  sdkFactory: createAnthropic,
  apiKeyEnv: 'MINIMAX_API_KEY',
  fixedBaseURL: 'https://api.minimax.io/anthropic/v1',
  isProvider: isMinimaxProvider,
  modelsLoader: { type: 'static', items: minimaxStaticModels },
  aider: {
    prefix: 'openai',
    apiKeyEnv: 'OPENAI_API_KEY',
    sourceEnvKey: 'MINIMAX_API_KEY',
    readEnvFallback: true,
    upstreamBaseUrl: 'https://api.minimax.io/v1',
  },
  overrides: {
    getCacheControl: (): CacheControl | undefined => ({
      providerOptions: {
        anthropic: {
          cacheControl: { type: 'ephemeral' },
        },
      },
      placement: 'message',
    }),
    getProviderOptions: getMinimaxProviderOptions,
  },
});
