import { isDeepseekProvider, LlmProvider } from '@common/agent';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { Model, Reasoning } from '@common/types';

import type { SharedV4ProviderOptions } from '@ai-sdk/provider';

import { LlmProviderStrategy } from '@/models';
import { createStrategyFromDescriptor } from '@/models/providers/strategy-factory';
import { mergeModelProps } from '@/models/providers/shared';

export const getDeepseekProviderOptions = (llmProvider: LlmProvider, model: Model, reasoning?: Reasoning): SharedV4ProviderOptions | undefined => {
  if (!isDeepseekProvider(llmProvider)) {
    return undefined;
  }

  // When the top-level reasoning parameter is set (not undefined or 'provider-default'),
  // let the AI SDK handle it. For 'none', explicitly disable thinking.
  if (reasoning && reasoning !== 'provider-default') {
    if (reasoning === 'none') {
      return {
        deepseek: {
          thinking: { type: 'disabled' },
        },
      };
    }
    return undefined;
  }

  const overrides = mergeModelProps(model, llmProvider, ['thinkingEnabled', 'reasoningEffort']);
  const thinkingEnabled = overrides.thinkingEnabled ?? true;
  const reasoningEffort = overrides.reasoningEffort ?? 'high';

  return {
    deepseek: {
      thinking: { type: thinkingEnabled ? 'enabled' : 'disabled' },
      ...(thinkingEnabled && { reasoningEffort }),
    },
  };
};

const getDeepseekProviderParameters = (llmProvider: LlmProvider, model: Model, reasoning?: Reasoning): Record<string, unknown> => {
  if (!isDeepseekProvider(llmProvider)) {
    return {};
  }

  const overrides = mergeModelProps(model, llmProvider, ['thinkingEnabled']);
  const configuredThinkingEnabled = overrides.thinkingEnabled ?? true;
  const thinkingEnabled = reasoning && reasoning !== 'provider-default' ? reasoning !== 'none' : configuredThinkingEnabled;

  if (thinkingEnabled) {
    return {
      temperature: undefined,
      topP: undefined,
    };
  }

  return {};
};

export const deepseekProviderStrategy: LlmProviderStrategy = createStrategyFromDescriptor({
  name: 'deepseek',
  // error message spells the name without the internal 'DeepSeek' casing
  label: 'DeepSeek',
  sdkFactory: createDeepSeek,
  apiKeyEnv: 'DEEPSEEK_API_KEY',
  apiKeyRequired: 'Deepseek API key is required in Providers settings or Aider environment variables (DEEPSEEK_API_KEY)',
  isProvider: isDeepseekProvider,
  modelsLoader: {
    type: 'openai-compatible',
    url: 'https://api.deepseek.com/v1/models',
  },
  aider: { prefix: 'deepseek', apiKeyEnv: 'DEEPSEEK_API_KEY' },
  overrides: {
    getProviderOptions: getDeepseekProviderOptions,
    getProviderParameters: getDeepseekProviderParameters,
  },
});

export const loadDeepseekModels = deepseekProviderStrategy.loadModels;
