import { Model, ModelInfo, ProviderProfile, SettingsData } from '@common/types';
import { isZaiPlanProvider, LlmProvider, ZaiPlanProvider } from '@common/agent';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import { getDefaultUsageReport } from './default';

import type { LanguageModelV2, SharedV2ProviderOptions } from '@ai-sdk/provider';

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
          temperature: 0.7,
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

  envVars.OPENAI_API_BASE = 'https://api.z.ai/api/coding/paas/v4';

  return {
    modelName: `openai/${modelId}`,
    environmentVariables: envVars,
  };
};

const createZaiPlanLlm = (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): LanguageModelV2 => {
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

const getZaiPlanProviderOptions = (llmProvider: LlmProvider, model: Model): SharedV2ProviderOptions | undefined => {
  if (isZaiPlanProvider(llmProvider)) {
    const providerOverrides = model.providerOverrides as Partial<ZaiPlanProvider> | undefined;
    const includeThoughts = providerOverrides?.includeThoughts ?? llmProvider.includeThoughts ?? true;

    return {
      'zai-plan': {
        thinking: {
          type: includeThoughts ? 'enabled' : 'disabled',
        },
      },
    } as SharedV2ProviderOptions;
  }

  return undefined;
};

export const zaiPlanProviderStrategy: LlmProviderStrategy = {
  createLlm: createZaiPlanLlm,
  getUsageReport: getDefaultUsageReport,

  loadModels: loadZaiPlanModels,
  hasEnvVars: hasZaiPlanEnvVars,
  getAiderMapping: getZaiPlanAiderMapping,
  getModelInfo: getZaiPlanModelInfo,

  getProviderOptions: getZaiPlanProviderOptions,
};
