import { Model, ProviderProfile, SettingsData } from '@common/types';
import { isKimiPlanProvider, KimiPlanProvider } from '@common/agent';
import { createAnthropic } from '@ai-sdk/anthropic';

import type { LanguageModelV2 } from '@ai-sdk/provider';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { getAnthropicCacheControl, getAnthropicUsageReport } from '@/models/providers/anthropic';

const KIMI_PLAN_BASE_URL = 'https://api.kimi.com/coding/v1';
const KIMI_PLAN_MODEL_ID = 'k2p5';

const loadKimiPlanModels = async (profile: ProviderProfile, settings: SettingsData): Promise<LoadModelsResponse> => {
  if (!isKimiPlanProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider as KimiPlanProvider;
  const apiKey = provider.apiKey || '';
  const apiKeyEnv = getEffectiveEnvironmentVariable('KIMI_PLAN_API_KEY', settings);
  const effectiveApiKey = apiKey || apiKeyEnv?.value;

  if (!effectiveApiKey) {
    return { models: [], success: false };
  }

  // Return hardcoded model instead of fetching from API
  const models: Model[] = [
    {
      id: KIMI_PLAN_MODEL_ID,
      providerId: profile.id,
      maxInputTokens: 262144,
      maxOutputTokensLimit: 32768,
    },
  ];

  logger.info(`Loaded ${models.length} Kimi plan models for profile ${profile.id}`);
  return { models, success: true };
};

const hasKimiPlanEnvVars = (settings: SettingsData): boolean => {
  return !!getEffectiveEnvironmentVariable('KIMI_PLAN_API_KEY', settings, undefined)?.value;
};

const getKimiPlanAiderMapping = (provider: ProviderProfile, modelId: string, settings: SettingsData, projectDir: string): AiderModelMapping => {
  const kimiPlanProvider = provider.provider as KimiPlanProvider;
  const envVars: Record<string, string> = {};

  let apiKey = kimiPlanProvider.apiKey;

  if (!apiKey) {
    const effectiveVar = getEffectiveEnvironmentVariable('KIMI_PLAN_API_KEY', settings, projectDir);
    if (effectiveVar) {
      apiKey = effectiveVar.value;
    }
  }

  if (apiKey) {
    envVars.ANTHROPIC_API_KEY = apiKey;
  }
  // remove /v1 from the end of the base url for LiteLLM compatibility
  envVars.ANTHROPIC_BASE_URL = KIMI_PLAN_BASE_URL.slice(0, -3);

  // Use anthropic prefix for Kimi since it uses Anthropic-compatible API
  return {
    modelName: `anthropic/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
const createKimiPlanLlm = (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): LanguageModelV2 => {
  const provider = profile.provider as KimiPlanProvider;
  let apiKey = provider.apiKey;

  if (!apiKey) {
    const effectiveVar = getEffectiveEnvironmentVariable('KIMI_PLAN_API_KEY', settings, projectDir);
    if (effectiveVar) {
      apiKey = effectiveVar.value;
      logger.debug(`Loaded KIMI_PLAN_API_KEY from ${effectiveVar.source}`);
    }
  }

  if (!apiKey) {
    throw new Error(`API key is required for ${provider.name}. Check Providers settings or Aider environment variables (KIMI_PLAN_API_KEY).`);
  }

  // Use createAnthropic with Kimi's base URL
  const kimiPlanProvider = createAnthropic({
    apiKey,
    baseURL: KIMI_PLAN_BASE_URL,
    headers: profile.headers,
  });
  return kimiPlanProvider(model.id);
};

// === Complete Strategy Implementation ===
export const kimiPlanProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createKimiPlanLlm,
  getUsageReport: getAnthropicUsageReport,

  // Model discovery functions
  loadModels: loadKimiPlanModels,
  hasEnvVars: hasKimiPlanEnvVars,
  getAiderMapping: getKimiPlanAiderMapping,

  // Cache control
  getCacheControl: getAnthropicCacheControl,
};
