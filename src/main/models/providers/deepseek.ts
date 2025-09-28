import { ModelInfo, ProviderProfile, SettingsData, UsageReportData } from '@common/types';
import { DeepseekProvider, isDeepseekProvider } from '@common/agent';
import { createDeepSeek } from '@ai-sdk/deepseek';

import type { LanguageModel, LanguageModelUsage } from 'ai';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { Project } from '@/project/project';

export const loadDeepseekModels = async (profile: ProviderProfile, modelsInfo: Record<string, ModelInfo>): Promise<LoadModelsResponse> => {
  if (!isDeepseekProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider as DeepseekProvider;
  const apiKey = provider.apiKey || '';
  const apiKeyEnv = getEffectiveEnvironmentVariable('DEEPSEEK_API_KEY', undefined);

  if (!apiKey && !apiKeyEnv?.value) {
    return { models: [], success: false };
  }

  try {
    const response = await fetch('https://api.deepseek.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey || apiKeyEnv?.value || ''}` },
    });
    if (!response.ok) {
      const errorMsg = `DeepSeek models API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
      logger.error(errorMsg, response.status, response.statusText);
      return { models: [], success: false, error: errorMsg };
    }

    const data = await response.json();
    const models =
      data.data?.map((m: { id: string }) => {
        const info = modelsInfo[m.id];
        return {
          id: m.id,
          providerId: profile.id,
          ...info,
        };
      }) || [];

    logger.info(`Loaded ${models.length} DeepSeek models for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error loading DeepSeek models';
    logger.error('Error loading DeepSeek models:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

export const hasDeepseekEnvVars = (projectDir?: string, settings?: SettingsData): boolean => {
  return !!getEffectiveEnvironmentVariable('DEEPSEEK_API_KEY', projectDir, settings)?.value;
};

export const getDeepseekAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  const deepseekProvider = provider.provider as DeepseekProvider;
  const envVars: Record<string, string> = {};

  if (deepseekProvider.apiKey) {
    envVars.DEEPSEEK_API_KEY = deepseekProvider.apiKey;
  }

  return {
    modelName: `deepseek/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
export const createDeepseekLlm = (profile: ProviderProfile, model: string, env: Record<string, string | undefined> = {}): LanguageModel => {
  const provider = profile.provider as DeepseekProvider;
  const apiKey = provider.apiKey || env['DEEPSEEK_API_KEY'];

  if (!apiKey) {
    throw new Error('Deepseek API key is required in Providers settings or Aider environment variables (DEEPSEEK_API_KEY)');
  }

  const deepseekProvider = createDeepSeek({
    apiKey,
    headers: profile.headers,
  });
  return deepseekProvider(model);
};

// === Cost and Usage Functions ===
export const calculateDeepseekCost = (modelInfo: ModelInfo | undefined, sentTokens: number, receivedTokens: number, _providerMetadata?: unknown): number => {
  if (!modelInfo) {
    return 0;
  }

  // Standard cost calculation without caching adjustments
  const inputCost = sentTokens * modelInfo.inputCostPerToken;
  const outputCost = receivedTokens * modelInfo.outputCostPerToken;

  return inputCost + outputCost;
};

export const getDeepseekUsageReport = (
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
export const deepseekProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createDeepseekLlm,
  calculateCost: calculateDeepseekCost,
  getUsageReport: getDeepseekUsageReport,

  // Model discovery functions
  loadModels: loadDeepseekModels,
  hasEnvVars: hasDeepseekEnvVars,
  getAiderMapping: getDeepseekAiderMapping,
};
