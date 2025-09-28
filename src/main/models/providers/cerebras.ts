import { ModelInfo, ProviderProfile, SettingsData, UsageReportData } from '@common/types';
import { CerebrasProvider, isCerebrasProvider } from '@common/agent';
import { createCerebras } from '@ai-sdk/cerebras';

import type { LanguageModel, LanguageModelUsage } from 'ai';

import { AiderModelMapping, LlmProviderStrategy } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils/environment';
import { LoadModelsResponse } from '@/models/types';
import { Project } from '@/project/project';

interface CerebrasModel {
  id: string;
  max_context_length?: number;
  description?: string;
}

export const loadCerebrasModels = async (profile: ProviderProfile, modelsInfo: Record<string, ModelInfo>): Promise<LoadModelsResponse> => {
  if (!isCerebrasProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider;
  const apiKey = provider.apiKey || '';
  const apiKeyEnv = getEffectiveEnvironmentVariable('CEREBRAS_API_KEY', undefined);
  const effectiveApiKey = apiKey || apiKeyEnv?.value || '';

  if (!effectiveApiKey) {
    logger.debug('Cerebras API key is required. Please set it in Providers settings or via CEREBRAS_API_KEY environment variable.');
    return { models: [], success: false };
  }

  try {
    const response = await fetch('https://api.cerebras.ai/v1/models', {
      headers: { Authorization: `Bearer ${effectiveApiKey}` },
    });

    if (!response.ok) {
      const errorMsg = `Cerebras models API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
      logger.error(errorMsg, {
        status: response.status,
        statusText: response.statusText,
      });
      return { models: [], success: false, error: errorMsg };
    }

    const data = await response.json();
    const models =
      data.data
        ?.filter((model: CerebrasModel) => {
          // Filter out models that don't have pricing information
          return modelsInfo[model.id];
        })
        .map((model: CerebrasModel) => {
          const info = modelsInfo[model.id];
          return {
            id: model.id,
            providerId: profile.id,
            ...info,
            maxInputTokens: model.max_context_length || info?.maxInputTokens,
          };
        }) || [];

    logger.info(`Loaded ${models.length} Cerebras models for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error loading Cerebras models';
    logger.error('Error loading Cerebras models:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

export const hasCerebrasEnvVars = (projectDir?: string, settings?: SettingsData): boolean => {
  return !!getEffectiveEnvironmentVariable('CEREBRAS_API_KEY', projectDir, settings)?.value;
};

export const getCerebrasAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  const cerebrasProvider = provider.provider as CerebrasProvider;
  const envVars: Record<string, string> = {};

  if (cerebrasProvider.apiKey) {
    envVars.CEREBRAS_API_KEY = cerebrasProvider.apiKey;
  }

  return {
    modelName: `cerebras/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
export const createCerebrasLlm = (profile: ProviderProfile, model: string, env: Record<string, string | undefined> = {}): LanguageModel => {
  const provider = profile.provider as CerebrasProvider;
  const apiKey = provider.apiKey || env['CEREBRAS_API_KEY'];

  if (!apiKey) {
    throw new Error('Cerebras API key is required in Providers settings or Aider environment variables (CEREBRAS_API_KEY)');
  }

  const cerebrasProvider = createCerebras({
    apiKey,
    headers: profile.headers,
  });
  return cerebrasProvider(model);
};

// === Cost and Usage Functions ===
export const calculateCerebrasCost = (modelInfo: ModelInfo | undefined, sentTokens: number, receivedTokens: number, _providerMetadata?: unknown): number => {
  if (!modelInfo) {
    return 0;
  }

  // Standard cost calculation without caching adjustments
  const inputCost = sentTokens * modelInfo.inputCostPerToken;
  const outputCost = receivedTokens * modelInfo.outputCostPerToken;

  return inputCost + outputCost;
};

export const getCerebrasUsageReport = (
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
export const cerebrasProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createCerebrasLlm,
  calculateCost: calculateCerebrasCost,
  getUsageReport: getCerebrasUsageReport,

  // Model discovery functions
  loadModels: loadCerebrasModels,
  hasEnvVars: hasCerebrasEnvVars,
  getAiderMapping: getCerebrasAiderMapping,
};
