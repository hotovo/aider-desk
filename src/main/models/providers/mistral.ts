import { isMistralProvider } from '@common/agent';
import { createMistral } from '@ai-sdk/mistral';

import { LlmProviderStrategy } from '@/models';
import { createStrategyFromDescriptor } from '@/models/providers/strategy-factory';

export const mistralProviderStrategy: LlmProviderStrategy = createStrategyFromDescriptor({
  name: 'mistral',
  label: 'Mistral',
  sdkFactory: createMistral,
  apiKeyEnv: 'MISTRAL_API_KEY',
  isProvider: isMistralProvider,
  modelsLoader: {
    type: 'openai-compatible',
    url: 'https://api.mistral.ai/v1/models',
    // the Mistral API returns duplicated entries
    dedupeById: true,
    noKeyDebug: 'Mistral API key is required. Please set it in Providers settings or via MISTRAL_API_KEY environment variable.',
    mapper: (id) => ({ id, temperature: 0.7 }),
  },
  aider: { prefix: 'mistral', apiKeyEnv: 'MISTRAL_API_KEY' },
});

export const loadMistralModels = mistralProviderStrategy.loadModels;
