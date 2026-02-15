import { Model, ProviderProfile, SettingsData, UsageReportData } from '@aider-desk/common/types';
import { DEFAULT_MODEL_TEMPERATURE, GpustackProvider, isGpustackProvider } from '@aider-desk/common/agent';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import type { LanguageModelUsage } from 'ai';
import type { LanguageModelV2 } from '@ai-sdk/provider';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { Task } from '@/task/task';
import { getEffectiveEnvironmentVariable } from '@/utils';

interface GpustackModelResponse {
  items: Array<{
    name: string;
    meta?: {
      max_model_len?: number;
    };
  }>;
}

const loadGpustackModels = async (profile: ProviderProfile, settings: SettingsData): Promise<LoadModelsResponse> => {
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
          temperature: DEFAULT_MODEL_TEMPERATURE,
        } satisfies Model;
      }) || [];

    logger.info(`Loaded ${models.length} GPUStack models for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error loading GPUStack models';
    logger.warn('Failed to fetch GPUStack models via API:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

const hasGpustackEnvVars = (settings: SettingsData): boolean => {
  const hasApiKey = !!getEffectiveEnvironmentVariable('GPUSTACK_API_KEY', settings, undefined)?.value;
  const hasBaseUrl = !!getEffectiveEnvironmentVariable('GPUSTACK_API_BASE', settings, undefined)?.value;
  return hasApiKey || hasBaseUrl;
};

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

// === LLM Creation Functions ===
const createGpustackLlm = (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): LanguageModelV2 => {
  const provider = profile.provider as GpustackProvider;
  let apiKey = provider.apiKey;
  let baseUrl = provider.baseUrl;

  if (!apiKey) {
    const effectiveVar = getEffectiveEnvironmentVariable('GPUSTACK_API_KEY', settings, projectDir);
    if (effectiveVar) {
      apiKey = effectiveVar.value;
      logger.debug(`Loaded GPUSTACK_API_KEY from ${effectiveVar.source}`);
    }
  }

  if (!apiKey) {
    throw new Error(`API key is required for ${provider.name}. Check Providers settings or Aider environment variables (GPUSTACK_API_KEY).`);
  }

  if (!baseUrl) {
    const effectiveVar = getEffectiveEnvironmentVariable('GPUSTACK_API_BASE', settings, projectDir);
    if (effectiveVar) {
      baseUrl = effectiveVar.value;
      logger.debug(`Loaded GPUSTACK_API_BASE from ${effectiveVar.source}`);
    }
  }

  if (!baseUrl) {
    throw new Error(`Base URL is required for ${provider.name} provider. Set it in Providers settings or via the GPUSTACK_API_BASE environment variable.`);
  }

  // Use createOpenAICompatible to get a provider instance, then get the model
  // GPUStack uses /v1-openai prefix for OpenAI compatibility
  const compatibleProvider = createOpenAICompatible({
    name: provider.name,
    apiKey,
    baseURL: `${baseUrl}/v1-openai`,
    headers: profile.headers,
  });
  return compatibleProvider(model.id);
};

const getGpustackUsageReport = (task: Task, provider: ProviderProfile, model: Model, usage: LanguageModelUsage): UsageReportData => {
  const totalSentTokens = usage.inputTokens || 0;
  const receivedTokens = usage.outputTokens || 0;
  const cacheReadTokens = usage.cachedInputTokens || 0;
  const sentTokens = totalSentTokens - cacheReadTokens;

  // Cost is always 0 for GPUStack
  const messageCost = 0;

  return {
    model: `${provider.id}/${model.id}`,
    sentTokens,
    receivedTokens,
    cacheReadTokens,
    messageCost,
    agentTotalCost: task.task.agentTotalCost + messageCost,
  };
};

// === Complete Strategy Implementation ===
export const gpustackProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createGpustackLlm,
  getUsageReport: getGpustackUsageReport,

  // Model discovery functions
  loadModels: loadGpustackModels,
  hasEnvVars: hasGpustackEnvVars,
  getAiderMapping: getGpustackAiderMapping,
};
