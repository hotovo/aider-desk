import { isNeuralwattProvider, LlmProvider } from '@common/agent';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { Model, Reasoning } from '@common/types';

import type { SharedV4ProviderOptions } from '@ai-sdk/provider';

import { LlmProviderStrategy } from '@/models';
import { createStrategyFromDescriptor } from '@/models/providers/strategy-factory';
import { mergeModelProps } from '@/models/providers/shared';

const NEURALWATT_BASE_URL = 'https://api.neuralwatt.com/v1';

interface NeuralwattModelPricing {
  input_per_million: number;
  output_per_million: number;
  cached_input_per_million?: number | null;
  cached_output_per_million?: number | null;
  currency: string;
  pricing_tbd: boolean;
}

interface NeuralwattModelCapabilities {
  tools: boolean;
  json_mode: boolean;
  vision: boolean;
  reasoning: boolean;
  reasoning_effort: boolean;
  streaming: boolean;
  system_role: boolean;
  developer_role: boolean;
}

interface NeuralwattModelLimits {
  max_context_length?: number | null;
  max_output_tokens?: number | null;
  max_images?: number | null;
}

interface NeuralwattModelMetadata {
  display_name: string;
  description?: string | null;
  provider?: string;
  pricing: NeuralwattModelPricing;
  capabilities: NeuralwattModelCapabilities;
  limits: NeuralwattModelLimits;
  deprecated?: boolean;
  deprecated_message?: string | null;
}

interface NeuralwattModelEntry {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  max_model_len?: number;
  metadata?: NeuralwattModelMetadata;
}

const neuralwattModelsMapper = (id: string, item: unknown): Partial<Model> => {
  const model = item as NeuralwattModelEntry;
  const metadata = model.metadata;
  const pricing = metadata?.pricing;
  const limits = metadata?.limits;
  const capabilities = metadata?.capabilities;

  return {
    id,
    maxInputTokens: limits?.max_context_length ?? model.max_model_len,
    maxOutputTokensLimit: limits?.max_output_tokens ?? undefined,
    inputCostPerToken: pricing ? pricing.input_per_million / 1_000_000 : undefined,
    outputCostPerToken: pricing ? pricing.output_per_million / 1_000_000 : undefined,
    cacheReadInputTokenCost: pricing?.cached_input_per_million != null ? pricing.cached_input_per_million / 1_000_000 : undefined,
    supportsTools: capabilities?.tools,
  };
};

const getNeuralwattProviderOptions = (llmProvider: LlmProvider, model: Model, reasoning?: Reasoning): SharedV4ProviderOptions | undefined => {
  if (!isNeuralwattProvider(llmProvider)) {
    return undefined;
  }

  // When the top-level reasoning parameter is set (not undefined or 'provider-default'),
  // omit reasoningEffort so the AI SDK's portable reasoning takes effect.
  if (reasoning && reasoning !== 'provider-default') {
    return undefined;
  }

  const overrides = mergeModelProps(model, llmProvider, ['reasoningEffort']);

  // Map ReasoningEffort enum to AI SDK format
  const mappedReasoningEffort =
    overrides.reasoningEffort === undefined
      ? undefined
      : (overrides.reasoningEffort.toLowerCase() as 'max' | 'xhigh' | 'high' | 'medium' | 'low' | 'minimal' | 'none');

  if (mappedReasoningEffort) {
    return {
      neuralwatt: {
        reasoningEffort: mappedReasoningEffort,
      },
    } satisfies SharedV4ProviderOptions;
  }

  return undefined;
};

export const neuralwattProviderStrategy: LlmProviderStrategy = createStrategyFromDescriptor({
  name: 'neuralwatt',
  label: 'Neuralwatt',
  sdkFactory: createOpenAICompatible,
  extraFactoryOptions: () => ({ name: 'neuralwatt' }),
  apiKeyEnv: 'NEURALWATT_API_KEY',
  fixedBaseURL: NEURALWATT_BASE_URL,
  isProvider: isNeuralwattProvider,
  modelsLoader: {
    type: 'openai-compatible',
    url: `${NEURALWATT_BASE_URL}/models`,
    noKeyDebug: 'Neuralwatt API key is required. Please set it in Providers settings or via NEURALWATT_API_KEY environment variable.',
    mapper: neuralwattModelsMapper,
  },
  aider: { prefix: 'openai', apiKeyEnv: 'OPENAI_API_KEY', upstreamBaseUrl: NEURALWATT_BASE_URL },
  overrides: { getProviderOptions: getNeuralwattProviderOptions },
});
