import { Model, ProviderProfile, ReasoningEffort, SettingsData } from '@common/types';
import { DEFAULT_MODEL_TEMPERATURE, isOpenAiCompatibleProvider, LlmProvider, OpenAiCompatibleProvider } from '@common/agent';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import type { LanguageModelV2, SharedV2ProviderOptions } from '@ai-sdk/provider';

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

  if (!(effectiveApiKey && effectiveBaseUrl)) {
    return { models: [], success: false };
  }

  try {
    const response = await fetch(`${effectiveBaseUrl}/models`, {
      headers: { Authorization: `Bearer ${effectiveApiKey}` },
    });
    if (!response.ok) {
      const errorMsg = `OpenAI-compatible models API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
      logger.debug(errorMsg);
      return { models: [], success: false, error: errorMsg };
    }

    const data = await response.json();
    const models =
      data.data?.map((model: { id: string }) => {
        return {
          id: model.id,
          providerId: profile.id,
          temperature: DEFAULT_MODEL_TEMPERATURE,
        } satisfies Model;
      }) || [];

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
const createOpenAiCompatibleLlm = (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): LanguageModelV2 => {
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

  if (!apiKey) {
    throw new Error(`API key is required for ${provider.name}. Check Providers settings or Aider environment variables (OPENAI_API_KEY).`);
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

  // Use createOpenAICompatible to get a provider instance, then get the model
  const compatibleProvider = createOpenAICompatible({
    name: provider.name,
    apiKey,
    baseURL: baseUrl,
    headers: profile.headers,
  });
  return compatibleProvider(model.id);
};

// === Configuration Helper Functions ===
const getOpenAiCompatibleProviderOptions = (provider: LlmProvider, model: Model): SharedV2ProviderOptions | undefined => {
  if (!isOpenAiCompatibleProvider(provider)) {
    return undefined;
  }

  const openAiCompatibleProvider = provider as OpenAiCompatibleProvider;

  // Extract reasoningEffort from model overrides or provider config
  const providerOverrides = model.providerOverrides as Partial<OpenAiCompatibleProvider> | undefined;
  const reasoningEffort = providerOverrides?.reasoningEffort ?? openAiCompatibleProvider.reasoningEffort;

  // Map ReasoningEffort enum to AI SDK format
  const mappedReasoningEffort =
    reasoningEffort === undefined || reasoningEffort === ReasoningEffort.None
      ? undefined
      : (reasoningEffort.toLowerCase() as 'minimal' | 'low' | 'medium' | 'high' | 'xhigh');

  if (mappedReasoningEffort) {
    logger.debug('Using reasoning effort for OpenAI Compatible:', {
      mappedReasoningEffort,
    });
    return {
      [provider.name]: {
        reasoningEffort: mappedReasoningEffort,
      },
    } satisfies SharedV2ProviderOptions;
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
