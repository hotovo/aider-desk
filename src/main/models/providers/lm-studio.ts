import { isLmStudioProvider, LmStudioProvider } from '@common/agent';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { Model, ProviderProfile, SettingsData } from '@common/types';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { createStrategyFromDescriptor } from '@/models/providers/strategy-factory';
import { normalizeError } from '@/models/providers/shared';

export const loadLmStudioModels = async (profile: ProviderProfile, settings: SettingsData): Promise<LoadModelsResponse> => {
  if (!isLmStudioProvider(profile.provider)) {
    return {
      models: [],
      success: false,
    };
  }

  const provider = profile.provider as LmStudioProvider;
  const baseUrl = provider.baseUrl || '';
  // LMSTUDIO_API_BASE (no underscore between LM and STUDIO) is the spelling already used by
  // createLlm, hasEnvVars and the renderer's LmStudioParameters component.
  const environmentVariable = getEffectiveEnvironmentVariable('LMSTUDIO_API_BASE', settings);
  const effectiveBaseUrl = baseUrl || environmentVariable?.value || '';

  if (!effectiveBaseUrl) {
    return { models: [], success: false };
  }

  try {
    const normalized = effectiveBaseUrl.replace(/\/+$/g, ''); // Remove all trailing slashes
    const response = await fetch(`${normalized}/models`);
    if (!response.ok) {
      const errorMsg = `LM Studio models API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
      logger.warn(errorMsg);
      return { models: [], success: false, error: errorMsg };
    }

    const data = await response.json();
    const models =
      data?.data?.map((model: { id: string; max_context_length: number }) => {
        return {
          id: model.id,
          providerId: profile.id,
          maxInputTokens: model.max_context_length,
        } satisfies Model;
      }) || [];
    logger.info(`Loaded ${models.length} LM Studio models from ${effectiveBaseUrl} for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = normalizeError(error, 'Unknown error loading LM Studio models');
    logger.error('Error loading LM Studio models:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

const getLmStudioAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  const lmstudioProvider = provider.provider as LmStudioProvider;
  const envVars: Record<string, string> = {};

  if (lmstudioProvider.baseUrl) {
    envVars.LM_STUDIO_API_BASE = lmstudioProvider.baseUrl;
    envVars.LM_STUDIO_API_KEY = 'dummy-api-key';
  }

  return {
    modelName: `lm_studio/${modelId}`,
    environmentVariables: envVars,
  };
};

// LM Studio is local-only (base URL, no credential), so loadModels/mapping stay bespoke
export const lmStudioProviderStrategy: LlmProviderStrategy = createStrategyFromDescriptor({
  name: 'lmstudio',
  label: 'LM Studio',
  sdkFactory: createOpenAICompatible,
  extraFactoryOptions: () => ({ name: 'lmstudio', includeUsage: true }),
  baseUrl: {
    envKey: 'LMSTUDIO_API_BASE',
    required: 'Base URL is required for LMStudio provider. Set it in Providers settings or via the LMSTUDIO_API_BASE environment variable.',
  },
  isProvider: isLmStudioProvider,
  hasEnvKeys: ['LMSTUDIO_API_BASE'],
  overrides: { loadModels: loadLmStudioModels, getAiderMapping: getLmStudioAiderMapping },
});
