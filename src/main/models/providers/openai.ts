import { createOpenAI } from '@ai-sdk/openai';
import { isOpenAiProvider, OpenAiProvider } from '@common/agent';
import { Model, ModelInfo, ProviderProfile, SettingsData, UsageReportData } from '@common/types';

import type { LanguageModel, LanguageModelUsage } from 'ai';

import logger from '@/logger';
import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import { Project } from '@/project/project';
import { getEffectiveEnvironmentVariable } from '@/utils';

export const loadOpenAiModels = async (
  profile: ProviderProfile,
  modelsInfo: Record<string, ModelInfo>,
  settings: SettingsData,
): Promise<LoadModelsResponse> => {
  if (!isOpenAiProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider as OpenAiProvider;
  const apiKey = provider.apiKey || '';
  const environmentVariable = getEffectiveEnvironmentVariable('OPENAI_API_KEY', settings);
  const effectiveApiKey = apiKey || environmentVariable?.value || '';

  if (!effectiveApiKey) {
    return { models: [], success: false };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${effectiveApiKey}` },
    });
    if (!response.ok) {
      const errorMsg = `OpenAI models API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
      logger.error(errorMsg, response.status, response.statusText);
      return { models: [], success: false, error: errorMsg };
    }

    const data = await response.json();
    const filteredModels =
      data.data?.filter((model: { id: string }) => {
        const id = model.id;
        if (id.startsWith('dall-e') || id.startsWith('gpt-image') || id.startsWith('chatgpt') || id.startsWith('codex')) {
          return false;
        }
        if (id.includes('embedding')) {
          return false;
        }
        if (id.includes('-audio') || id.includes('-realtime')) {
          return false;
        }
        if (id.startsWith('davinci') || id.startsWith('babbage')) {
          return false;
        }
        if (id.startsWith('tts-') || id.startsWith('whisper-')) {
          return false;
        }
        if (id.includes('transcribe') || id.includes('tts') || id.includes('moderation') || id.includes('search')) {
          return false;
        }
        return true;
      }) || [];
    const models =
      filteredModels.map((model: { id: string }) => {
        const info = modelsInfo[model.id];
        return {
          id: model.id,
          providerId: profile.id,
          ...info,
        };
      }) || [];

    logger.info(`Loaded ${models.length} OpenAI models for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error loading OpenAI models';
    logger.error('Error loading OpenAI models:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

export const hasOpenAiEnvVars = (settings: SettingsData): boolean => {
  return !!getEffectiveEnvironmentVariable('OPENAI_API_KEY', settings, undefined)?.value;
};

export const getOpenAiAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  const openaiProvider = provider.provider as OpenAiProvider;
  const envVars: Record<string, string> = {};

  if (openaiProvider.apiKey) {
    envVars.OPENAI_API_KEY = openaiProvider.apiKey;
  }

  return {
    modelName: `openai/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
export const createOpenAiLlm = (profile: ProviderProfile, model: Model, env: Record<string, string | undefined> = {}): LanguageModel => {
  const provider = profile.provider as OpenAiProvider;
  const apiKey = provider.apiKey || env['OPENAI_API_KEY'];

  if (!apiKey) {
    throw new Error('OpenAI API key is required in Providers settings or Aider environment variables (OPENAI_API_KEY)');
  }

  const openAIProvider = createOpenAI({
    apiKey,
    compatibility: 'strict',
    headers: profile.headers,
  });

  const providerOverrides = model.providerOverrides as Partial<OpenAiProvider> | undefined;
  const reasoningEffort = providerOverrides?.reasoningEffort ?? provider.reasoningEffort;

  return openAIProvider(model.id, {
    structuredOutputs: false,
    reasoningEffort: reasoningEffort === undefined ? undefined : (reasoningEffort as 'low' | 'medium' | 'high' | undefined),
  });
};

type OpenAiMetadata = {
  openai: {
    cachedPromptTokens?: number;
  };
};

// === Cost and Usage Functions ===
export const calculateOpenAiCost = (modelInfo: ModelInfo | undefined, sentTokens: number, receivedTokens: number, providerMetadata?: unknown): number => {
  if (!modelInfo) {
    return 0;
  }

  let inputCost = sentTokens * modelInfo.inputCostPerToken;
  const outputCost = receivedTokens * modelInfo.outputCostPerToken;
  let cacheCost = 0;

  const { openai } = (providerMetadata as OpenAiMetadata) || {};
  if (openai) {
    const cachedPromptTokens = openai.cachedPromptTokens ?? 0;

    inputCost = (sentTokens - cachedPromptTokens) * modelInfo.inputCostPerToken;
    cacheCost = cachedPromptTokens * (modelInfo.cacheReadInputTokenCost ?? modelInfo.inputCostPerToken);
  }

  return inputCost + outputCost + cacheCost;
};

export const getOpenAiUsageReport = (
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

  const { openai } = (providerMetadata as OpenAiMetadata) || {};
  if (openai) {
    usageReportData.cacheReadTokens = openai.cachedPromptTokens;
    usageReportData.sentTokens -= openai.cachedPromptTokens ?? 0;
  }

  return usageReportData;
};

// === Complete Strategy Implementation ===
export const openaiProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createOpenAiLlm,
  calculateCost: calculateOpenAiCost,
  getUsageReport: getOpenAiUsageReport,

  // Model discovery functions
  loadModels: loadOpenAiModels,
  hasEnvVars: hasOpenAiEnvVars,
  getAiderMapping: getOpenAiAiderMapping,
};
