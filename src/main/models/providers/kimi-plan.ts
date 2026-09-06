import { isKimiPlanProvider } from '@common/agent';
import { createAnthropic } from '@ai-sdk/anthropic';
import { Model, ProviderProfile } from '@common/types';

import { LlmProviderStrategy } from '@/models';
import { getAnthropicCacheControl } from '@/models/providers/anthropic';
import { createStrategyFromDescriptor } from '@/models/providers/strategy-factory';
import { stripV1Suffix } from '@/models/providers/shared';

const KIMI_PLAN_BASE_URL = 'https://api.kimi.com/coding/v1';

// Kimi plan exposes a fixed model catalog (no API listing)
const kimiPlanStaticModels = (profile: ProviderProfile): Model[] => [
  {
    id: 'kimi-k2-thinking',
    providerId: profile.id,
    maxInputTokens: 262144,
    maxOutputTokensLimit: 32768,
  },
  {
    id: 'k2p5',
    providerId: profile.id,
    maxInputTokens: 262144,
    maxOutputTokensLimit: 32768,
  },
  {
    id: 'k2p6',
    providerId: profile.id,
    maxInputTokens: 262144,
    maxOutputTokensLimit: 32768,
  },
];

export const kimiPlanProviderStrategy: LlmProviderStrategy = createStrategyFromDescriptor({
  name: 'kimi-plan',
  label: 'Kimi Plan',
  // Kimi plan speaks the Anthropic wire protocol
  sdkFactory: createAnthropic,
  apiKeyEnv: 'KIMI_PLAN_API_KEY',
  apiKeyRequired: (provider) => `API key is required for ${provider.name}. Check Providers settings or Aider environment variables (KIMI_PLAN_API_KEY).`,
  fixedBaseURL: KIMI_PLAN_BASE_URL,
  isProvider: isKimiPlanProvider,
  modelsLoader: { type: 'static', apiKeyEnv: 'KIMI_PLAN_API_KEY', items: kimiPlanStaticModels },
  aider: {
    prefix: 'anthropic',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    sourceEnvKey: 'KIMI_PLAN_API_KEY',
    readEnvFallback: true,
    // remove /v1 from the end of the base url for LiteLLM compatibility
    extraEnv: { ANTHROPIC_BASE_URL: stripV1Suffix(KIMI_PLAN_BASE_URL) },
  },
  overrides: { getCacheControl: getAnthropicCacheControl },
});
