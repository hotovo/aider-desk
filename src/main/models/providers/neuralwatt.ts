import { Model, ProviderProfile, SettingsData, UsageReportData } from '@common/types';
import { isNeuralwattProvider, NeuralwattProvider } from '@common/agent';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import type { LanguageModelUsage } from 'ai';
import type { LanguageModelV2 } from '@ai-sdk/provider';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { getDefaultModelInfo, calculateCost } from '@/models/providers/default';
import { Task } from '@/task/task';

const NEURALWATT_BASE_URL = 'https://api.neuralwatt.com/v1';

const loadNeuralwattModels = async (profile: ProviderProfile, settings: SettingsData): Promise<LoadModelsResponse> => {
  if (!isNeuralwattProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider as NeuralwattProvider;
  const apiKey = provider.apiKey || '';
  const apiKeyEnv = getEffectiveEnvironmentVariable('NEURALWATT_API_KEY', settings);
  const effectiveApiKey = apiKey || apiKeyEnv?.value || '';

  if (!effectiveApiKey) {
    logger.debug('Neuralwatt API key is required. Please set it in Providers settings or via NEURALWATT_API_KEY environment variable.');
    return { models: [], success: false };
  }

  try {
    const response = await fetch(`${NEURALWATT_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${effectiveApiKey}` },
    });

    if (!response.ok) {
      const errorMsg = `Neuralwatt models API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
      logger.error(errorMsg, { status: response.status, statusText: response.statusText });
      return { models: [], success: false, error: errorMsg };
    }

    const data = await response.json();
    const models =
      data.data?.map((model: { id: string }) => {
        return {
          id: model.id,
          providerId: profile.id,
        } satisfies Model;
      }) || [];

    logger.info(`Loaded ${models.length} Neuralwatt models for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error loading Neuralwatt models';
    logger.error('Error loading Neuralwatt models:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

const hasNeuralwattEnvVars = (settings: SettingsData): boolean => {
  return !!getEffectiveEnvironmentVariable('NEURALWATT_API_KEY', settings, undefined)?.value;
};

const getNeuralwattAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  const neuralwattProvider = provider.provider as NeuralwattProvider;
  const envVars: Record<string, string> = {};

  if (neuralwattProvider.apiKey) {
    envVars.OPENAI_API_KEY = neuralwattProvider.apiKey;
  }

  envVars.OPENAI_API_BASE = NEURALWATT_BASE_URL;

  return {
    modelName: `openai/${modelId}`,
    environmentVariables: envVars,
  };
};

const createNeuralwattLlm = (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): LanguageModelV2 => {
  const provider = profile.provider as NeuralwattProvider;
  let apiKey = provider.apiKey;

  if (!apiKey) {
    const effectiveVar = getEffectiveEnvironmentVariable('NEURALWATT_API_KEY', settings, projectDir);
    if (effectiveVar) {
      apiKey = effectiveVar.value;
      logger.debug(`Loaded NEURALWATT_API_KEY from ${effectiveVar.source}`);
    }
  }

  if (!apiKey) {
    throw new Error('Neuralwatt API key is required in Providers settings or Aider environment variables (NEURALWATT_API_KEY)');
  }

  const compatibleProvider = createOpenAICompatible({
    name: 'neuralwatt',
    apiKey,
    baseURL: NEURALWATT_BASE_URL,
    headers: profile.headers,
  });
  return compatibleProvider(model.id);
};

const getNeuralwattUsageReport = (
  task: Task,
  provider: ProviderProfile,
  model: Model,
  usage: LanguageModelUsage,
  providerMetadata?: unknown,
): UsageReportData => {
  const totalSentTokens = usage.inputTokens || 0;
  const receivedTokens = usage.outputTokens || 0;
  const cacheReadTokens = usage.cachedInputTokens || 0;
  const sentTokens = totalSentTokens - cacheReadTokens;

  logger.info('Neuralwatt usage report', {
    providerMetadata,
    usage,
  });

  const messageCost = calculateCost(model, sentTokens, receivedTokens, cacheReadTokens);

  return {
    model: `${provider.id}/${model.id}`,
    sentTokens,
    receivedTokens,
    cacheReadTokens,
    messageCost,
    agentTotalCost: task.task.agentTotalCost + messageCost,
  };
};

export const neuralwattProviderStrategy: LlmProviderStrategy = {
  createLlm: createNeuralwattLlm,
  getUsageReport: getNeuralwattUsageReport,
  loadModels: loadNeuralwattModels,
  hasEnvVars: hasNeuralwattEnvVars,
  getAiderMapping: getNeuralwattAiderMapping,
  getModelInfo: getDefaultModelInfo,
};
