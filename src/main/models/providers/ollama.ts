import { ModelInfo, ProviderProfile, SettingsData, UsageReportData } from '@common/types';
import { isOllamaProvider, OllamaProvider } from '@common/agent';
import { createOllama } from 'ollama-ai-provider';

import type { LanguageModel, LanguageModelUsage } from 'ai';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { Project } from '@/project/project';

export const loadOllamaModels = async (profile: ProviderProfile, modelsInfo: Record<string, ModelInfo>): Promise<LoadModelsResponse> => {
  if (!isOllamaProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider as OllamaProvider;
  const baseUrl = provider.baseUrl || '';
  const environmentVariable = getEffectiveEnvironmentVariable('OLLAMA_API_BASE', undefined);
  const effectiveBaseUrl = baseUrl || environmentVariable?.value || '';

  if (!effectiveBaseUrl) {
    return { models: [], success: false };
  }

  try {
    let normalized = effectiveBaseUrl.replace(/\/+$/, ''); // Remove all trailing slashes
    if (!normalized.endsWith('/api')) {
      normalized = `${normalized}/api`;
    }
    const response = await fetch(`${normalized}/tags`);
    if (!response.ok) {
      const errorMsg = `Ollama models API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
      logger.warn(errorMsg);
      return { models: [], success: false, error: errorMsg };
    }

    const data = await response.json();
    const models =
      data?.models?.map((m: { name: string }) => {
        const modelParts = m.name.split('/');
        const info = modelsInfo[modelParts[modelParts.length - 1]];
        return {
          id: m.name,
          providerId: profile.id,
          ...info, // Merge with existing model info if available
        };
      }) || [];
    logger.info(`Loaded ${models.length} Ollama models from ${effectiveBaseUrl} for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error loading Ollama models';
    logger.error('Error loading Ollama models:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

export const hasOllamaEnvVars = (projectDir?: string, settings?: SettingsData): boolean => {
  return !!getEffectiveEnvironmentVariable('OLLAMA_API_BASE', projectDir, settings)?.value;
};

export const getOllamaAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  const ollamaProvider = provider.provider as OllamaProvider;
  const envVars: Record<string, string> = {};

  if (ollamaProvider.baseUrl) {
    const ollamaBaseUrl = ollamaProvider.baseUrl;
    envVars.OLLAMA_API_BASE = ollamaBaseUrl.endsWith('/api') ? ollamaBaseUrl.slice(0, -4) : ollamaBaseUrl;
  }

  return {
    modelName: `ollama/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
export const createOllamaLlm = (profile: ProviderProfile, model: string, env: Record<string, string | undefined> = {}): LanguageModel => {
  const provider = profile.provider as OllamaProvider;
  const baseUrl = provider.baseUrl || env['OLLAMA_API_BASE'];

  if (!baseUrl) {
    throw new Error('Base URL is required for Ollama provider. Set it in Providers settings or via the OLLAMA_API_BASE environment variable.');
  }

  const ollamaInstance = createOllama({
    baseURL: baseUrl,
    headers: profile.headers,
  });
  return ollamaInstance(model, {
    simulateStreaming: true,
  });
};

// === Cost and Usage Functions ===
export const calculateOllamaCost = (modelInfo: ModelInfo | undefined, sentTokens: number, receivedTokens: number, _providerMetadata?: unknown): number => {
  if (!modelInfo) {
    return 0;
  }

  // Standard cost calculation without caching adjustments
  const inputCost = sentTokens * modelInfo.inputCostPerToken;
  const outputCost = receivedTokens * modelInfo.outputCostPerToken;

  return inputCost + outputCost;
};

export const getOllamaUsageReport = (
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
export const ollamaProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createOllamaLlm,
  calculateCost: calculateOllamaCost,
  getUsageReport: getOllamaUsageReport,

  // Model discovery functions
  loadModels: loadOllamaModels,
  hasEnvVars: hasOllamaEnvVars,
  getAiderMapping: getOllamaAiderMapping,
};
