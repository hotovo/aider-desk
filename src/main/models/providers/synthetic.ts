import { isSyntheticProvider } from '@common/agent';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import { LlmProviderStrategy } from '@/models';
import { createStrategyFromDescriptor } from '@/models/providers/strategy-factory';
import { getModelInfoByPrefix } from '@/models/providers/shared';

const SYNTHETIC_BASE_URL = 'https://api.synthetic.new/openai/v1';

export const syntheticProviderStrategy: LlmProviderStrategy = createStrategyFromDescriptor({
  name: 'synthetic',
  label: 'Synthetic',
  sdkFactory: createOpenAICompatible,
  apiKeyEnv: 'SYNTHETIC_API_KEY',
  apiKeyRequired: (provider) => `API key is required for ${provider.name}. Check Providers settings or Aider environment variables (SYNTHETIC_API_KEY).`,
  fixedBaseURL: SYNTHETIC_BASE_URL,
  extraFactoryOptions: ({ provider }) => ({ name: provider.name }),
  isProvider: isSyntheticProvider,
  modelsLoader: {
    type: 'openai-compatible',
    url: `${SYNTHETIC_BASE_URL}/models`,
    notOkLog: 'debug',
    catchLog: 'warn',
  },
  // Synthetic is only configured via provider API keys; no Aider env var is checked
  hasEnvVars: false,
  aider: {
    prefix: 'openai',
    apiKeyEnv: 'OPENAI_API_KEY',
    sourceEnvKey: 'SYNTHETIC_API_KEY',
    readEnvFallback: true,
    upstreamBaseUrl: SYNTHETIC_BASE_URL,
  },
  overrides: {
    getModelInfo: getModelInfoByPrefix('synthetic'),
  },
});
