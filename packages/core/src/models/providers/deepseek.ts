import { Model, ProviderProfile, SettingsData } from '@aider-desk/common/types';
import { DeepseekProvider, DEFAULT_MODEL_TEMPERATURE, isDeepseekProvider } from '@aider-desk/common/agent';
import { createDeepSeek } from '@ai-sdk/deepseek';

import type { LanguageModelV2 } from '@ai-sdk/provider';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { getDefaultModelInfo, getDefaultUsageReport } from '@/models/providers/default';

export const loadDeepseekModels = async (profile: ProviderProfile, settings: SettingsData): Promise<LoadModelsResponse> => {
  if (!isDeepseekProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider as DeepseekProvider;
  const apiKey = provider.apiKey || '';
  const apiKeyEnv = getEffectiveEnvironmentVariable('DEEPSEEK_API_KEY', settings);

  if (!apiKey && !apiKeyEnv?.value) {
    return { models: [], success: false };
  }

  try {
    const response = await fetch('https://api.deepseek.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey || apiKeyEnv?.value || ''}` },
    });
    if (!response.ok) {
      const errorMsg = `DeepSeek models API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
      logger.error(errorMsg, response.status, response.statusText);
      return { models: [], success: false, error: errorMsg };
    }

    const data = await response.json();
    const models =
      data.data?.map((m: { id: string }) => {
        return {
          id: m.id,
          providerId: profile.id,
          temperature: DEFAULT_MODEL_TEMPERATURE,
        } satisfies Model;
      }) || [];

    logger.info(`Loaded ${models.length} DeepSeek models for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error loading DeepSeek models';
    logger.error('Error loading DeepSeek models:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

export const hasDeepseekEnvVars = (settings: SettingsData): boolean => {
  return !!getEffectiveEnvironmentVariable('DEEPSEEK_API_KEY', settings, undefined)?.value;
};

export const getDeepseekAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  const deepseekProvider = provider.provider as DeepseekProvider;
  const envVars: Record<string, string> = {};

  if (deepseekProvider.apiKey) {
    envVars.DEEPSEEK_API_KEY = deepseekProvider.apiKey;
  }

  return {
    modelName: `deepseek/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
export const createDeepseekLlm = (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): LanguageModelV2 => {
  const provider = profile.provider as DeepseekProvider;
  let apiKey = provider.apiKey;

  if (!apiKey) {
    const effectiveVar = getEffectiveEnvironmentVariable('DEEPSEEK_API_KEY', settings, projectDir);
    if (effectiveVar) {
      apiKey = effectiveVar.value;
      logger.debug(`Loaded DEEPSEEK_API_KEY from ${effectiveVar.source}`);
    }
  }

  if (!apiKey) {
    throw new Error('Deepseek API key is required in Providers settings or Aider environment variables (DEEPSEEK_API_KEY)');
  }

  const deepseekProvider = createDeepSeek({
    apiKey,
    headers: profile.headers,
  });
  return deepseekProvider(model.id);
};

// === Complete Strategy Implementation ===
export const deepseekProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createDeepseekLlm,
  getUsageReport: getDefaultUsageReport,

  // Model discovery functions
  loadModels: loadDeepseekModels,
  hasEnvVars: hasDeepseekEnvVars,
  getAiderMapping: getDeepseekAiderMapping,
  getModelInfo: getDefaultModelInfo,
};
