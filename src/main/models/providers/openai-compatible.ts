import { Model, ProviderProfile, ReasoningEffort, SettingsData } from '@common/types';
import { isOpenAiCompatibleProvider, LlmProvider, OpenAiCompatibleProvider } from '@common/agent';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import type { JSONValue, SharedV4ProviderOptions } from '@ai-sdk/provider';
import type { LanguageModel } from 'ai';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { getDefaultUsageReport } from '@/models/providers/default';

const loadOpenaiCompatibleModels = async (profile: ProviderProfile, settings: SettingsData): Promise<LoadModelsResponse> => {
  if (!isOpenAiCompatibleProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider as OpenAiCompatibleProvider;
  const apiKey = provider.apiKey || '';
  const baseUrl = provider.baseUrl;

  const apiKeyEnv = getEffectiveEnvironmentVariable('OPENAI_API_KEY', settings);
  const baseUrlEnv = getEffectiveEnvironmentVariable('OPENAI_API_BASE', settings);

  const effectiveApiKey = apiKey || apiKeyEnv?.value;
  const effectiveBaseUrl = baseUrl || baseUrlEnv?.value;

  if (!effectiveBaseUrl) {
    return { models: [], success: false };
  }

  try {
    const response = await fetch(
      `${effectiveBaseUrl}/models`,
      effectiveApiKey
        ? {
            headers: { Authorization: `Bearer ${effectiveApiKey}` },
          }
        : {},
    );
    if (!response.ok) {
      const errorMsg = `OpenAI-compatible models API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
      logger.debug(errorMsg);
      return { models: [], success: false, error: errorMsg };
    }

    const data = await response.json();
    const models =
      data.data?.map(
        (model: {
          id: string;
          max_model_len?: number;
          context_length?: number;
          num_ctx?: number;
          context_window?: number;
          max_completion_tokens?: number;
          max_tokens?: number;
        }) => {
          const maxInputTokens = model.max_model_len ?? model.context_length ?? model.num_ctx ?? model.context_window;
          const maxOutputTokensLimit = model.max_completion_tokens ?? model.max_tokens;

          return {
            id: model.id,
            providerId: profile.id,
            ...(maxInputTokens != null && { maxInputTokens }),
            ...(maxOutputTokensLimit != null && { maxOutputTokensLimit }),
          } satisfies Model;
        },
      ) || [];

    logger.info(`Loaded ${models.length} OpenAI-compatible models for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error loading OpenAI-compatible models';
    logger.warn('Failed to fetch OpenAI-compatible models via API:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

const hasOpenAiCompatibleEnvVars = (settings: SettingsData): boolean => {
  const hasApiKey = !!getEffectiveEnvironmentVariable('OPENAI_API_KEY', settings, undefined)?.value;
  const hasBaseUrl = !!getEffectiveEnvironmentVariable('OPENAI_API_BASE', settings, undefined)?.value;
  return hasApiKey || hasBaseUrl;
};

const getOpenAiCompatibleAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  const compatibleProvider = provider.provider as OpenAiCompatibleProvider;
  const envVars: Record<string, string> = {};

  if (compatibleProvider.apiKey) {
    envVars.OPENAI_API_KEY = compatibleProvider.apiKey;
  }
  if (compatibleProvider.baseUrl) {
    envVars.OPENAI_API_BASE = compatibleProvider.baseUrl;
  }

  // Use openai prefix for OpenAI-compatible providers
  return {
    modelName: `openai/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
const createOpenAiCompatibleLlm = (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): LanguageModel => {
  const provider = profile.provider as OpenAiCompatibleProvider;
  let apiKey = provider.apiKey;
  let baseUrl = provider.baseUrl;

  if (!apiKey) {
    const effectiveVar = getEffectiveEnvironmentVariable('OPENAI_API_KEY', settings, projectDir);
    if (effectiveVar) {
      apiKey = effectiveVar.value;
      logger.debug(`Loaded OPENAI_API_KEY from ${effectiveVar.source}`);
    }
  }

  if (!baseUrl) {
    const effectiveVar = getEffectiveEnvironmentVariable('OPENAI_API_BASE', settings, projectDir);
    if (effectiveVar) {
      baseUrl = effectiveVar.value;
      logger.debug(`Loaded OPENAI_API_BASE from ${effectiveVar.source}`);
    }
  }

  if (!baseUrl) {
    throw new Error(`Base URL is required for ${provider.name} provider. Set it in Providers settings or via the OPENAI_API_BASE environment variable.`);
  }

  const providerOverrides = model.providerOverrides as Partial<OpenAiCompatibleProvider> | undefined;
  const trackTokenUsage = providerOverrides?.trackTokenUsage ?? provider.trackTokenUsage;

  // Use createOpenAICompatible to get a provider instance, then get the model
  const compatibleProvider = createOpenAICompatible({
    name: provider.name,
    apiKey,
    baseURL: baseUrl,
    headers: profile.headers,
    includeUsage: trackTokenUsage !== false,
  });
  return compatibleProvider(model.id);
};

// === Configuration Helper Functions ===
const getOpenAiCompatibleProviderOptions = (provider: LlmProvider, model: Model): SharedV4ProviderOptions | undefined => {
  if (!isOpenAiCompatibleProvider(provider)) {
    return undefined;
  }

  const openAiCompatibleProvider = provider as OpenAiCompatibleProvider;

  // Extract reasoningEffort from model overrides or provider config
  const providerOverrides = model.providerOverrides as Partial<OpenAiCompatibleProvider> | undefined;
  const reasoningEffort = providerOverrides?.reasoningEffort ?? openAiCompatibleProvider.reasoningEffort;
  const extraBody = providerOverrides?.extraBody ?? openAiCompatibleProvider.extraBody;

  // Map ReasoningEffort enum to AI SDK format
  const mappedReasoningEffort =
    reasoningEffort === undefined || reasoningEffort === ReasoningEffort.None
      ? undefined
      : (reasoningEffort.toLowerCase() as 'max' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh');

  const providerOptions: Record<string, JSONValue> = {};

  if (mappedReasoningEffort) {
    providerOptions.reasoningEffort = mappedReasoningEffort;
  }

  if (extraBody) {
    Object.assign(providerOptions, extraBody);
  }

  if (Object.keys(providerOptions).length > 0) {
    logger.debug('Using provider options for OpenAI Compatible:', {
      mappedReasoningEffort,
      hasExtraBody: !!extraBody,
    });
    return {
      [provider.name]: providerOptions,
    } satisfies SharedV4ProviderOptions;
  }

  return undefined;
};

// === Complete Strategy Implementation ===
export const openaiCompatibleProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createOpenAiCompatibleLlm,
  getUsageReport: getDefaultUsageReport,

  // Model discovery functions
  loadModels: loadOpenaiCompatibleModels,
  hasEnvVars: hasOpenAiCompatibleEnvVars,
  getAiderMapping: getOpenAiCompatibleAiderMapping,

  // Configuration helper functions
  getProviderOptions: getOpenAiCompatibleProviderOptions,
};
