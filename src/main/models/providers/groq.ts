import { isGroqProvider } from '@common/agent';
import { createGroq } from '@ai-sdk/groq';

import { LlmProviderStrategy } from '@/models';
import { createStrategyFromDescriptor } from '@/models/providers/strategy-factory';

export const groqProviderStrategy: LlmProviderStrategy = createStrategyFromDescriptor({
  name: 'groq',
  label: 'Groq',
  sdkFactory: createGroq,
  apiKeyEnv: 'GROQ_API_KEY',
  isProvider: isGroqProvider,
  modelsLoader: {
    type: 'openai-compatible',
    url: 'https://api.groq.com/openai/v1/models',
    noKeyDebug: 'Groq API key is required. Please set it in Providers settings or via GROQ_API_KEY environment variable.',
  },
  aider: { prefix: 'groq', apiKeyEnv: 'GROQ_API_KEY' },
});

export const loadGroqModels = groqProviderStrategy.loadModels;
