export type ProviderName = 'openai' | 'anthropic' | 'gemini' | 'bedrock' | 'deepseek' | 'openai-compatible' | 'ollama';

export interface LlmProviderBase {
  name: ProviderName;
  model: string;
  active: boolean;
}

export interface OllamaProvider extends LlmProviderBase {
  name: 'ollama';
  baseUrl: string;
}

export const AVAILABLE_PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'bedrock', label: 'Bedrock' },
  { value: 'deepseek', label: 'Deepseek' },
  { value: 'openai-compatible', label: 'OpenAI Compatible' },
  { value: 'ollama', label: 'Ollama' },
];

export interface OpenAiProvider extends LlmProviderBase {
  name: 'openai';
  apiKey: string;
}
export const isOpenAiProvider = (provider: LlmProviderBase): provider is OpenAiProvider => provider.name === 'openai';

export interface AnthropicProvider extends LlmProviderBase {
  name: 'anthropic';
  apiKey: string;
}
export const isAnthropicProvider = (provider: LlmProviderBase): provider is AnthropicProvider => provider.name === 'anthropic';

export interface GeminiProvider extends LlmProviderBase {
  name: 'gemini';
  apiKey: string;
}
export const isGeminiProvider = (provider: LlmProviderBase): provider is GeminiProvider => provider.name === 'gemini';

export interface DeepseekProvider extends LlmProviderBase {
  name: 'deepseek';
  apiKey: string;
}
export const isDeepseekProvider = (provider: LlmProviderBase): provider is DeepseekProvider => provider.name === 'deepseek';

export interface BedrockProvider extends LlmProviderBase {
  name: 'bedrock';
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}
export const isBedrockProvider = (provider: LlmProviderBase): provider is BedrockProvider => provider.name === 'bedrock';

export interface OpenAiCompatibleProvider extends LlmProviderBase {
  name: 'openai-compatible';
  apiKey: string;
  baseUrl?: string;
}
export const isOpenAiCompatibleProvider = (provider: LlmProviderBase): provider is OpenAiCompatibleProvider => provider.name === 'openai-compatible';

export const isOllamaProvider = (provider: LlmProviderBase): provider is OllamaProvider => provider.name === 'ollama';

export type LlmProvider = OpenAiProvider | AnthropicProvider | GeminiProvider | BedrockProvider | DeepseekProvider | OpenAiCompatibleProvider | OllamaProvider;

export const getActiveProvider = (providers: LlmProvider[]): LlmProvider | null => {
  return providers.find((provider) => provider.active) || null;
};

// prices in dollars per million tokens
export const PROVIDER_MODELS: Record<string, { models: Record<string, { inputCost: number; outputCost: number }> }> = {
  openai: {
    models: {
      'gpt-4o-mini': {
        inputCost: 0.15,
        outputCost: 0.6,
      },
      'o4-mini': {
        inputCost: 1.1,
        outputCost: 4.4,
      },
      'gpt-4.1': {
        inputCost: 2,
        outputCost: 8,
      },
      'gpt-4.1-mini': {
        inputCost: 0.4,
        outputCost: 1.6,
      },
    },
  },
  anthropic: {
    models: {
      'claude-3-7-sonnet-20250219': {
        inputCost: 3.0,
        outputCost: 15.0,
      },
      'claude-3-5-haiku-20241022': {
        inputCost: 0.8,
        outputCost: 4.0,
      },
    },
  },
  gemini: {
    models: {
      'gemini-2.5-pro-exp-03-25': {
        inputCost: 0,
        outputCost: 0,
      },
      'gemini-2.5-pro-preview-03-25': {
        inputCost: 1.25,
        outputCost: 10,
      },
      'gemini-2.0-flash': {
        inputCost: 0.1,
        outputCost: 0.4,
      },
      'gemini-2.5-flash-preview-04-17': {
        inputCost: 0.15,
        outputCost: 0.6,
      },
      'gemini-2.0-flash-exp': {
        inputCost: 0,
        outputCost: 0,
      },
    },
  },
  deepseek: {
    models: {
      'deepseek-chat': {
        inputCost: 0.27,
        outputCost: 1.1,
      },
    },
  },
  bedrock: {
    models: {
      'us.anthropic.claude-3-7-sonnet-20250219-v1:0': {
        inputCost: 3.0,
        outputCost: 15.0,
      },
      'anthropic.claude-3-7-sonnet-20250219-v1:0': {
        inputCost: 3.0,
        outputCost: 15.0,
      },
    },
  },
};
