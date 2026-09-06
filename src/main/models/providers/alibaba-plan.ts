import { isAlibabaPlanProvider, LlmProvider } from '@common/agent';
import { createAlibaba } from '@ai-sdk/alibaba';
import { Model, ProviderProfile, Reasoning } from '@common/types';

import type { SharedV4ProviderOptions } from '@ai-sdk/provider';

import { LlmProviderStrategy } from '@/models';
import logger from '@/logger';
import { createStrategyFromDescriptor } from '@/models/providers/strategy-factory';
import { mergeModelProps } from '@/models/providers/shared';

const ALIBABA_PLAN_BASE_URL = 'https://coding-intl.dashscope.aliyuncs.com/v1';

const ALIBABA_PLAN_MODELS = [
  { id: 'qwen3.5-plus', maxInputTokens: 1000000, maxOutputTokensLimit: 65536 },
  { id: 'qwen3-max-2026-01-23', maxInputTokens: 262144, maxOutputTokensLimit: 65536 },
  { id: 'qwen3-coder-next', maxInputTokens: 262144, maxOutputTokensLimit: 65536 },
  { id: 'qwen3-coder-plus', maxInputTokens: 1000000, maxOutputTokensLimit: 65536 },
  { id: 'MiniMax-M2.5', maxInputTokens: 204800, maxOutputTokensLimit: 131072 },
  { id: 'glm-5', maxInputTokens: 202752, maxOutputTokensLimit: 16384 },
  { id: 'glm-4.7', maxInputTokens: 202752, maxOutputTokensLimit: 16384 },
  { id: 'kimi-k2.5', maxInputTokens: 262144, maxOutputTokensLimit: 32768 },
];

const alibabaPlanStaticModels = (profile: ProviderProfile): Model[] => ALIBABA_PLAN_MODELS.map((model) => ({ ...model, providerId: profile.id }));

const getAlibabaPlanProviderOptions = (llmProvider: LlmProvider, model: Model, reasoning?: Reasoning): SharedV4ProviderOptions | undefined => {
  if (isAlibabaPlanProvider(llmProvider)) {
    if (reasoning && reasoning !== 'provider-default') {
      return undefined;
    }

    const overrides = mergeModelProps(model, llmProvider, ['thinkingEnabled', 'thinkingBudget']);
    const thinkingEnabled = overrides.thinkingEnabled ?? true;
    const thinkingBudget = overrides.thinkingBudget ?? 8192;

    logger.info(`Alibaba Plan provider options: thinkingEnabled=${thinkingEnabled}, thinkingBudget=${thinkingBudget}`);

    return {
      alibaba: {
        enableThinking: thinkingEnabled,
        ...(thinkingEnabled && { thinkingBudget }),
      },
    };
  }

  return undefined;
};

export const alibabaPlanProviderStrategy: LlmProviderStrategy = createStrategyFromDescriptor({
  name: 'alibaba-plan',
  label: 'Alibaba Plan',
  sdkFactory: createAlibaba,
  apiKeyEnv: 'ALIBABA_PLAN_API_KEY',
  apiKeyRequired: (provider) => `API key is required for ${provider.name}. Check Providers settings or Aider environment variables (ALIBABA_PLAN_API_KEY).`,
  fixedBaseURL: ALIBABA_PLAN_BASE_URL,
  isProvider: isAlibabaPlanProvider,
  modelsLoader: { type: 'static', apiKeyEnv: 'ALIBABA_PLAN_API_KEY', items: alibabaPlanStaticModels },
  aider: {
    prefix: 'openai',
    apiKeyEnv: 'OPENAI_API_KEY',
    sourceEnvKey: 'ALIBABA_PLAN_API_KEY',
    readEnvFallback: true,
    upstreamBaseUrl: ALIBABA_PLAN_BASE_URL,
  },
  overrides: { getProviderOptions: getAlibabaPlanProviderOptions },
});
