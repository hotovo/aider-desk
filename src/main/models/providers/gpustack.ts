import { GpustackProvider, isGpustackProvider } from '@common/agent';
import { Model, ProviderProfile, SettingsData } from '@common/types';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { createStrategyFromDescriptor } from '@/models/providers/strategy-factory';
import { normalizeError } from '@/models/providers/shared';

interface GpustackModelResponse {
  items: Array<{
    name: string;
    meta?: {
      max_model_len?: number;
    };
  }>;
}

export const loadGpustackModels = async (profile: ProviderProfile, settings: SettingsData): Promise<LoadModelsResponse> => {
  if (!isGpustackProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider as GpustackProvider;
  const apiKey = provider.apiKey || '';
  const baseUrl = provider.baseUrl;
  const apiKeyEnv = getEffectiveEnvironmentVariable('GPUSTACK_API_KEY', settings);
  const baseUrlEnv = getEffectiveEnvironmentVariable('GPUSTACK_API_BASE', settings);

  const effectiveApiKey = apiKey || apiKeyEnv?.value;
  const effectiveBaseUrl = baseUrl || baseUrlEnv?.value;

  if (!effectiveBaseUrl) {
    return { models: [], success: false };
  }

  try {
    const response = await fetch(`${effectiveBaseUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${effectiveApiKey}` },
    });
    if (!response.ok) {
      const errorMsg = `GPUStack models API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
      logger.debug(errorMsg);
      return { models: [], success: false, error: errorMsg };
    }

    const data = (await response.json()) as GpustackModelResponse;
    const models =
      data.items?.map((model) => {
        return {
          id: model.name,
          providerId: profile.id,
          // Extract max_model_len from meta if available
          maxInputTokens: model.meta?.max_model_len,
        } satisfies Model;
      }) || [];

    logger.info(`Loaded ${models.length} GPUStack models for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = normalizeError(error, 'Unknown error loading GPUStack models');
    logger.warn('Failed to fetch GPUStack models via API:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

// GPUStack is a second credential (baseUrl), so its Aider mapping is bespoke
const getGpustackAiderMapping = (provider: ProviderProfile, modelId: string, settings: SettingsData, projectDir: string): AiderModelMapping => {
  const gpustackProvider = provider.provider as GpustackProvider;
  const envVars: Record<string, string> = {};

  if (gpustackProvider.apiKey) {
    envVars.OPENAI_API_KEY = gpustackProvider.apiKey;
  } else {
    const effectiveVar = getEffectiveEnvironmentVariable('GPUSTACK_API_KEY', settings, projectDir);
    if (effectiveVar) {
      envVars.OPENAI_API_KEY = effectiveVar.value;
    }
  }
  if (gpustackProvider.baseUrl) {
    envVars.OPENAI_API_BASE = `${gpustackProvider.baseUrl}/v1-openai`;
  }

  // Use openai prefix for GPUStack providers (compatible with OpenAI format)
  return {
    modelName: `openai/${modelId}`,
    environmentVariables: envVars,
  };
};

export const gpustackProviderStrategy: LlmProviderStrategy = createStrategyFromDescriptor({
  name: 'gpustack',
  label: 'GPUStack',
  sdkFactory: createOpenAICompatible,
  apiKeyEnv: 'GPUSTACK_API_KEY',
  apiKeyRequired: (provider) => `API key is required for ${provider.name}. Check Providers settings or Aider environment variables (GPUSTACK_API_KEY).`,
  baseUrl: {
    envKey: 'GPUSTACK_API_BASE',
    required: (provider) =>
      `Base URL is required for ${provider.name} provider. Set it in Providers settings or via the GPUSTACK_API_BASE environment variable.`,
    // GPUStack uses /v1-openai prefix for OpenAI compatibility
    transform: (url) => `${url}/v1-openai`,
  },
  extraFactoryOptions: ({ provider }) => ({ name: provider.name }),
  isProvider: isGpustackProvider,
  hasEnvKeys: ['GPUSTACK_API_KEY', 'GPUSTACK_API_BASE'],
  overrides: { loadModels: loadGpustackModels, getAiderMapping: getGpustackAiderMapping },
});
