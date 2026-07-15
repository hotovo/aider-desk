import { Model, ModelInfo, ProviderProfile, ReasoningEffort, SettingsData } from '@common/types';
import { isZaiPlanProvider, LlmProvider, ZaiPlanProvider } from '@common/agent';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import { getDefaultUsageReport } from './default';

import type { SharedV4ProviderOptions } from '@ai-sdk/provider';
import type { LanguageModel } from 'ai';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';

const loadZaiPlanModels = async (profile: ProviderProfile, settings: SettingsData): Promise<LoadModelsResponse> => {
  if (!isZaiPlanProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider as ZaiPlanProvider;
  const apiKey = provider.apiKey || '';

  const apiKeyEnv = getEffectiveEnvironmentVariable('OPENAI_API_KEY', settings);

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
        return {
          id: model.id,
          providerId: profile.id,
          temperature: 0.7, // Default temperature for ZAI models
        } satisfies Model;
      }) || [];

    logger.info(`Loaded ${models.length} ZAI models for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error loading ZAI models';
    logger.warn('Failed to fetch ZAI models via API:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

const hasZaiPlanEnvVars = (): boolean => false;

const getZaiPlanAiderMapping = (provider: ProviderProfile, modelId: string, settings: SettingsData, projectDir: string): AiderModelMapping => {
  const zaiProvider = provider.provider as ZaiPlanProvider;
  const envVars: Record<string, string> = {};

  if (zaiProvider.apiKey) {
    envVars.OPENAI_API_KEY = zaiProvider.apiKey;
  } else {
    const effectiveVar = getEffectiveEnvironmentVariable('ZAI_API_KEY', settings, projectDir);
    if (effectiveVar) {
      envVars.OPENAI_API_KEY = effectiveVar.value;
    }
  }

  // Set the base URL for ZAI Plan
  envVars.OPENAI_API_BASE = 'https://api.z.ai/api/coding/paas/v4';

  // Use zai-plan prefix for ZAI providers
  return {
    modelName: `openai/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
const createZaiPlanLlm = (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): LanguageModel => {
  const provider = profile.provider as ZaiPlanProvider;
  let apiKey = provider.apiKey;

  if (!apiKey) {
    const effectiveVar = getEffectiveEnvironmentVariable('ZAI_API_KEY', settings, projectDir);
    if (effectiveVar) {
      apiKey = effectiveVar.value;
      logger.debug(`Loaded ZAI_API_KEY from ${effectiveVar.source}`);
    }
  }

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

const getZaiPlanModelInfo = (_provider: ProviderProfile, modelId: string, allModelInfos: Record<string, ModelInfo>): ModelInfo | undefined => {
  const fullModelId = `zai-coding-plan/${modelId}`;
  return allModelInfos[fullModelId];
};

const getZaiPlanProviderOptions = (llmProvider: LlmProvider, model: Model): SharedV4ProviderOptions | undefined => {
  if (isZaiPlanProvider(llmProvider)) {
    const providerOverrides = model.providerOverrides as Partial<ZaiPlanProvider> | undefined;
    const thinkingEnabled = providerOverrides?.thinkingEnabled ?? llmProvider.thinkingEnabled ?? true;
    const reasoningEffort = providerOverrides?.reasoningEffort ?? llmProvider.reasoningEffort ?? ReasoningEffort.Max;

    // Only disable thinking if explicitly set to false
    if (thinkingEnabled === false) {
      return {
        'zai-plan': {
          thinking: {
            type: 'disabled',
          },
        },
      } as SharedV4ProviderOptions;
    }

    const mappedReasoningEffort = reasoningEffort === ReasoningEffort.None ? undefined : (reasoningEffort.toLowerCase() as 'max' | 'high');

    if (mappedReasoningEffort) {
      return {
        'zai-plan': {
          reasoningEffort: mappedReasoningEffort,
        },
      } as SharedV4ProviderOptions;
    }
  }

  return undefined;
};

// === Complete Strategy Implementation ===
export const zaiPlanProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createZaiPlanLlm,
  getUsageReport: getDefaultUsageReport,

  // Model discovery functions
  loadModels: loadZaiPlanModels,
  hasEnvVars: hasZaiPlanEnvVars,
  getAiderMapping: getZaiPlanAiderMapping,
  getModelInfo: getZaiPlanModelInfo,

  getProviderOptions: getZaiPlanProviderOptions,
};
