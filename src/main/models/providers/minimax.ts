import { createAnthropic } from '@ai-sdk/anthropic';
import { isMinimaxProvider, MinimaxProvider, LlmProvider } from '@common/agent';
import { Model, ProviderProfile, SettingsData } from '@common/types';

import type { LanguageModel } from 'ai';
import type { SharedV4ProviderOptions } from '@ai-sdk/provider';

import logger from '@/logger';
import { AiderModelMapping, CacheControl, LlmProviderStrategy } from '@/models';
import { LoadModelsResponse } from '@/models/types';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { getDefaultUsageReport } from '@/models/providers/default';

export const loadMinimaxModels = async (profile: ProviderProfile): Promise<LoadModelsResponse> => {
  if (!isMinimaxProvider(profile.provider)) {
    return {
      models: [],
      success: false,
    };
  }
  // Hardcoded MiniMax models - no API call needed
  const hardcodedModels: Model[] = [
    {
      id: 'MiniMax-M3',
      providerId: profile.id,
      maxInputTokens: 1000000,
      maxOutputTokensLimit: 131072,
      inputCostPerToken: 0.0000003, // 0.3 per 1M tokens
      outputCostPerToken: 0.0000012, // 1.2 per 1M tokens
      cacheReadInputTokenCost: 0.00000006, // 0.06 per 1M tokens
      cacheWriteInputTokenCost: 0.000000375, // 0.375 per 1M tokens
    },
    {
      id: 'MiniMax-M2.7',
      providerId: profile.id,
      maxInputTokens: 204800,
      maxOutputTokensLimit: 131072,
      inputCostPerToken: 0.0000003, // 0.3 per 1M tokens
      outputCostPerToken: 0.0000012, // 1.2 per 1M tokens
      cacheReadInputTokenCost: 0.00000006, // 0.06 per 1M tokens
      cacheWriteInputTokenCost: 0.000000375, // 0.375 per 1M tokens
    },
    {
      id: 'MiniMax-M2.7-highspeed',
      providerId: profile.id,
      maxInputTokens: 204800,
      maxOutputTokensLimit: 131072,
      inputCostPerToken: 0.0000006, // 0.6 per 1M tokens
      outputCostPerToken: 0.0000024, // 2.4 per 1M tokens
      cacheReadInputTokenCost: 0.00000006, // 0.06 per 1M tokens
      cacheWriteInputTokenCost: 0.000000375, // 0.375 per 1M tokens
    },
    {
      id: 'MiniMax-M2.5',
      providerId: profile.id,
      maxInputTokens: 204800,
      maxOutputTokensLimit: 131072,
      inputCostPerToken: 0.0000003, // 0.3 per 1M tokens
      outputCostPerToken: 0.0000012, // 1.2 per 1M tokens
      cacheReadInputTokenCost: 0.00000003, // 0.03 per 1M tokens
      cacheWriteInputTokenCost: 0.000000375, // 0.375 per 1M tokens
    },
    {
      id: 'MiniMax-M2.5-highspeed',
      providerId: profile.id,
      maxInputTokens: 204800,
      maxOutputTokensLimit: 131072,
      inputCostPerToken: 0.0000006, // 0.6 per 1M tokens
      outputCostPerToken: 0.0000024, // 2.4 per 1M tokens
      cacheReadInputTokenCost: 0.00000003, // 0.03 per 1M tokens
      cacheWriteInputTokenCost: 0.000000375, // 0.375 per 1M tokens
    },
    {
      id: 'MiniMax-M2.1',
      providerId: profile.id,
      maxInputTokens: 204800,
      maxOutputTokensLimit: 131072,
      inputCostPerToken: 0.0000003, // 0.3 per 1M tokens
      outputCostPerToken: 0.0000012, // 1.2 per 1M tokens
      cacheReadInputTokenCost: 0.00000003, // 0.03 per 1M tokens
      cacheWriteInputTokenCost: 0.000000375, // 0.375 per 1M tokens
    },
    {
      id: 'MiniMax-M2.1-highspeed',
      providerId: profile.id,
      maxInputTokens: 204800,
      maxOutputTokensLimit: 131072,
      inputCostPerToken: 0.0000006, // 0.6 per 1M tokens
      outputCostPerToken: 0.0000024, // 2.4 per 1M tokens
      cacheReadInputTokenCost: 0.00000003, // 0.03 per 1M tokens
      cacheWriteInputTokenCost: 0.000000375, // 0.375 per 1M tokens
    },
    {
      id: 'MiniMax-M2',
      providerId: profile.id,
      maxInputTokens: 204800,
      maxOutputTokensLimit: 131072,
      inputCostPerToken: 0.0000003, // 0.3 per 1M tokens
      outputCostPerToken: 0.0000012, // 1.2 per 1M tokens
      cacheReadInputTokenCost: 0.00000003, // 0.03 per 1M tokens
      cacheWriteInputTokenCost: 0.000000375, // 0.375 per 1M tokens
    },
  ];

  return { models: hardcodedModels, success: true };
};

export const hasMinimaxEnvVars = (settings: SettingsData): boolean => {
  return !!getEffectiveEnvironmentVariable('MINIMAX_API_KEY', settings, undefined)?.value;
};

export const getMinimaxAiderMapping = (provider: ProviderProfile, modelId: string, settings: SettingsData, projectDir: string): AiderModelMapping => {
  const minimaxProvider = provider.provider as MinimaxProvider;
  const envVars: Record<string, string> = {};

  envVars.OPENAI_API_BASE = 'https://api.minimax.io/v1';
  if (minimaxProvider.apiKey) {
    envVars.OPENAI_API_KEY = minimaxProvider.apiKey;
  } else {
    const effectiveVar = getEffectiveEnvironmentVariable('MINIMAX_API_KEY', settings, projectDir);
    if (effectiveVar) {
      envVars.OPENAI_API_KEY = effectiveVar.value;
    }
  }

  return {
    modelName: `openai/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
export const createMinimaxLlm = (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): LanguageModel => {
  const provider = profile.provider as MinimaxProvider;
  let apiKey = provider.apiKey;

  if (!apiKey) {
    const effectiveVar = getEffectiveEnvironmentVariable('MINIMAX_API_KEY', settings, projectDir);
    if (effectiveVar) {
      apiKey = effectiveVar.value;
      logger.debug(`Loaded MINIMAX_API_KEY from ${effectiveVar.source}`);
    }
  }

  if (!apiKey) {
    throw new Error('Minimax API key is required in Providers settings or Aider environment variables (MINIMAX_API_KEY)');
  }

  const anthropicProvider = createAnthropic({
    apiKey,
    baseURL: 'https://api.minimax.io/anthropic/v1',
    headers: profile.headers,
  });
  return anthropicProvider(model.id);
};

// === Configuration Helper Functions ===
export const getMinimaxCacheControl = (): CacheControl | undefined => {
  return {
    providerOptions: {
      anthropic: {
        cacheControl: { type: 'ephemeral' },
      },
    },
    placement: 'message',
  };
};

export const getMinimaxProviderOptions = (llmProvider: LlmProvider, _model: Model): SharedV4ProviderOptions | undefined => {
  if (!isMinimaxProvider(llmProvider)) {
    return undefined;
  }

  // Explicitly request adaptive thinking with summarized display so reasoning/thinking
  // text is returned via thinking_delta events. Without this, newer Claude models (opus-4-7+)
  // default to 'omitted' display and return empty thinking blocks.
  return {
    anthropic: {
      thinking: { type: 'adaptive', display: 'summarized' },
    },
  } satisfies SharedV4ProviderOptions;
};

// === Complete Strategy Implementation ===
export const minimaxProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createMinimaxLlm,
  getUsageReport: getDefaultUsageReport,

  // Model discovery functions
  loadModels: loadMinimaxModels,
  hasEnvVars: hasMinimaxEnvVars,
  getAiderMapping: getMinimaxAiderMapping,

  // Configuration helpers
  getCacheControl: getMinimaxCacheControl,
  getProviderOptions: getMinimaxProviderOptions,
};
