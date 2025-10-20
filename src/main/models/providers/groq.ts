import { Model, ModelInfo, ProviderProfile, SettingsData, UsageReportData } from '@common/types';
import { GroqProvider, isGroqProvider } from '@common/agent';
import { createGroq } from '@ai-sdk/groq';

import type { LanguageModelUsage } from 'ai';
import type { LanguageModelV2 } from '@ai-sdk/provider';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { Task } from '@/task/task';

interface GroqModel {
  id: string;
}

interface GroqApiResponse {
  data: GroqModel[];
}

export const loadGroqModels = async (profile: ProviderProfile, modelsInfo: Record<string, ModelInfo>, settings: SettingsData): Promise<LoadModelsResponse> => {
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
      data.data
        ?.filter((model: GroqModel) => {
          // Filter out models that don't have pricing information
          return modelsInfo[model.id];
        })
        .map((model: GroqModel) => {
          const info = modelsInfo[model.id];
          return {
            id: model.id,
            providerId: profile.id,
            ...info,
          };
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

// === Cost and Usage Functions ===
export const calculateGroqCost = (model: Model, sentTokens: number, receivedTokens: number, cacheReadTokens: number = 0): number => {
  const inputCostPerToken = model.inputCostPerToken ?? 0;
  const outputCostPerToken = model.outputCostPerToken ?? 0;
  const cacheReadInputTokenCost = model.cacheReadInputTokenCost ?? inputCostPerToken;

  const inputCost = sentTokens * inputCostPerToken;
  const outputCost = receivedTokens * outputCostPerToken;
  const cacheCost = cacheReadTokens * cacheReadInputTokenCost;

  return inputCost + outputCost + cacheCost;
};

export const getGroqUsageReport = (task: Task, provider: ProviderProfile, model: Model, usage: LanguageModelUsage): UsageReportData => {
  const totalSentTokens = usage.inputTokens || 0;
  const receivedTokens = usage.outputTokens || 0;
  const cacheReadTokens = usage.cachedInputTokens || 0;
  const sentTokens = totalSentTokens - cacheReadTokens;

  // Calculate cost internally (no caching for Groq)
  const messageCost = calculateGroqCost(model, sentTokens, receivedTokens, cacheReadTokens);

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
export const groqProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createGroqLlm,
  getUsageReport: getGroqUsageReport,

  // Model discovery functions
  loadModels: loadGroqModels,
  hasEnvVars: hasGroqEnvVars,
  getAiderMapping: getGroqAiderMapping,
};
