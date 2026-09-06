import { isZaiPlanProvider, LlmProvider } from '@common/agent';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { Model, Reasoning, ReasoningEffort } from '@common/types';

import type { SharedV4ProviderOptions } from '@ai-sdk/provider';

import { LlmProviderStrategy } from '@/models';
import { createStrategyFromDescriptor } from '@/models/providers/strategy-factory';
import { getModelInfoByPrefix, mergeModelProps } from '@/models/providers/shared';

const ZAI_PLAN_BASE_URL = 'https://api.z.ai/api/coding/paas/v4';

const getZaiPlanProviderOptions = (llmProvider: LlmProvider, model: Model, reasoning?: Reasoning): SharedV4ProviderOptions | undefined => {
  if (!isZaiPlanProvider(llmProvider)) {
    return undefined;
  }

  const overrides = mergeModelProps(model, llmProvider, ['thinkingEnabled', 'reasoningEffort', 'disableToolCallStreaming']);
  const thinkingEnabled = overrides.thinkingEnabled ?? true;
  const reasoningEffort = overrides.reasoningEffort ?? ReasoningEffort.Max;
  const toolCallStreamingDisabled = overrides.disableToolCallStreaming ?? false;

  const toolStreamOption = toolCallStreamingDisabled ? {} : { tool_stream: true };

  // When the top-level reasoning parameter is set (not undefined or 'provider-default'),
  // omit thinking and reasoningEffort so the AI SDK's portable reasoning takes effect.
  // For 'none', explicitly disable thinking. Keep tool_stream if set.
  if (reasoning && reasoning !== 'provider-default') {
    if (reasoning === 'none') {
      return {
        zaiPlan: {
          thinking: { type: 'disabled' },
          ...toolStreamOption,
        },
      } as SharedV4ProviderOptions;
    }
    if (Object.keys(toolStreamOption).length > 0) {
      return {
        zaiPlan: toolStreamOption,
      } as SharedV4ProviderOptions;
    }
    return undefined;
  }

  // Only disable thinking if explicitly set to false
  if (thinkingEnabled === false) {
    return {
      zaiPlan: {
        thinking: {
          type: 'disabled',
        },
        ...toolStreamOption,
      },
    } as SharedV4ProviderOptions;
  }

  const mappedReasoningEffort = reasoningEffort === ReasoningEffort.None ? undefined : (reasoningEffort.toLowerCase() as 'max' | 'high');

  if (mappedReasoningEffort) {
    return {
      zaiPlan: {
        reasoningEffort: mappedReasoningEffort,
        ...toolStreamOption,
      },
    } as SharedV4ProviderOptions;
  }

  if (Object.keys(toolStreamOption).length > 0) {
    return {
      zaiPlan: toolStreamOption,
    } as SharedV4ProviderOptions;
  }

  return undefined;
};

export const zaiPlanProviderStrategy: LlmProviderStrategy = createStrategyFromDescriptor({
  name: 'zai-plan',
  label: 'ZAI Plan',
  sdkFactory: createOpenAICompatible,
  apiKeyEnv: 'ZAI_API_KEY',
  apiKeyRequired: (provider) => `API key is required for ${provider.name}. Check Providers settings or Aider environment variables (ZAI_API_KEY).`,
  fixedBaseURL: ZAI_PLAN_BASE_URL,
  extraFactoryOptions: ({ provider }) => ({ name: provider.name }),
  isProvider: isZaiPlanProvider,
  modelsLoader: {
    type: 'openai-compatible',
    // ZAI uses a specific endpoint (api/paas) for model discovery, different from chats (api/coding)
    url: 'https://api.z.ai/api/paas/v4/models',
    notOkLog: 'debug',
    catchLog: 'warn',
    mapper: (id) => ({ id, temperature: 0.7 }),
  },
  // only configured via provider API keys; no Aider env var is checked
  hasEnvVars: false,
  aider: {
    prefix: 'openai',
    apiKeyEnv: 'OPENAI_API_KEY',
    sourceEnvKey: 'ZAI_API_KEY',
    readEnvFallback: true,
    upstreamBaseUrl: ZAI_PLAN_BASE_URL,
  },
  overrides: {
    getModelInfo: getModelInfoByPrefix('zai-coding-plan'),
    getProviderOptions: getZaiPlanProviderOptions,
  },
});
