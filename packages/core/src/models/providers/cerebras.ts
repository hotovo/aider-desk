import { Model, ProviderProfile, SettingsData } from '@aider-desk/common/types';
import { CerebrasProvider, DEFAULT_MODEL_TEMPERATURE, isCerebrasProvider } from '@aider-desk/common/agent';
import { createCerebras } from '@ai-sdk/cerebras';

import type { LanguageModelV2 } from '@ai-sdk/provider';

import { AiderModelMapping, LlmProviderStrategy } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils/environment';
import { LoadModelsResponse } from '@/models/types';
import { getDefaultModelInfo, getDefaultUsageReport } from '@/models/providers/default';

interface CerebrasModel {
  id: string;
  max_context_length?: number;
  description?: string;
}

export const loadCerebrasModels = async (profile: ProviderProfile, settings: SettingsData): Promise<LoadModelsResponse> => {
  if (!isCerebrasProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider;
  const apiKey = provider.apiKey || '';
  const apiKeyEnv = getEffectiveEnvironmentVariable('CEREBRAS_API_KEY', settings);
  const effectiveApiKey = apiKey || apiKeyEnv?.value || '';

  if (!effectiveApiKey) {
    logger.debug('Cerebras API key is required. Please set it in Providers settings or via CEREBRAS_API_KEY environment variable.');
    return { models: [], success: false };
  }

  try {
    const response = await fetch('https://api.cerebras.ai/v1/models', {
      headers: { Authorization: `Bearer ${effectiveApiKey}` },
    });

    if (!response.ok) {
      const errorMsg = `Cerebras models API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
      logger.error(errorMsg, {
        status: response.status,
        statusText: response.statusText,
      });
      return { models: [], success: false, error: errorMsg };
    }

    const data = await response.json();
    const models =
      data.data?.map((model: CerebrasModel) => {
        return {
          id: model.id,
          providerId: profile.id,
          maxInputTokens: model.max_context_length,
          temperature: DEFAULT_MODEL_TEMPERATURE,
        } satisfies Model;
      }) || [];

    logger.info(`Loaded ${models.length} Cerebras models for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error loading Cerebras models';
    logger.error('Error loading Cerebras models:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

export const hasCerebrasEnvVars = (settings: SettingsData): boolean => {
  return !!getEffectiveEnvironmentVariable('CEREBRAS_API_KEY', settings, undefined)?.value;
};

export const getCerebrasAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  const cerebrasProvider = provider.provider as CerebrasProvider;
  const envVars: Record<string, string> = {};

  if (cerebrasProvider.apiKey) {
    envVars.CEREBRAS_API_KEY = cerebrasProvider.apiKey;
  }

  return {
    modelName: `cerebras/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
export const createCerebrasLlm = (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): LanguageModelV2 => {
  const provider = profile.provider as CerebrasProvider;
  let apiKey = provider.apiKey;

  if (!apiKey) {
    const effectiveVar = getEffectiveEnvironmentVariable('CEREBRAS_API_KEY', settings, projectDir);
    if (effectiveVar) {
      apiKey = effectiveVar.value;
      logger.debug(`Loaded CEREBRAS_API_KEY from ${effectiveVar.source}`);
    }
  }

  if (!apiKey) {
    throw new Error('Cerebras API key is required in Providers settings or Aider environment variables (CEREBRAS_API_KEY)');
  }

  const cerebrasProvider = createCerebras({
    apiKey,
    headers: profile.headers,
  });
  return cerebrasProvider(model.id);
};

// === Complete Strategy Implementation ===
export const cerebrasProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createCerebrasLlm,
  getUsageReport: getDefaultUsageReport,

  // Model discovery functions
  loadModels: loadCerebrasModels,
  hasEnvVars: hasCerebrasEnvVars,
  getAiderMapping: getCerebrasAiderMapping,
  getModelInfo: getDefaultModelInfo,
};
