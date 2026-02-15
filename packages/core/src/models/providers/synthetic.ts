import { Model, ModelInfo, ProviderProfile, SettingsData } from '@aider-desk/common/types';
import { DEFAULT_MODEL_TEMPERATURE, isSyntheticProvider, SyntheticProvider } from '@aider-desk/common/agent';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import { getDefaultUsageReport } from './default';

import type { LanguageModelV2 } from '@ai-sdk/provider';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';

const loadSyntheticModels = async (profile: ProviderProfile, settings: SettingsData): Promise<LoadModelsResponse> => {
  if (!isSyntheticProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider as SyntheticProvider;
  const apiKey = provider.apiKey || '';

  const apiKeyEnv = getEffectiveEnvironmentVariable('SYNTHETIC_API_KEY', settings);

  const effectiveApiKey = apiKey || apiKeyEnv?.value;

  if (!effectiveApiKey) {
    return { models: [], success: false };
  }

  try {
    const response = await fetch('https://api.synthetic.new/openai/v1/models', {
      headers: { Authorization: `Bearer ${effectiveApiKey}` },
    });
    if (!response.ok) {
      const errorMsg = `Synthetic models API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
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

    logger.info(`Loaded ${models.length} Synthetic models for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error loading Synthetic models';
    logger.warn('Failed to fetch Synthetic models via API:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

const hasSyntheticEnvVars = (): boolean => false;

const getSyntheticAiderMapping = (provider: ProviderProfile, modelId: string, settings: SettingsData, projectDir: string): AiderModelMapping => {
  const syntheticProvider = provider.provider as SyntheticProvider;
  const envVars: Record<string, string> = {};

  if (syntheticProvider.apiKey) {
    envVars.OPENAI_API_KEY = syntheticProvider.apiKey;
  } else {
    const effectiveVar = getEffectiveEnvironmentVariable('SYNTHETIC_API_KEY', settings, projectDir);
    if (effectiveVar) {
      envVars.OPENAI_API_KEY = effectiveVar.value;
    }
  }

  envVars.OPENAI_API_BASE = 'https://api.synthetic.new/openai/v1';

  return {
    modelName: `openai/${modelId}`,
    environmentVariables: envVars,
  };
};

const createSyntheticLlm = (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): LanguageModelV2 => {
  const provider = profile.provider as SyntheticProvider;
  let apiKey = provider.apiKey;

  if (!apiKey) {
    const effectiveVar = getEffectiveEnvironmentVariable('SYNTHETIC_API_KEY', settings, projectDir);
    if (effectiveVar) {
      apiKey = effectiveVar.value;
      logger.debug(`Loaded SYNTHETIC_API_KEY from ${effectiveVar.source}`);
    }
  }

  if (!apiKey) {
    throw new Error(`API key is required for ${provider.name}. Check Providers settings or Aider environment variables (SYNTHETIC_API_KEY).`);
  }

  const compatibleProvider = createOpenAICompatible({
    name: provider.name,
    apiKey,
    baseURL: 'https://api.synthetic.new/openai/v1',
    headers: profile.headers,
  });
  return compatibleProvider(model.id);
};

const getSyntheticModelInfo = (_provider: ProviderProfile, modelId: string, allModelInfos: Record<string, ModelInfo>): ModelInfo | undefined => {
  const fullModelId = `synthetic/${modelId}`;
  return allModelInfos[fullModelId];
};

export const syntheticProviderStrategy: LlmProviderStrategy = {
  createLlm: createSyntheticLlm,
  getUsageReport: getDefaultUsageReport,

  loadModels: loadSyntheticModels,
  hasEnvVars: hasSyntheticEnvVars,
  getAiderMapping: getSyntheticAiderMapping,
  getModelInfo: getSyntheticModelInfo,
};
