import { createAzure } from '@ai-sdk/azure';
import { Model, ModelInfo, ProviderProfile, SettingsData, UsageReportData } from '@common/types';
import { AZURE_DEFAULT_API_VERSION, AzureProvider } from '@common/agent';

import type { LanguageModel, LanguageModelUsage } from 'ai';

import { AiderModelMapping, LlmProviderStrategy } from '@/models';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { Project } from '@/project/project';

const extractResourceNameFromEndpoint = (endpoint: string): string => {
  try {
    const url = new URL(endpoint);
    const hostname = url.hostname;
    // Extract resource name from hostname like "resource-name.openai.azure.com"
    const parts = hostname.split('.');
    if (parts.length >= 3 && parts[parts.length - 2] === 'openai' && parts[parts.length - 1] === 'azure') {
      return parts[0];
    }
    return '';
  } catch {
    return '';
  }
};

export const hasAzureEnvVars = (settings: SettingsData): boolean => {
  const apiKey = getEffectiveEnvironmentVariable('AZURE_API_KEY', settings)?.value;
  const endpoint = getEffectiveEnvironmentVariable('AZURE_API_BASE', settings)?.value;
  return !!(apiKey && endpoint);
};

export const getAzureAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  const azureProvider = provider.provider as AzureProvider;
  const envVars: Record<string, string> = {};

  if (azureProvider.apiKey) {
    envVars.AZURE_API_KEY = azureProvider.apiKey;
  }
  if (azureProvider.resourceName) {
    envVars.AZURE_API_BASE = `https://${azureProvider.resourceName}.openai.azure.com/`;
  }
  if (azureProvider.apiVersion) {
    envVars.AZURE_API_VERSION = azureProvider.apiVersion;
  }

  return {
    modelName: `azure/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
export const createAzureLlm = (profile: ProviderProfile, model: Model, env: Record<string, string | undefined> = {}): LanguageModel => {
  const provider = profile.provider as AzureProvider;
  const apiKey = provider.apiKey || env['AZURE_API_KEY'];
  const resourceName = provider.resourceName || (env['AZURE_RESOURCE_NAME'] ? extractResourceNameFromEndpoint(env['AZURE_RESOURCE_NAME']) : '');
  const apiVersion = provider.apiVersion || env['AZURE_API_VERSION'] || AZURE_DEFAULT_API_VERSION;

  if (!apiKey) {
    throw new Error('Azure OpenAI API key is required in Providers settings or Aider environment variables (AZURE_API_KEY)');
  }
  if (!resourceName) {
    throw new Error('Azure OpenAI resource name is required in Providers settings or Aider environment variables (AZURE_API_BASE)');
  }

  const azureProvider = createAzure({
    resourceName,
    apiKey,
    apiVersion,
    headers: profile.headers,
  });
  return azureProvider(model.id);
};

type AzureMetadata = {
  openai: {
    cachedPromptTokens?: number;
  };
};

// === Cost and Usage Functions ===
export const calculateAzureCost = (modelInfo: ModelInfo | undefined, sentTokens: number, receivedTokens: number, providerMetadata?: unknown): number => {
  if (!modelInfo) {
    return 0;
  }

  let inputCost = sentTokens * modelInfo.inputCostPerToken;
  const outputCost = receivedTokens * modelInfo.outputCostPerToken;
  let cacheCost = 0;

  const { openai } = (providerMetadata as AzureMetadata) || {};
  if (openai) {
    const cachedPromptTokens = openai.cachedPromptTokens ?? 0;

    inputCost = (sentTokens - cachedPromptTokens) * modelInfo.inputCostPerToken;
    cacheCost = cachedPromptTokens * (modelInfo.cacheReadInputTokenCost ?? modelInfo.inputCostPerToken);
  }

  return inputCost + outputCost + cacheCost;
};

export const getAzureUsageReport = (
  project: Project,
  provider: ProviderProfile,
  modelId: string,
  messageCost: number,
  usage: LanguageModelUsage,
  providerMetadata?: unknown,
): UsageReportData => {
  const usageReportData: UsageReportData = {
    model: `${provider.id}/${modelId}`,
    sentTokens: usage.promptTokens,
    receivedTokens: usage.completionTokens,
    messageCost,
    agentTotalCost: project.agentTotalCost + messageCost,
  };

  const { openai } = (providerMetadata as AzureMetadata) || {};
  if (openai) {
    usageReportData.cacheReadTokens = openai.cachedPromptTokens;
    usageReportData.sentTokens -= openai.cachedPromptTokens ?? 0;
  }

  return usageReportData;
};

// === Complete Strategy Implementation ===
export const azureProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createAzureLlm,
  calculateCost: calculateAzureCost,
  getUsageReport: getAzureUsageReport,

  // Model discovery functions
  loadModels: async (_profile: ProviderProfile, _modelsInfo: Record<string, ModelInfo>, _settings: SettingsData) => ({
    models: [],
    success: true,
  }),
  hasEnvVars: hasAzureEnvVars,
  getAiderMapping: getAzureAiderMapping,
};
