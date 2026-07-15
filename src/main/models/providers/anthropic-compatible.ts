import { Model, ProviderProfile, SettingsData } from '@common/types';
import { isAnthropicCompatibleProvider, AnthropicCompatibleProvider } from '@common/agent';
import { createAnthropic } from '@ai-sdk/anthropic';

import type { LanguageModel } from 'ai';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { getAnthropicCacheControl } from '@/models/providers/anthropic';
import { getDefaultUsageReport } from '@/models/providers/default';

const ensureV1Suffix = (baseUrl: string): string => {
  return baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
};

const loadAnthropicCompatibleModels = async (profile: ProviderProfile, settings: SettingsData): Promise<LoadModelsResponse> => {
  if (!isAnthropicCompatibleProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider as AnthropicCompatibleProvider;
  const apiKey = provider.apiKey || '';
  const baseUrl = provider.baseUrl;

  const apiKeyEnv = getEffectiveEnvironmentVariable('ANTHROPIC_API_KEY', settings);
  const baseUrlEnv = getEffectiveEnvironmentVariable('ANTHROPIC_API_BASE', settings);

  const effectiveApiKey = apiKey || apiKeyEnv?.value;
  const effectiveBaseUrl = baseUrl || baseUrlEnv?.value;

  if (!(effectiveApiKey && effectiveBaseUrl)) {
    return { models: [], success: false };
  }

  try {
    const response = await fetch(`${ensureV1Suffix(effectiveBaseUrl)}/models`, {
      headers: {
        'x-api-key': effectiveApiKey,
        'anthropic-version': '2023-06-01',
      },
    });
    if (!response.ok) {
      const errorMsg = `Anthropic-compatible models API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
      logger.debug(errorMsg);
      return { models: [], success: false, error: errorMsg };
    }

    const data = await response.json();
    const models =
      data.data?.map((model: { id: string }) => {
        return {
          id: model.id,
          providerId: profile.id,
        } satisfies Model;
      }) || [];

    logger.info(`Loaded ${models.length} Anthropic-compatible models for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error loading Anthropic-compatible models';
    logger.warn('Failed to fetch Anthropic-compatible models via API:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

const hasAnthropicCompatibleEnvVars = (settings: SettingsData): boolean => {
  const hasApiKey = !!getEffectiveEnvironmentVariable('ANTHROPIC_API_KEY', settings, undefined)?.value;
  const hasBaseUrl = !!getEffectiveEnvironmentVariable('ANTHROPIC_API_BASE', settings, undefined)?.value;
  return hasApiKey || hasBaseUrl;
};

const getAnthropicCompatibleAiderMapping = (provider: ProviderProfile, modelId: string, settings: SettingsData, projectDir: string): AiderModelMapping => {
  const compatibleProvider = provider.provider as AnthropicCompatibleProvider;
  const envVars: Record<string, string> = {};

  let apiKey = compatibleProvider.apiKey;
  let baseUrl = compatibleProvider.baseUrl;

  if (!apiKey) {
    const effectiveVar = getEffectiveEnvironmentVariable('ANTHROPIC_API_KEY', settings, projectDir);
    if (effectiveVar) {
      apiKey = effectiveVar.value;
    }
  }

  if (!baseUrl) {
    const effectiveVar = getEffectiveEnvironmentVariable('ANTHROPIC_API_BASE', settings, projectDir);
    if (effectiveVar) {
      baseUrl = effectiveVar.value;
    }
  }

  if (apiKey) {
    envVars.ANTHROPIC_API_KEY = apiKey;
  }
  if (baseUrl) {
    envVars.ANTHROPIC_BASE_URL = baseUrl.endsWith('/v1') ? baseUrl.slice(0, -3) : baseUrl;
  }

  // Use anthropic prefix for Anthropic-compatible providers
  return {
    modelName: `anthropic/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
const createAnthropicCompatibleLlm = (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): LanguageModel => {
  const provider = profile.provider as AnthropicCompatibleProvider;
  let apiKey = provider.apiKey;
  let baseUrl = provider.baseUrl;

  if (!apiKey) {
    const effectiveVar = getEffectiveEnvironmentVariable('ANTHROPIC_API_KEY', settings, projectDir);
    if (effectiveVar) {
      apiKey = effectiveVar.value;
      logger.debug(`Loaded ANTHROPIC_API_KEY from ${effectiveVar.source}`);
    }
  }

  if (!apiKey) {
    throw new Error(`API key is required for ${provider.name}. Check Providers settings or Aider environment variables (ANTHROPIC_API_KEY).`);
  }

  if (!baseUrl) {
    const effectiveVar = getEffectiveEnvironmentVariable('ANTHROPIC_API_BASE', settings, projectDir);
    if (effectiveVar) {
      baseUrl = effectiveVar.value;
      logger.debug(`Loaded ANTHROPIC_API_BASE from ${effectiveVar.source}`);
    }
  }

  if (!baseUrl) {
    throw new Error(`Base URL is required for ${provider.name} provider. Set it in Providers settings or via the ANTHROPIC_API_BASE environment variable.`);
  }

  // Use createAnthropic with custom baseURL to get a provider instance, then get the model.
  // The @ai-sdk/anthropic SDK only appends `/messages` to the baseURL, so it must include `/v1`.
  const anthropicProvider = createAnthropic({
    apiKey,
    baseURL: ensureV1Suffix(baseUrl),
    headers: profile.headers,
  });
  return anthropicProvider(model.id);
};

// === Complete Strategy Implementation ===
export const anthropicCompatibleProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createAnthropicCompatibleLlm,
  getUsageReport: getDefaultUsageReport,

  // Model discovery functions
  loadModels: loadAnthropicCompatibleModels,
  hasEnvVars: hasAnthropicCompatibleEnvVars,
  getAiderMapping: getAnthropicCompatibleAiderMapping,

  // Cache control
  getCacheControl: getAnthropicCacheControl,
};
