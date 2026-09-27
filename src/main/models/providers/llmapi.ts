import { Model, ProviderProfile, SettingsData, UsageReportData } from '@common/types';
import { isLlmApiProvider, LlmApiProvider } from '@common/agent';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import type { LanguageModel, LanguageModelUsage } from 'ai';

import { AIDER_DESK_TITLE, AIDER_DESK_WEBSITE } from '@/constants';
import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { getDefaultUsageReport } from '@/models/providers/default';
import { Task } from '@/task/task';

const LLMAPI_BASE_URL = 'https://api.llmapi.ai/v1';

interface LlmApiPricing {
  prompt?: string;
  completion?: string;
  input_cache_read?: string;
  input_cache_write?: string;
}

interface LlmApiModel {
  id: string;
  context_length?: number;
  pricing: LlmApiPricing;
}

interface LlmApiModelsResponse {
  data: LlmApiModel[];
}

const parsePrice = (price: string | undefined): number | undefined => {
  if (!price) {
    return undefined;
  }
  const value = Number(price);
  return Number.isFinite(value) && value > 0 ? value : undefined;
};

const loadLlmApiModels = async (profile: ProviderProfile, settings: SettingsData): Promise<LoadModelsResponse> => {
  if (!isLlmApiProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider as LlmApiProvider;
  const apiKey = provider.apiKey || '';
  const apiKeyEnv = getEffectiveEnvironmentVariable('LLMAPI_API_KEY', settings);
  const effectiveApiKey = apiKey || apiKeyEnv?.value || '';

  if (!effectiveApiKey) {
    return { models: [], success: false };
  }

  try {
    const response = await fetch(`${LLMAPI_BASE_URL}/models`, {
      headers: {
        Authorization: `Bearer ${effectiveApiKey}`,
      },
    });
    if (!response.ok) {
      const errorMsg = `LLMAPI models API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
      logger.error(errorMsg);
      return { models: [], success: false, error: errorMsg };
    }

    const data = (await response.json()) as LlmApiModelsResponse;
    const models =
      data.data?.map((model: LlmApiModel) => {
        return {
          id: model.id,
          providerId: profile.id,
          maxInputTokens: model.context_length,
          inputCostPerToken: parsePrice(model.pricing?.prompt),
          outputCostPerToken: parsePrice(model.pricing?.completion),
          cacheWriteInputTokenCost: parsePrice(model.pricing?.input_cache_write),
          cacheReadInputTokenCost: parsePrice(model.pricing?.input_cache_read),
        } satisfies Model;
      }) || [];

    logger.info(`Loaded ${models.length} LLMAPI models for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error loading LLMAPI models';
    logger.error('Error loading LLMAPI models:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

export const hasLlmApiEnvVars = (settings: SettingsData): boolean => {
  return !!getEffectiveEnvironmentVariable('LLMAPI_API_KEY', settings, undefined)?.value;
};

export const getLlmApiAiderMapping = (provider: ProviderProfile, modelId: string, settings: SettingsData, projectDir: string): AiderModelMapping => {
  const llmApiProvider = provider.provider as LlmApiProvider;
  const envVars: Record<string, string> = {
    OPENAI_API_BASE: LLMAPI_BASE_URL,
  };

  if (llmApiProvider.apiKey) {
    envVars.OPENAI_API_KEY = llmApiProvider.apiKey;
  } else {
    const effectiveVar = getEffectiveEnvironmentVariable('LLMAPI_API_KEY', settings, projectDir);
    if (effectiveVar) {
      envVars.OPENAI_API_KEY = effectiveVar.value;
    }
  }

  // LLMAPI is OpenAI-compatible, so we use the OpenAI endpoint for Aider
  return {
    modelName: `openai/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
export const createLlmApiLlm = (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): LanguageModel => {
  const provider = profile.provider as LlmApiProvider;
  let apiKey = provider.apiKey;

  if (!apiKey) {
    const effectiveVar = getEffectiveEnvironmentVariable('LLMAPI_API_KEY', settings, projectDir);
    if (effectiveVar) {
      apiKey = effectiveVar.value;
      logger.debug(`Loaded LLMAPI_API_KEY from ${effectiveVar.source}`);
    }
  }

  if (!apiKey) {
    throw new Error('LLMAPI API key is required in Providers settings or Aider environment variables (LLMAPI_API_KEY)');
  }

  const llmApiProvider = createOpenAICompatible({
    name: 'llmapi',
    apiKey,
    baseURL: LLMAPI_BASE_URL,
    headers: {
      ...profile.headers,
      'HTTP-Referer': AIDER_DESK_WEBSITE,
      'X-Title': AIDER_DESK_TITLE,
    },
  });
  return llmApiProvider(model.id);
};

// === Cost and Usage Functions ===
export const getLlmApiUsageReport = (task: Task, provider: ProviderProfile, model: Model, usage: LanguageModelUsage): UsageReportData =>
  getDefaultUsageReport(task, provider, model, usage);

// === Complete Strategy Implementation ===
export const llmApiProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createLlmApiLlm,
  getUsageReport: getLlmApiUsageReport,

  // Model discovery functions
  loadModels: loadLlmApiModels,
  hasEnvVars: hasLlmApiEnvVars,
  getAiderMapping: getLlmApiAiderMapping,
};
