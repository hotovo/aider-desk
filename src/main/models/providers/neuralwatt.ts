import { Model, ProviderProfile, SettingsData, UsageReportData } from '@common/types';
import { isNeuralwattProvider, LlmProvider, NeuralwattProvider } from '@common/agent';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import type { LanguageModel, LanguageModelUsage } from 'ai';
import type { SharedV3ProviderOptions } from '@ai-sdk/provider';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { getDefaultModelInfo, calculateCost } from '@/models/providers/default';
import { Task } from '@/task/task';

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

const loadNeuralwattModels = async (profile: ProviderProfile, settings: SettingsData): Promise<LoadModelsResponse> => {
  if (!isNeuralwattProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider as NeuralwattProvider;
  const apiKey = provider.apiKey || '';
  const apiKeyEnv = getEffectiveEnvironmentVariable('NEURALWATT_API_KEY', settings);
  const effectiveApiKey = apiKey || apiKeyEnv?.value || '';

  if (!effectiveApiKey) {
    logger.debug('Neuralwatt API key is required. Please set it in Providers settings or via NEURALWATT_API_KEY environment variable.');
    return { models: [], success: false };
  }

  try {
    const response = await fetch(`${NEURALWATT_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${effectiveApiKey}` },
    });

    if (!response.ok) {
      const errorMsg = `Neuralwatt models API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
      logger.error(errorMsg, { status: response.status, statusText: response.statusText });
      return { models: [], success: false, error: errorMsg };
    }

    const data = await response.json();
    logger.debug(`Received response from Neuralwatt models API for profile ${profile.id}`, { data });
    const models =
      data.data?.map((model: NeuralwattModelEntry) => {
        const metadata = model.metadata;
        const pricing = metadata?.pricing;
        const limits = metadata?.limits;
        const capabilities = metadata?.capabilities;

        return {
          id: model.id,
          providerId: profile.id,
          maxInputTokens: limits?.max_context_length ?? model.max_model_len,
          maxOutputTokensLimit: limits?.max_output_tokens ?? undefined,
          inputCostPerToken: pricing ? pricing.input_per_million / 1_000_000 : undefined,
          outputCostPerToken: pricing ? pricing.output_per_million / 1_000_000 : undefined,
          cacheReadInputTokenCost: pricing?.cached_input_per_million != null ? pricing.cached_input_per_million / 1_000_000 : undefined,
          supportsTools: capabilities?.tools,
        } satisfies Model;
      }) || [];

    logger.info(`Loaded ${models.length} Neuralwatt models for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error loading Neuralwatt models';
    logger.error('Error loading Neuralwatt models:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

const hasNeuralwattEnvVars = (settings: SettingsData): boolean => {
  return !!getEffectiveEnvironmentVariable('NEURALWATT_API_KEY', settings, undefined)?.value;
};

const getNeuralwattAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  const neuralwattProvider = provider.provider as NeuralwattProvider;
  const envVars: Record<string, string> = {};

  if (neuralwattProvider.apiKey) {
    envVars.OPENAI_API_KEY = neuralwattProvider.apiKey;
  }

  envVars.OPENAI_API_BASE = NEURALWATT_BASE_URL;

  return {
    modelName: `openai/${modelId}`,
    environmentVariables: envVars,
  };
};

const createNeuralwattLlm = (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): LanguageModel => {
  const provider = profile.provider as NeuralwattProvider;
  let apiKey = provider.apiKey;

  if (!apiKey) {
    const effectiveVar = getEffectiveEnvironmentVariable('NEURALWATT_API_KEY', settings, projectDir);
    if (effectiveVar) {
      apiKey = effectiveVar.value;
      logger.debug(`Loaded NEURALWATT_API_KEY from ${effectiveVar.source}`);
    }
  }

  if (!apiKey) {
    throw new Error('Neuralwatt API key is required in Providers settings or Aider environment variables (NEURALWATT_API_KEY)');
  }

  const compatibleProvider = createOpenAICompatible({
    name: 'neuralwatt',
    apiKey,
    baseURL: NEURALWATT_BASE_URL,
    headers: profile.headers,
  });
  return compatibleProvider(model.id);
};

const getNeuralwattUsageReport = (
  task: Task,
  provider: ProviderProfile,
  model: Model,
  usage: LanguageModelUsage,
  providerMetadata?: unknown,
): UsageReportData => {
  const totalSentTokens = usage.inputTokens || 0;
  const receivedTokens = usage.outputTokens || 0;
  const cacheReadTokens = usage.inputTokenDetails?.cacheReadTokens ?? 0;
  const sentTokens = totalSentTokens - cacheReadTokens;

  logger.info('Neuralwatt usage report', {
    providerMetadata,
    usage,
  });

  const messageCost = calculateCost(model, sentTokens, receivedTokens, cacheReadTokens);

  return {
    model: `${provider.id}/${model.id}`,
    sentTokens,
    receivedTokens,
    cacheReadTokens,
    messageCost,
    agentTotalCost: task.task.agentTotalCost + messageCost,
  };
};

const getNeuralwattProviderOptions = (llmProvider: LlmProvider, model: Model): SharedV3ProviderOptions | undefined => {
  if (!isNeuralwattProvider(llmProvider)) {
    return undefined;
  }

  const neuralwattProvider = llmProvider as NeuralwattProvider;

  // Extract reasoningEffort from model overrides or provider config
  const providerOverrides = model.providerOverrides as Partial<NeuralwattProvider> | undefined;
  const reasoningEffort = providerOverrides?.reasoningEffort ?? neuralwattProvider.reasoningEffort;

  // Map ReasoningEffort enum to AI SDK format
  const mappedReasoningEffort =
    reasoningEffort === undefined ? undefined : (reasoningEffort.toLowerCase() as 'max' | 'xhigh' | 'high' | 'medium' | 'low' | 'minimal' | 'none');

  if (mappedReasoningEffort) {
    return {
      neuralwatt: {
        reasoningEffort: mappedReasoningEffort,
      },
    } satisfies SharedV3ProviderOptions;
  }

  return undefined;
};

export const neuralwattProviderStrategy: LlmProviderStrategy = {
  createLlm: createNeuralwattLlm,
  getUsageReport: getNeuralwattUsageReport,
  loadModels: loadNeuralwattModels,
  hasEnvVars: hasNeuralwattEnvVars,
  getAiderMapping: getNeuralwattAiderMapping,
  getModelInfo: getDefaultModelInfo,
  getProviderOptions: getNeuralwattProviderOptions,
};
