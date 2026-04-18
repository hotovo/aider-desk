import { Model, ProviderProfile, SettingsData } from '@common/types';
import { DEFAULT_MODEL_TEMPERATURE, MistralProvider, isMistralProvider } from '@common/agent';
import { createMistral } from '@ai-sdk/mistral';

import type { LanguageModelV2 } from '@ai-sdk/provider';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { getDefaultModelInfo, getDefaultUsageReport } from '@/models/providers/default';

interface MistralModel {
  id: string;
}

interface MistralApiResponse {
  data: MistralModel[];
}

export const loadMistralModels = async (profile: ProviderProfile, settings: SettingsData): Promise<LoadModelsResponse> => {
  if (!isMistralProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider;
  const apiKey = provider.apiKey || '';
  const apiKeyEnv = getEffectiveEnvironmentVariable('MISTRAL_API_KEY', settings);
  const effectiveApiKey = apiKey || apiKeyEnv?.value || '';

  if (!effectiveApiKey) {
    const errorMsg = 'Mistral API key is required. Please set it in Providers settings or via MISTRAL_API_KEY environment variable.';
    logger.debug(errorMsg);
    return { models: [], success: false };
  }

  try {
    const response = await fetch('https://api.mistral.ai/v1/models', {
      headers: { Authorization: `Bearer ${effectiveApiKey}` },
    });

    if (!response.ok) {
      const errorMsg = `Mistral models API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
      logger.error(errorMsg, {
        status: response.status,
        statusText: response.statusText,
      });
      return { models: [], success: false, error: errorMsg };
    }

    const data: MistralApiResponse = await response.json();
    const models =
      data.data?.map((model: MistralModel) => {
        return {
          id: model.id,
          providerId: profile.id,
          temperature: DEFAULT_MODEL_TEMPERATURE,
        } satisfies Model;
      }) || [];

    logger.info(`Loaded ${models.length} Mistral models for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error loading Mistral models';
    logger.error('Error loading Mistral models:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

export const hasMistralEnvVars = (settings: SettingsData): boolean => {
  return !!getEffectiveEnvironmentVariable('MISTRAL_API_KEY', settings, undefined)?.value;
};

export const getMistralAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  const mistralProvider = provider.provider as MistralProvider;
  const envVars: Record<string, string> = {};

  if (mistralProvider.apiKey) {
    envVars.MISTRAL_API_KEY = mistralProvider.apiKey;
  }

  return {
    modelName: `mistral/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
export const createMistralLlm = (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): LanguageModelV2 => {
  const provider = profile.provider as MistralProvider;
  let apiKey = provider.apiKey;

  if (!apiKey) {
    const effectiveVar = getEffectiveEnvironmentVariable('MISTRAL_API_KEY', settings, projectDir);
    if (effectiveVar) {
      apiKey = effectiveVar.value;
      logger.debug(`Loaded MISTRAL_API_KEY from ${effectiveVar.source}`);
    }
  }

  if (!apiKey) {
    throw new Error('Mistral API key is required in Providers settings or Aider environment variables (MISTRAL_API_KEY)');
  }

  const mistralProvider = createMistral({
    apiKey,
    headers: profile.headers,
  });
  return mistralProvider(model.id);
};

// === Complete Strategy Implementation ===
export const mistralProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createMistralLlm,
  getUsageReport: getDefaultUsageReport,

  // Model discovery functions
  loadModels: loadMistralModels,
  hasEnvVars: hasMistralEnvVars,
  getAiderMapping: getMistralAiderMapping,
  getModelInfo: getDefaultModelInfo,
};
