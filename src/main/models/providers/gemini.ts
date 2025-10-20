import { Model, ModelInfo, ProviderProfile, SettingsData, UsageReportData } from '@common/types';
import { GeminiProvider, isGeminiProvider, LlmProvider } from '@common/agent';
import { createGoogleGenerativeAI, google, type GoogleGenerativeAIProviderOptions } from '@ai-sdk/google';

import type { LanguageModelUsage, ToolSet } from 'ai';
import type { LanguageModelV2, SharedV2ProviderOptions } from '@ai-sdk/provider';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { Task } from '@/task/task';

export const loadGeminiModels = async (
  profile: ProviderProfile,
  modelsInfo: Record<string, ModelInfo>,
  settings: SettingsData,
): Promise<LoadModelsResponse> => {
  if (!isGeminiProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider as GeminiProvider;
  const apiKey = provider.apiKey || '';
  const baseUrl = provider.customBaseUrl || 'https://generativelanguage.googleapis.com';

  const apiKeyEnv = getEffectiveEnvironmentVariable('GEMINI_API_KEY', settings);
  const baseUrlEnv = getEffectiveEnvironmentVariable('GEMINI_API_BASE_URL', settings);

  const effectiveApiKey = apiKey || apiKeyEnv?.value || '';
  const effectiveBaseUrl = baseUrl || baseUrlEnv?.value || 'https://generativelanguage.googleapis.com';

  if (!effectiveApiKey) {
    return { models: [], success: false };
  }

  try {
    const url = `${effectiveBaseUrl}/v1beta/models?key=${effectiveApiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
      const errorMsg = `Gemini models API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
      logger.error(errorMsg, response.status, response.statusText);
      return { models: [], success: false, error: errorMsg };
    }

    const data = await response.json();
    const models =
      data.models
        ?.filter((model: { supportedGenerationMethods?: string[] }) => model.supportedGenerationMethods?.includes('generateContent'))
        .map((model: { name: string; inputTokenLimit?: number; outputTokenLimit?: number; supportedGenerationMethods?: string[] }) => {
          const modelId = model.name.replace('models/', '');
          const info = modelsInfo[modelId];
          return {
            ...info,
            id: modelId,
            providerId: profile.id,
            maxInputTokens: model.inputTokenLimit,
            maxOutputTokens: model.outputTokenLimit,
          };
        }) || [];

    logger.info(`Loaded ${models.length} Gemini models for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error loading Gemini models';
    logger.error('Error loading Gemini models:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

export const hasGeminiEnvVars = (settings: SettingsData): boolean => {
  return !!getEffectiveEnvironmentVariable('GEMINI_API_KEY', settings, undefined)?.value;
};

export const getGeminiAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  const geminiProvider = provider.provider as GeminiProvider;
  const envVars: Record<string, string> = {};

  if (geminiProvider.apiKey) {
    envVars.GEMINI_API_KEY = geminiProvider.apiKey;
  }

  if (geminiProvider.customBaseUrl) {
    envVars.GEMINI_API_BASE = geminiProvider.customBaseUrl;
  }

  return {
    modelName: `gemini/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
export const createGeminiLlm = (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): LanguageModelV2 => {
  const provider = profile.provider as GeminiProvider;
  let apiKey = provider.apiKey;
  let baseUrl = provider.customBaseUrl;

  if (!apiKey) {
    const effectiveVar = getEffectiveEnvironmentVariable('GEMINI_API_KEY', settings, projectDir);
    if (effectiveVar) {
      apiKey = effectiveVar.value;
      logger.debug(`Loaded GEMINI_API_KEY from ${effectiveVar.source}`);
    }
  }

  if (!apiKey) {
    throw new Error('Gemini API key is required in Providers settings or Aider environment variables (GEMINI_API_KEY)');
  }

  if (!baseUrl) {
    const effectiveBaseUrl = getEffectiveEnvironmentVariable('GEMINI_API_BASE_URL', settings, projectDir);
    if (effectiveBaseUrl) {
      baseUrl = effectiveBaseUrl.value;
      logger.debug(`Loaded GEMINI_API_BASE_URL from ${effectiveBaseUrl.source}`);
    }
  }

  const googleProvider = createGoogleGenerativeAI({
    apiKey,
    baseURL: baseUrl,
    headers: profile.headers,
  });
  return googleProvider(model.id);
};

type GoogleMetadata = {
  google: {
    cachedInputTokens?: number;
  };
};

// === Cost and Usage Functions ===
export const calculateGeminiCost = (model: Model, sentTokens: number, receivedTokens: number, cacheReadTokens: number = 0): number => {
  const inputCostPerToken = model.inputCostPerToken ?? 0;
  const outputCostPerToken = model.outputCostPerToken ?? 0;
  const cacheReadInputTokenCost = model.cacheReadInputTokenCost ?? inputCostPerToken * 0.25;

  const inputCost = sentTokens * inputCostPerToken;
  const outputCost = receivedTokens * outputCostPerToken;
  const cacheCost = cacheReadTokens * cacheReadInputTokenCost;

  return inputCost + outputCost + cacheCost;
};

export const getGeminiUsageReport = (
  task: Task,
  provider: ProviderProfile,
  model: Model,
  usage: LanguageModelUsage,
  providerMetadata?: unknown,
): UsageReportData => {
  const totalSentTokens = usage.inputTokens || 0;
  const receivedTokens = usage.outputTokens || 0;

  // Extract cache read tokens from provider metadata or usage
  const { google } = (providerMetadata as GoogleMetadata) || {};
  const cacheReadTokens = google?.cachedInputTokens ?? usage.cachedInputTokens ?? 0;

  // Calculate sentTokens after deducting cached tokens
  const sentTokens = totalSentTokens - cacheReadTokens;

  // Calculate cost internally with already deducted sentTokens
  const messageCost = calculateGeminiCost(model, sentTokens, receivedTokens, cacheReadTokens);

  const usageReportData: UsageReportData = {
    model: `${provider.id}/${model.id}`,
    sentTokens,
    receivedTokens,
    cacheReadTokens,
    messageCost,
    agentTotalCost: task.task.agentTotalCost + messageCost,
  };

  return usageReportData;
};

export const getGeminiProviderOptions = (llmProvider: LlmProvider, model: Model): SharedV2ProviderOptions | undefined => {
  if (isGeminiProvider(llmProvider)) {
    const providerOverrides = model.providerOverrides as Partial<GeminiProvider> | undefined;

    // Use model-specific overrides, falling back to provider defaults
    const includeThoughts = providerOverrides?.includeThoughts ?? llmProvider.includeThoughts;
    const thinkingBudget = providerOverrides?.thinkingBudget ?? llmProvider.thinkingBudget;

    return {
      google: {
        ...((includeThoughts || thinkingBudget) && {
          thinkingConfig: {
            includeThoughts: includeThoughts && (thinkingBudget ?? 0) > 0,
            thinkingBudget,
          },
        }),
      } satisfies GoogleGenerativeAIProviderOptions,
    };
  }

  return undefined;
};

// === Provider Tools Functions ===
export const getGeminiProviderTools = (provider: LlmProvider, model: Model): ToolSet => {
  if (!isGeminiProvider(provider)) {
    return {};
  }

  // Check for model-specific overrides
  const providerOverrides = model.providerOverrides as Partial<GeminiProvider> | undefined;
  const useSearchGrounding = providerOverrides?.useSearchGrounding ?? provider.useSearchGrounding;

  if (!useSearchGrounding) {
    return {};
  }

  return {
    google_search: google.tools.googleSearch({}),
  };
};

// === Complete Strategy Implementation ===
export const geminiProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createGeminiLlm,
  getUsageReport: getGeminiUsageReport,

  // Model discovery functions
  loadModels: loadGeminiModels,
  hasEnvVars: hasGeminiEnvVars,
  getAiderMapping: getGeminiAiderMapping,

  getProviderOptions: getGeminiProviderOptions,
  getProviderTools: getGeminiProviderTools,
};
