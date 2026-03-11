import { Model, ProviderProfile, SettingsData } from '@common/types';
import { isAlibabaPlanProvider, AlibabaPlanProvider, LlmProvider } from '@common/agent';
import { createAlibaba } from '@ai-sdk/alibaba';

import type { LanguageModelV2, SharedV2ProviderOptions } from '@ai-sdk/provider';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { getDefaultUsageReport } from '@/models/providers/default';

const ALIBABA_PLAN_BASE_URL = 'https://coding-intl.dashscope.aliyuncs.com/v1';

const ALIBABA_PLAN_MODELS = [
  { id: 'qwen3.5-plus', maxInputTokens: 1000000, maxOutputTokensLimit: 65536 },
  { id: 'qwen3-max-2026-01-23', maxInputTokens: 262144, maxOutputTokensLimit: 65536 },
  { id: 'qwen3-coder-next', maxInputTokens: 262144, maxOutputTokensLimit: 65536 },
  { id: 'qwen3-coder-plus', maxInputTokens: 1000000, maxOutputTokensLimit: 65536 },
  { id: 'MiniMax-M2.5', maxInputTokens: 204800, maxOutputTokensLimit: 131072 },
  { id: 'glm-5', maxInputTokens: 202752, maxOutputTokensLimit: 16384 },
  { id: 'glm-4.7', maxInputTokens: 202752, maxOutputTokensLimit: 16384 },
  { id: 'kimi-k2.5', maxInputTokens: 262144, maxOutputTokensLimit: 32768 },
];

const loadAlibabaPlanModels = async (profile: ProviderProfile, settings: SettingsData): Promise<LoadModelsResponse> => {
  if (!isAlibabaPlanProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider as AlibabaPlanProvider;
  const apiKey = provider.apiKey || '';
  const apiKeyEnv = getEffectiveEnvironmentVariable('ALIBABA_PLAN_API_KEY', settings);
  const effectiveApiKey = apiKey || apiKeyEnv?.value;

  if (!effectiveApiKey) {
    return { models: [], success: false };
  }

  const models: Model[] = ALIBABA_PLAN_MODELS.map((model) => ({
    id: model.id,
    providerId: profile.id,
    maxInputTokens: model.maxInputTokens,
    maxOutputTokensLimit: model.maxOutputTokensLimit,
  }));

  logger.info(`Loaded ${models.length} Alibaba plan models for profile ${profile.id}`);
  return { models, success: true };
};

const hasAlibabaPlanEnvVars = (settings: SettingsData): boolean => {
  return !!getEffectiveEnvironmentVariable('ALIBABA_PLAN_API_KEY', settings, undefined)?.value;
};

const getAlibabaPlanAiderMapping = (provider: ProviderProfile, modelId: string, settings: SettingsData, projectDir: string): AiderModelMapping => {
  const alibabaPlanProvider = provider.provider as AlibabaPlanProvider;
  const envVars: Record<string, string> = {};

  let apiKey = alibabaPlanProvider.apiKey;

  if (!apiKey) {
    const effectiveVar = getEffectiveEnvironmentVariable('ALIBABA_PLAN_API_KEY', settings, projectDir);
    if (effectiveVar) {
      apiKey = effectiveVar.value;
    }
  }

  if (apiKey) {
    envVars.OPENAI_API_KEY = apiKey;
  }
  envVars.OPENAI_API_BASE = ALIBABA_PLAN_BASE_URL;

  return {
    modelName: `openai/${modelId}`,
    environmentVariables: envVars,
  };
};

const createAlibabaPlanLlm = (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): LanguageModelV2 => {
  const provider = profile.provider as AlibabaPlanProvider;
  let apiKey = provider.apiKey;

  if (!apiKey) {
    const effectiveVar = getEffectiveEnvironmentVariable('ALIBABA_PLAN_API_KEY', settings, projectDir);
    if (effectiveVar) {
      apiKey = effectiveVar.value;
      logger.debug(`Loaded ALIBABA_PLAN_API_KEY from ${effectiveVar.source}`);
    }
  }

  if (!apiKey) {
    throw new Error(`API key is required for ${provider.name}. Check Providers settings or Aider environment variables (ALIBABA_PLAN_API_KEY).`);
  }

  const alibabaPlanProvider = createAlibaba({
    apiKey,
    baseURL: ALIBABA_PLAN_BASE_URL,
    headers: profile.headers,
  });
  return alibabaPlanProvider(model.id);
};

const getAlibabaPlanProviderOptions = (llmProvider: LlmProvider, model: Model): SharedV2ProviderOptions | undefined => {
  if (isAlibabaPlanProvider(llmProvider)) {
    const providerOverrides = model.providerOverrides as Partial<AlibabaPlanProvider> | undefined;

    const thinkingEnabled = providerOverrides?.thinkingEnabled ?? llmProvider.thinkingEnabled ?? true;
    const thinkingBudget = providerOverrides?.thinkingBudget ?? llmProvider.thinkingBudget ?? 8192;

    logger.info(`Alibaba Plan provider options: thinkingEnabled=${thinkingEnabled}, thinkingBudget=${thinkingBudget}`);

    return {
      alibaba: {
        enableThinking: thinkingEnabled,
        ...(thinkingEnabled && { thinkingBudget }),
      },
    };
  }

  return undefined;
};

export const alibabaPlanProviderStrategy: LlmProviderStrategy = {
  createLlm: createAlibabaPlanLlm,
  getUsageReport: getDefaultUsageReport,
  loadModels: loadAlibabaPlanModels,
  hasEnvVars: hasAlibabaPlanEnvVars,
  getAiderMapping: getAlibabaPlanAiderMapping,
  getProviderOptions: getAlibabaPlanProviderOptions,
};
