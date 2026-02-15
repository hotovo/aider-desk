import { Model, ProviderProfile, SettingsData } from '@aider-desk/common/types';
import { DEFAULT_MODEL_TEMPERATURE, GroqProvider, isGroqProvider } from '@aider-desk/common/agent';
import { createGroq } from '@ai-sdk/groq';

import type { LanguageModelV2 } from '@ai-sdk/provider';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { getDefaultModelInfo, getDefaultUsageReport } from '@/models/providers/default';

interface GroqModel {
  id: string;
}

interface GroqApiResponse {
  data: GroqModel[];
}

export const loadGroqModels = async (profile: ProviderProfile, settings: SettingsData): Promise<LoadModelsResponse> => {
  if (!isGroqProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider;
  const apiKey = provider.apiKey || '';
  const apiKeyEnv = getEffectiveEnvironmentVariable('GROQ_API_KEY', settings);
  const effectiveApiKey = apiKey || apiKeyEnv?.value || '';

  if (!effectiveApiKey) {
    const errorMsg = 'Groq API key is required. Please set it in Providers settings or via GROQ_API_KEY environment variable.';
    logger.debug(errorMsg);
    return { models: [], success: false };
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${effectiveApiKey}` },
    });

    if (!response.ok) {
      const errorMsg = `Groq models API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
      logger.error(errorMsg, {
        status: response.status,
        statusText: response.statusText,
      });
      return { models: [], success: false, error: errorMsg };
    }

    const data: GroqApiResponse = await response.json();
    const models =
      data.data?.map((model: GroqModel) => {
        return {
          id: model.id,
          providerId: profile.id,
          temperature: DEFAULT_MODEL_TEMPERATURE,
        } satisfies Model;
      }) || [];

    logger.info(`Loaded ${models.length} Groq models for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error loading Groq models';
    logger.error('Error loading Groq models:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

export const hasGroqEnvVars = (settings: SettingsData): boolean => {
  return !!getEffectiveEnvironmentVariable('GROQ_API_KEY', settings, undefined)?.value;
};

export const getGroqAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  const groqProvider = provider.provider as GroqProvider;
  const envVars: Record<string, string> = {};

  if (groqProvider.apiKey) {
    envVars.GROQ_API_KEY = groqProvider.apiKey;
  }

  return {
    modelName: `groq/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
export const createGroqLlm = (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): LanguageModelV2 => {
  const provider = profile.provider as GroqProvider;
  let apiKey = provider.apiKey;

  if (!apiKey) {
    const effectiveVar = getEffectiveEnvironmentVariable('GROQ_API_KEY', settings, projectDir);
    if (effectiveVar) {
      apiKey = effectiveVar.value;
      logger.debug(`Loaded GROQ_API_KEY from ${effectiveVar.source}`);
    }
  }

  if (!apiKey) {
    throw new Error('Groq API key is required in Providers settings or Aider environment variables (GROQ_API_KEY)');
  }

  const groqProvider = createGroq({
    apiKey,
    headers: profile.headers,
  });
  return groqProvider(model.id);
};

// === Complete Strategy Implementation ===
export const groqProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createGroqLlm,
  getUsageReport: getDefaultUsageReport,

  // Model discovery functions
  loadModels: loadGroqModels,
  hasEnvVars: hasGroqEnvVars,
  getAiderMapping: getGroqAiderMapping,
  getModelInfo: getDefaultModelInfo,
};
