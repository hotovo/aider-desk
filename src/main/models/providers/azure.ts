import { createAzure } from '@ai-sdk/azure';
import { Model, ProviderProfile, ReasoningEffort, SettingsData, Reasoning } from '@common/types';
import { AzureProvider, isAzureProvider, LlmProvider } from '@common/agent';

import type { LanguageModel } from 'ai';
import type { SharedV4ProviderOptions } from '@ai-sdk/provider';

import logger from '@/logger';
import { AiderModelMapping, LlmProviderStrategy } from '@/models';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { getDefaultModelInfo, getDefaultUsageReport } from '@/models/providers/default';
import { getOpenAiFamilyProviderOptions, mergeModelProps } from '@/models/providers/shared';

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
export const createAzureLlm = (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): LanguageModel => {
  const provider = profile.provider as AzureProvider;
  let apiKey = provider.apiKey;
  let resourceName = provider.resourceName;

  if (!apiKey) {
    const effectiveVar = getEffectiveEnvironmentVariable('AZURE_API_KEY', settings, projectDir);
    if (effectiveVar) {
      apiKey = effectiveVar.value;
      logger.debug(`Loaded AZURE_API_KEY from ${effectiveVar.source}`);
    }
  }

  if (!apiKey) {
    throw new Error('Azure OpenAI API key is required in Providers settings or Aider environment variables (AZURE_API_KEY)');
  }

  if (!resourceName) {
    const effectiveVar = getEffectiveEnvironmentVariable('AZURE_API_BASE', settings, projectDir);
    if (effectiveVar?.value) {
      resourceName = extractResourceNameFromEndpoint(effectiveVar.value);
      logger.debug(`Loaded AZURE_API_BASE from ${effectiveVar.source}`);
    }
  }

  if (!resourceName) {
    throw new Error('Azure OpenAI resource name is required in Providers settings or Aider environment variables (AZURE_API_BASE)');
  }

  const azureProvider = createAzure({
    resourceName,
    apiKey,
    headers: profile.headers,
  });
  return azureProvider.responses(model.id);
};

export const getAzureProviderOptions = (llmProvider: LlmProvider, model: Model, reasoning?: Reasoning): SharedV4ProviderOptions | undefined => {
  if (isAzureProvider(llmProvider)) {
    // Extract reasoningEffort from model overrides or provider config
    const { reasoningEffort } = mergeModelProps(model, llmProvider, ['reasoningEffort']);

    return getOpenAiFamilyProviderOptions('openai', reasoningEffort, reasoning);
  }

  return undefined;
};

export const getAzureProviderParameters = (llmProvider: LlmProvider, model: Model, reasoning?: Reasoning): Record<string, unknown> => {
  if (isAzureProvider(llmProvider)) {
    const providerOverrides = model.providerOverrides as Partial<AzureProvider> | undefined;
    const reasoningEffort = providerOverrides?.reasoningEffort ?? llmProvider.reasoningEffort;
    const reasoningEnabled =
      reasoning && reasoning !== 'provider-default' ? reasoning !== 'none' : !!reasoningEffort && reasoningEffort !== ReasoningEffort.None;

    if (reasoningEnabled) {
      logger.debug('Clearing temperature and maxOutputTokens for Azure with reasoning:', { reasoning: reasoning ?? reasoningEffort });
      return {
        // not supported by Azure with reasoning models
        maxOutputTokens: undefined,
        temperature: undefined,
      };
    }
  }

  return {};
};

// === Complete Strategy Implementation ===
export const azureProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createAzureLlm,
  getUsageReport: getDefaultUsageReport,

  // Model discovery functions
  loadModels: async () => ({
    models: [],
    success: true,
  }),
  hasEnvVars: hasAzureEnvVars,
  getAiderMapping: getAzureAiderMapping,
  getProviderOptions: getAzureProviderOptions,
  getProviderParameters: getAzureProviderParameters,
  getModelInfo: getDefaultModelInfo,
};
