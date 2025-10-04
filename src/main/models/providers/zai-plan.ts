import { Model, ModelInfo, ProviderProfile, SettingsData, UsageReportData } from '@common/types';
import { isZaiPlanProvider, ZaiPlanProvider } from '@common/agent';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import type { LanguageModel, LanguageModelUsage } from 'ai';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { Project } from '@/project/project';
import { getEffectiveEnvironmentVariable } from '@/utils';

export const loadZaiPlanModels = async (
  profile: ProviderProfile,
  modelsInfo: Record<string, ModelInfo>,
  settings: SettingsData,
): Promise<LoadModelsResponse> => {
  if (!isZaiPlanProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider as ZaiPlanProvider;
  const apiKey = provider.apiKey || '';

  const apiKeyEnv = getEffectiveEnvironmentVariable('ZAI_API_KEY', settings);

  const effectiveApiKey = apiKey || apiKeyEnv?.value;

  if (!effectiveApiKey) {
    return { models: [], success: false };
  }

  try {
    // ZAI uses specific endpoint for model discovery
    const response = await fetch('https://api.z.ai/api/paas/v4/models', {
      headers: { Authorization: `Bearer ${effectiveApiKey}` },
    });
    if (!response.ok) {
      const errorMsg = `ZAI models API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
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

    logger.info(`Loaded ${models.length} ZAI models for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error loading ZAI models';
    logger.warn('Failed to fetch ZAI models via API:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

export const hasZaiPlanEnvVars = (settings: SettingsData): boolean => {
  const hasApiKey = !!getEffectiveEnvironmentVariable('ZAI_API_KEY', settings, undefined)?.value;
  return hasApiKey;
};

export const getZaiPlanAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  const zaiProvider = provider.provider as ZaiPlanProvider;
  const envVars: Record<string, string> = {};

  if (zaiProvider.apiKey) {
    envVars.ZAI_API_KEY = zaiProvider.apiKey;
  }

  // Use zai-plan prefix for ZAI providers
  return {
    modelName: `zai-plan/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
export const createZaiPlanLlm = (profile: ProviderProfile, model: Model, env: Record<string, string | undefined> = {}): LanguageModel => {
  const provider = profile.provider as ZaiPlanProvider;
  const apiKey = provider.apiKey || env['ZAI_API_KEY'];
  if (!apiKey) {
    throw new Error(`API key is required for ${provider.name}. Check Providers settings or Aider environment variables (ZAI_API_KEY).`);
  }

  // Use createOpenAICompatible to get a provider instance, then get the model
  // ZAI uses specific base URL for chat completions
  const compatibleProvider = createOpenAICompatible({
    name: provider.name,
    apiKey,
    baseURL: 'https://api.z.ai/api/coding/paas/v4',
    headers: profile.headers,
  });
  return compatibleProvider(model.id);
};

// === Cost and Usage Functions ===
export const calculateZaiPlanCost = (modelInfo: ModelInfo | undefined, sentTokens: number, receivedTokens: number, _providerMetadata?: unknown): number => {
  if (!modelInfo) {
    return 0;
  }

  // Standard cost calculation without caching adjustments
  const inputCost = sentTokens * modelInfo.inputCostPerToken;
  const outputCost = receivedTokens * modelInfo.outputCostPerToken;

  return inputCost + outputCost;
};

export const getZaiPlanUsageReport = (
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
export const zaiPlanProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createZaiPlanLlm,
  calculateCost: calculateZaiPlanCost,
  getUsageReport: getZaiPlanUsageReport,

  // Model discovery functions
  loadModels: loadZaiPlanModels,
  hasEnvVars: hasZaiPlanEnvVars,
  getAiderMapping: getZaiPlanAiderMapping,
};
