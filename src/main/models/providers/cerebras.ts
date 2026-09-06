import { isCerebrasProvider } from '@common/agent';
import { createCerebras } from '@ai-sdk/cerebras';

import { LlmProviderStrategy } from '@/models';
import { createStrategyFromDescriptor } from '@/models/providers/strategy-factory';

export const cerebrasProviderStrategy: LlmProviderStrategy = createStrategyFromDescriptor({
  name: 'cerebras',
  label: 'Cerebras',
  sdkFactory: createCerebras,
  apiKeyEnv: 'CEREBRAS_API_KEY',
  isProvider: isCerebrasProvider,
  modelsLoader: {
    type: 'openai-compatible',
    url: 'https://api.cerebras.ai/v1/models',
    noKeyDebug: 'Cerebras API key is required. Please set it in Providers settings or via CEREBRAS_API_KEY environment variable.',
    mapper: (id, item) => ({
      id,
      maxInputTokens: (item as { max_context_length?: number }).max_context_length,
    }),
  },
  aider: { prefix: 'cerebras', apiKeyEnv: 'CEREBRAS_API_KEY' },
});

export const loadCerebrasModels = cerebrasProviderStrategy.loadModels;
