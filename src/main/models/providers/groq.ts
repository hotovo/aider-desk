import { ModelInfo, ProviderProfile, SettingsData, UsageReportData } from '@common/types';
import { GroqProvider, isGroqProvider } from '@common/agent';
import { createGroq } from '@ai-sdk/groq';

import type { LanguageModel, LanguageModelUsage } from 'ai';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { Project } from '@/project/project';

interface GroqModel {
  id: string;
}

interface GroqApiResponse {
  data: GroqModel[];
}

export const loadGroqModels = async (profile: ProviderProfile, modelsInfo: Record<string, ModelInfo>): Promise<LoadModelsResponse> => {
  if (!isGroqProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider;
  const apiKey = provider.apiKey || '';
  const apiKeyEnv = getEffectiveEnvironmentVariable('GROQ_API_KEY', undefined);
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

export const hasGroqEnvVars = (projectDir?: string, settings?: SettingsData): boolean => {
  return !!getEffectiveEnvironmentVariable('GROQ_API_KEY', projectDir, settings)?.value;
};

export const getGroqAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  const groqProvider = provider.provider as GroqProvider;
  return {
    modelName: `groq/${modelId}`,
    environmentVariables: {
      GROQ_API_KEY: groqProvider.apiKey || '',
    },
  };
};

// === LLM Creation Functions ===
export const createGroqLlm = (profile: ProviderProfile, model: string, env: Record<string, string | undefined> = {}): LanguageModel => {
  const provider = profile.provider as GroqProvider;
  const apiKey = provider.apiKey || env['GROQ_API_KEY'];

  if (!apiKey) {
    throw new Error('Groq API key is required in Providers settings or Aider environment variables (GROQ_API_KEY)');
  }

  const groqProvider = createGroq({
    apiKey,
    headers: profile.headers,
  });
  return groqProvider(model);
};

// === Cost and Usage Functions ===
export const calculateGroqCost = (modelInfo: ModelInfo | undefined, sentTokens: number, receivedTokens: number, _providerMetadata?: unknown): number => {
  if (!modelInfo) {
    return 0;
  }

  // Standard cost calculation without caching adjustments
  const inputCost = sentTokens * modelInfo.inputCostPerToken;
  const outputCost = receivedTokens * modelInfo.outputCostPerToken;

  return inputCost + outputCost;
};

export const getGroqUsageReport = (
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
export const groqProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createGroqLlm,
  calculateCost: calculateGroqCost,
  getUsageReport: getGroqUsageReport,

  // Model discovery functions
  loadModels: loadGroqModels,
  hasEnvVars: hasGroqEnvVars,
  getAiderMapping: getGroqAiderMapping,
};
