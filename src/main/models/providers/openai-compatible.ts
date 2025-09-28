import { ModelInfo, ProviderProfile, SettingsData, UsageReportData } from '@common/types';
import { isOpenAiCompatibleProvider, OpenAiCompatibleProvider } from '@common/agent';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import type { LanguageModel, LanguageModelUsage } from 'ai';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { Project } from '@/project/project';
import { getEffectiveEnvironmentVariable } from '@/utils';

export const loadOpenaiCompatibleModels = async (profile: ProviderProfile, modelsInfo: Record<string, ModelInfo>): Promise<LoadModelsResponse> => {
  if (!isOpenAiCompatibleProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider as OpenAiCompatibleProvider;
  const apiKey = provider.apiKey || '';
  const baseUrl = provider.baseUrl;

  const apiKeyEnv = getEffectiveEnvironmentVariable('OPENAI_API_KEY', undefined);
  const baseUrlEnv = getEffectiveEnvironmentVariable('OPENAI_API_BASE', undefined);

  const effectiveApiKey = apiKey || apiKeyEnv?.value;
  const effectiveBaseUrl = baseUrl || baseUrlEnv?.value;

  if (!(effectiveApiKey && effectiveBaseUrl)) {
    return { models: [], success: false };
  }

  try {
    const response = await fetch(`${effectiveBaseUrl}/models`, {
      headers: { Authorization: `Bearer ${effectiveApiKey}` },
    });
    if (!response.ok) {
      const errorMsg = `OpenAI-compatible models API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
      logger.debug(errorMsg);
      return { models: [], success: false, error: errorMsg };
    }

    const data = await response.json();
    const models =
      data.data?.map((model: { id: string }) => {
        const info = modelsInfo[model.id];
        return {
          id: model.id,
          providerId: profile.id,
          ...info,
        };
      }) || [];

    logger.info(`Loaded ${models.length} OpenAI-compatible models for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error loading OpenAI-compatible models';
    logger.warn('Failed to fetch OpenAI-compatible models via API:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

export const hasOpenAiCompatibleEnvVars = (projectDir?: string, settings?: SettingsData): boolean => {
  const hasApiKey = !!getEffectiveEnvironmentVariable('OPENAI_API_KEY', projectDir, settings)?.value;
  const hasBaseUrl = !!getEffectiveEnvironmentVariable('OPENAI_API_BASE', projectDir, settings)?.value;
  return hasApiKey || hasBaseUrl;
};

export const getOpenAiCompatibleAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  const compatibleProvider = provider.provider as OpenAiCompatibleProvider;
  const envVars: Record<string, string> = {};

  if (compatibleProvider.apiKey) {
    envVars.OPENAI_API_KEY = compatibleProvider.apiKey;
  }
  if (compatibleProvider.baseUrl) {
    envVars.OPENAI_API_BASE = compatibleProvider.baseUrl;
  }

  // Use openai prefix for OpenAI-compatible providers
  return {
    modelName: `openai/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
export const createOpenAiCompatibleLlm = (profile: ProviderProfile, model: string, env: Record<string, string | undefined> = {}): LanguageModel => {
  const provider = profile.provider as OpenAiCompatibleProvider;
  const apiKey = provider.apiKey || env['OPENAI_API_KEY'];
  if (!apiKey) {
    throw new Error(`API key is required for ${provider.name}. Check Providers settings or Aider environment variables (OPENAI_API_KEY).`);
  }
  const baseUrl = provider.baseUrl || env['OPENAI_API_BASE'];
  if (!baseUrl) {
    throw new Error(`Base URL is required for ${provider.name} provider. Set it in Providers settings or via the OPENAI_API_BASE environment variable.`);
  }

  // Use createOpenAICompatible to get a provider instance, then get the model
  const compatibleProvider = createOpenAICompatible({
    name: provider.name,
    apiKey,
    baseURL: baseUrl,
    headers: profile.headers,
  });
  return compatibleProvider(model);
};

// === Cost and Usage Functions ===
export const calculateOpenAiCompatibleCost = (
  modelInfo: ModelInfo | undefined,
  sentTokens: number,
  receivedTokens: number,
  _providerMetadata?: unknown,
): number => {
  if (!modelInfo) {
    return 0;
  }

  // Standard cost calculation without caching adjustments
  const inputCost = sentTokens * modelInfo.inputCostPerToken;
  const outputCost = receivedTokens * modelInfo.outputCostPerToken;

  return inputCost + outputCost;
};

export const getOpenAiCompatibleUsageReport = (
  project: Project,
  provider: ProviderProfile,
  modelId: string,
  messageCost: number,
  usage: LanguageModelUsage,
  _providerMetadata?: unknown,
): UsageReportData => {
  return {
    model: `${provider.id}/${modelId}`,
    sentTokens: usage.promptTokens,
    receivedTokens: usage.completionTokens,
    messageCost,
    agentTotalCost: project.agentTotalCost + messageCost,
  };
};

// === Complete Strategy Implementation ===
export const openaiCompatibleProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createOpenAiCompatibleLlm,
  calculateCost: calculateOpenAiCompatibleCost,
  getUsageReport: getOpenAiCompatibleUsageReport,

  // Model discovery functions
  loadModels: loadOpenaiCompatibleModels,
  hasEnvVars: hasOpenAiCompatibleEnvVars,
  getAiderMapping: getOpenAiCompatibleAiderMapping,
};
