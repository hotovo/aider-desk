import { Model, ProviderProfile, SettingsData } from '@common/types';
import { isLmStudioProvider, LmStudioProvider } from '@common/agent';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import type { LanguageModel } from 'ai';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { getDefaultUsageReport } from '@/models/providers/default';

export const loadLmStudioModels = async (profile: ProviderProfile, settings: SettingsData): Promise<LoadModelsResponse> => {
  if (!isLmStudioProvider(profile.provider)) {
    return {
      models: [],
      success: false,
    };
  }

  const provider = profile.provider as LmStudioProvider;
  const baseUrl = provider.baseUrl || '';
  const environmentVariable = getEffectiveEnvironmentVariable('LM_STUDIO_API_BASE', settings);
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
    const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error loading LM Studio models';
    logger.error('Error loading LM Studio models:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

export const hasLmStudioEnvVars = (settings: SettingsData): boolean => {
  const base = getEffectiveEnvironmentVariable('LMSTUDIO_API_BASE', settings, undefined)?.value;
  return !!base;
};

export const getLmStudioAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
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

// === LLM Creation Functions ===
export const createLmStudioLlm = (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): LanguageModel => {
  const provider = profile.provider as LmStudioProvider;
  let baseUrl = provider.baseUrl;

  if (!baseUrl) {
    const effectiveVar = getEffectiveEnvironmentVariable('LMSTUDIO_API_BASE', settings, projectDir);
    if (effectiveVar) {
      baseUrl = effectiveVar.value;
      logger.debug(`Loaded LMSTUDIO_API_BASE from ${effectiveVar.source}`);
    }
  }

  if (!baseUrl) {
    throw new Error('Base URL is required for LMStudio provider. Set it in Providers settings or via the LMSTUDIO_API_BASE environment variable.');
  }

  const lmStudioProvider = createOpenAICompatible({
    name: 'lmstudio',
    baseURL: baseUrl,
    headers: profile.headers,
    includeUsage: true,
  });
  return lmStudioProvider(model.id);
};

// === Complete Strategy Implementation ===
export const lmStudioProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createLmStudioLlm,
  getUsageReport: getDefaultUsageReport,

  // Model discovery functions
  loadModels: loadLmStudioModels,
  hasEnvVars: hasLmStudioEnvVars,
  getAiderMapping: getLmStudioAiderMapping,
};
