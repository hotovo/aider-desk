import { createAzure } from '@ai-sdk/azure';
import { ModelInfo, ProviderProfile, SettingsData, UsageReportData } from '@common/types';
import { AZURE_DEFAULT_API_VERSION, AzureProvider, isAzureProvider } from '@common/agent';

import type { LanguageModel, LanguageModelUsage } from 'ai';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { Project } from '@/project/project';

export const loadAzureModels = async (profile: ProviderProfile, modelsInfo: Record<string, ModelInfo>): Promise<LoadModelsResponse> => {
  if (!isAzureProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider as AzureProvider;
  const apiKey = provider.apiKey || '';
  const environmentVariable = getEffectiveEnvironmentVariable('AZURE_API_KEY', undefined);
  const effectiveApiKey = apiKey || environmentVariable?.value || '';

  if (!effectiveApiKey) {
    return { models: [], success: false };
  }

  const resourceName = provider.resourceName || '';
  const resourceNameEnvVar = getEffectiveEnvironmentVariable('AZURE_RESOURCE_NAME', undefined);
  const baseUrlEnvVar = getEffectiveEnvironmentVariable('AZURE_API_BASE', undefined);
  const effectiveResourceName = resourceName || resourceNameEnvVar?.value || (baseUrlEnvVar?.value ? extractResourceNameFromEndpoint(baseUrlEnvVar.value) : '');

  if (!effectiveResourceName) {
    return { models: [], success: false };
  }

  try {
    const response = await fetch(
      `https://${effectiveResourceName}.openai.azure.com/openai/deployments?api-version=${provider.apiVersion || AZURE_DEFAULT_API_VERSION}`,
      {
        headers: { 'api-key': effectiveApiKey },
      },
    );
    if (!response.ok) {
      const errorMsg = `Azure OpenAI deployments API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
      logger.error(errorMsg, response.status, response.statusText);
      return { models: [], success: false, error: errorMsg };
    }

    const data = await response.json();
    const models =
      data.data?.map((deployment: { model: string; id: string }) => {
        const info = modelsInfo[deployment.model];
        return {
          id: deployment.model,
          providerId: profile.id,
          ...info,
        };
      }) || [];

    logger.info(`Loaded ${models.length} Azure OpenAI models for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error loading Azure OpenAI models';
    logger.error('Error loading Azure OpenAI models:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

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

export const hasAzureEnvVars = (projectDir?: string, settings?: SettingsData): boolean => {
  const apiKey = getEffectiveEnvironmentVariable('AZURE_API_KEY', projectDir, settings)?.value;
  const endpoint = getEffectiveEnvironmentVariable('AZURE_API_BASE', projectDir, settings)?.value;
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
export const createAzureLlm = (profile: ProviderProfile, model: string, env: Record<string, string | undefined> = {}): LanguageModel => {
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
  return azureProvider(model);
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
  loadModels: async () => ({
    models: [],
    success: true,
  }),
  hasEnvVars: hasAzureEnvVars,
  getAiderMapping: getAzureAiderMapping,
};
