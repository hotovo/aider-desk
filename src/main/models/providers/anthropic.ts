import { createAnthropic } from '@ai-sdk/anthropic';
import { AnthropicProvider, isAnthropicProvider } from '@common/agent';
import { Model, ProviderProfile, SettingsData } from '@common/types';

import type { LanguageModel } from 'ai';

import logger from '@/logger';
import { AiderModelMapping, CacheControl, LlmProviderStrategy } from '@/models';
import { LoadModelsResponse } from '@/models/types';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { getDefaultModelInfo, getDefaultUsageReport } from '@/models/providers/default';

export const loadAnthropicModels = async (profile: ProviderProfile, settings: SettingsData): Promise<LoadModelsResponse> => {
  if (!isAnthropicProvider(profile.provider)) {
    return {
      models: [],
      success: false,
    };
  }

  const provider = profile.provider;
  const apiKey = provider.apiKey || '';
  const apiKeyEnv = getEffectiveEnvironmentVariable('ANTHROPIC_API_KEY', settings);

  if (!apiKey && !apiKeyEnv?.value) {
    return { models: [], success: false };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': apiKey || apiKeyEnv?.value || '',
        'anthropic-version': '2023-06-01',
      },
    });
    if (!response.ok) {
      return {
        models: [],
        success: false,
        error: `Anthropic models API response failed: ${response.status} ${response.statusText} ${await response.text()}`,
      };
    }

    const data = await response.json();
    const models =
      data.data?.map((m: { id: string }) => {
        return {
          id: m.id,
          providerId: profile.id,
        } satisfies Model;
      }) || [];

    return { models, success: true };
  } catch (error) {
    return {
      models: [],
      success: false,
      error: typeof error === 'string' ? error : error instanceof Error ? error.message : JSON.stringify(error),
    };
  }
};

export const hasAnthropicEnvVars = (settings: SettingsData): boolean => {
  return !!getEffectiveEnvironmentVariable('ANTHROPIC_API_KEY', settings, undefined)?.value;
};

export const getAnthropicAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  const anthropicProvider = provider.provider as AnthropicProvider;
  const envVars: Record<string, string> = {};

  if (anthropicProvider.apiKey) {
    envVars.ANTHROPIC_API_KEY = anthropicProvider.apiKey;
  }

  return {
    modelName: `anthropic/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
export const createAnthropicLlm = (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): LanguageModel => {
  const provider = profile.provider as AnthropicProvider;
  let apiKey = provider.apiKey;

  if (!apiKey) {
    const effectiveVar = getEffectiveEnvironmentVariable('ANTHROPIC_API_KEY', settings, projectDir);
    if (effectiveVar) {
      apiKey = effectiveVar.value;
      logger.debug(`Loaded ANTHROPIC_API_KEY from ${effectiveVar.source}`);
    }
  }

  if (!apiKey) {
    throw new Error('Anthropic API key is required in Providers settings or Aider environment variables (ANTHROPIC_API_KEY)');
  }

  const anthropicProvider = createAnthropic({
    apiKey,
    headers: profile.headers,
  });
  return anthropicProvider(model.id);
};

// === Configuration Helper Functions ===
export const getAnthropicCacheControl = (): CacheControl | undefined => {
  return {
    providerOptions: {
      anthropic: {
        cacheControl: { type: 'ephemeral' },
      },
    },
    placement: 'message',
  };
};

// === Complete Strategy Implementation ===
export const anthropicProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createAnthropicLlm,
  getUsageReport: getDefaultUsageReport,

  // Model discovery functions
  loadModels: loadAnthropicModels,
  hasEnvVars: hasAnthropicEnvVars,
  getAiderMapping: getAnthropicAiderMapping,
  getModelInfo: getDefaultModelInfo,

  // Configuration helpers
  getCacheControl: getAnthropicCacheControl,
};
