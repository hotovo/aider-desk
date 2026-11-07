import { Model, ProviderProfile, SettingsData } from '@common/types';
import { isAtlasCloudProvider, AtlasCloudProvider } from '@common/agent';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import { getDefaultUsageReport } from './default';

import type { LanguageModel } from 'ai';

import { AIDER_DESK_TITLE, AIDER_DESK_WEBSITE } from '@/constants';
import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';

const ATLASCLOUD_BASE_URL = 'https://api.atlascloud.ai/v1';

const loadAtlasCloudModels = async (profile: ProviderProfile, settings: SettingsData): Promise<LoadModelsResponse> => {
  if (!isAtlasCloudProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider as AtlasCloudProvider;
  const apiKey = provider.apiKey || '';

  const apiKeyEnv = getEffectiveEnvironmentVariable('ATLASCLOUD_API_KEY', settings);

  const effectiveApiKey = apiKey || apiKeyEnv?.value;

  if (!effectiveApiKey) {
    return { models: [], success: false };
  }

  try {
    const response = await fetch(`${ATLASCLOUD_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${effectiveApiKey}` },
    });
    if (!response.ok) {
      const errorMsg = `Atlas Cloud models API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
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

    logger.info(`Loaded ${models.length} Atlas Cloud models for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error loading Atlas Cloud models';
    logger.warn('Failed to fetch Atlas Cloud models via API:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

const hasAtlasCloudEnvVars = (): boolean => false;

const getAtlasCloudAiderMapping = (provider: ProviderProfile, modelId: string, settings: SettingsData, projectDir: string): AiderModelMapping => {
  const atlasCloudProvider = provider.provider as AtlasCloudProvider;
  const envVars: Record<string, string> = {};

  if (atlasCloudProvider.apiKey) {
    envVars.OPENAI_API_KEY = atlasCloudProvider.apiKey;
  } else {
    const effectiveVar = getEffectiveEnvironmentVariable('ATLASCLOUD_API_KEY', settings, projectDir);
    if (effectiveVar) {
      envVars.OPENAI_API_KEY = effectiveVar.value;
    }
  }

  envVars.OPENAI_API_BASE = ATLASCLOUD_BASE_URL;

  return {
    modelName: `openai/${modelId}`,
    environmentVariables: envVars,
  };
};

const createAtlasCloudLlm = (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): LanguageModel => {
  const provider = profile.provider as AtlasCloudProvider;
  let apiKey = provider.apiKey;

  if (!apiKey) {
    const effectiveVar = getEffectiveEnvironmentVariable('ATLASCLOUD_API_KEY', settings, projectDir);
    if (effectiveVar) {
      apiKey = effectiveVar.value;
      logger.debug(`Loaded ATLASCLOUD_API_KEY from ${effectiveVar.source}`);
    }
  }

  if (!apiKey) {
    throw new Error(`API key is required for ${provider.name}. Check Providers settings or Aider environment variables (ATLASCLOUD_API_KEY).`);
  }

  const compatibleProvider = createOpenAICompatible({
    name: provider.name,
    apiKey,
    baseURL: ATLASCLOUD_BASE_URL,
    headers: {
      ...profile.headers,
      'HTTP-Referer': AIDER_DESK_WEBSITE,
      'X-Title': AIDER_DESK_TITLE,
    },
  });
  return compatibleProvider(model.id);
};

export const atlasCloudProviderStrategy: LlmProviderStrategy = {
  createLlm: createAtlasCloudLlm,
  getUsageReport: getDefaultUsageReport,

  loadModels: loadAtlasCloudModels,
  hasEnvVars: hasAtlasCloudEnvVars,
  getAiderMapping: getAtlasCloudAiderMapping,
};
