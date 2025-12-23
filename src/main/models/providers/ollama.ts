import { Model, ProviderProfile, SettingsData, UsageReportData } from '@common/types';
import { DEFAULT_MODEL_TEMPERATURE, isOllamaProvider, OllamaProvider } from '@common/agent';
import { createOllama } from 'ollama-ai-provider-v2';
import { simulateStreamingMiddleware, wrapLanguageModel } from 'ai';

import type { LanguageModelUsage } from 'ai';
import type { LanguageModelV2 } from '@ai-sdk/provider';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { Task } from '@/task/task';

export const loadOllamaModels = async (profile: ProviderProfile, settings: SettingsData): Promise<LoadModelsResponse> => {
  if (!isOllamaProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider as OllamaProvider;
  const baseUrl = provider.baseUrl || '';
  const environmentVariable = getEffectiveEnvironmentVariable('OLLAMA_API_BASE', settings);
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
        return {
          id: m.name,
          providerId: profile.id,
          temperature: DEFAULT_MODEL_TEMPERATURE,
        } satisfies Model;
      }) || [];
    logger.info(`Loaded ${models.length} Ollama models from ${effectiveBaseUrl} for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error loading Ollama models';
    logger.error('Error loading Ollama models:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

export const hasOllamaEnvVars = (settings: SettingsData): boolean => {
  return !!getEffectiveEnvironmentVariable('OLLAMA_API_BASE', settings, undefined)?.value;
};

export const getOllamaAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  const ollamaProvider = provider.provider as OllamaProvider;
  const envVars: Record<string, string> = {};

  if (ollamaProvider.baseUrl) {
    const ollamaBaseUrl = ollamaProvider.baseUrl;
    envVars.OLLAMA_API_BASE = ollamaBaseUrl.endsWith('/api') ? ollamaBaseUrl.slice(0, -4) : ollamaBaseUrl;
  }

  return {
    modelName: `ollama_chat/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
export const createOllamaLlm = (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): LanguageModelV2 => {
  const provider = profile.provider as OllamaProvider;
  let baseUrl = provider.baseUrl;

  if (!baseUrl) {
    const effectiveVar = getEffectiveEnvironmentVariable('OLLAMA_API_BASE', settings, projectDir);
    if (effectiveVar) {
      baseUrl = effectiveVar.value;
      logger.debug(`Loaded OLLAMA_API_BASE from ${effectiveVar.source}`);
    }
  }

  if (!baseUrl) {
    throw new Error('Base URL is required for Ollama provider. Set it in Providers settings or via the OLLAMA_API_BASE environment variable.');
  }

  let normalized = baseUrl.replace(/\/+$/, ''); // Remove all trailing slashes
  if (!normalized.endsWith('/api')) {
    normalized = `${normalized}/api`;
  }

  const ollamaInstance = createOllama({
    baseURL: normalized,
    headers: profile.headers,
  });
  return wrapLanguageModel({
    model: ollamaInstance(model.id),
    middleware: simulateStreamingMiddleware(),
  });
};

export const getOllamaUsageReport = (task: Task, provider: ProviderProfile, model: Model, usage: LanguageModelUsage): UsageReportData => {
  const totalSentTokens = usage.inputTokens || 0;
  const receivedTokens = usage.outputTokens || 0;
  const cacheReadTokens = usage.cachedInputTokens || 0;
  const sentTokens = totalSentTokens - cacheReadTokens;

  // Cost is always 0 for Ollama
  const messageCost = 0;

  return {
    model: `${provider.id}/${model.id}`,
    sentTokens,
    receivedTokens,
    cacheReadTokens,
    messageCost,
    agentTotalCost: task.task.agentTotalCost + messageCost,
  };
};

// === Complete Strategy Implementation ===
export const ollamaProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createOllamaLlm,
  getUsageReport: getOllamaUsageReport,

  // Model discovery functions
  loadModels: loadOllamaModels,
  hasEnvVars: hasOllamaEnvVars,
  getAiderMapping: getOllamaAiderMapping,
};
