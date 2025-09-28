import { AgentProfile, Model, ModelInfo, ProviderProfile, SettingsData, UsageReportData } from '@common/types';
import { isAnthropicProvider, AnthropicProvider, LlmProvider } from '@common/agent';
import { createAnthropic } from '@ai-sdk/anthropic';

import type { LanguageModel, LanguageModelUsage } from 'ai';

import { getEffectiveEnvironmentVariable } from '@/utils';
import { AiderModelMapping, CacheControl, LlmProviderStrategy } from '@/models';
import { Project } from '@/project/project';
import { LoadModelsResponse } from '@/models/types';

export const loadAnthropicModels = async (profile: ProviderProfile, modelsInfo: Record<string, ModelInfo>): Promise<LoadModelsResponse> => {
  if (!isAnthropicProvider(profile.provider)) {
    return {
      models: [],
      success: false,
    };
  }

  const provider = profile.provider;
  const apiKey = provider.apiKey || '';
  const apiKeyEnv = getEffectiveEnvironmentVariable('ANTHROPIC_API_KEY', undefined);

  if (!apiKey && !apiKeyEnv?.value) {
    return { models: [], success: false };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': apiKey || apiKeyEnv?.value || '',
        'anthropic-version': '2023-06-01',
      },
    });
    if (!response.ok) {
      return {
        models: [],
        success: false,
        error: `Anthropic models API response failed: ${response.status} ${response.statusText} ${await response.text()}`,
      };
    }

    const data = await response.json();
    const models =
      data.data?.map((m: { id: string }) => {
        const info = modelsInfo[m.id];
        return {
          id: m.id,
          providerId: profile.id,
          ...info,
        } satisfies Model;
      }) || [];

    return { models, success: true };
  } catch (error) {
    return {
      models: [],
      success: false,
      error: typeof error === 'string' ? error : error instanceof Error ? error.message : JSON.stringify(error),
    };
  }
};

export const hasAnthropicEnvVars = (projectDir?: string, settings?: SettingsData): boolean => {
  return !!getEffectiveEnvironmentVariable('ANTHROPIC_API_KEY', projectDir, settings)?.value;
};

export const getAnthropicAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  const anthropicProvider = provider.provider as AnthropicProvider;
  const envVars: Record<string, string> = {};

  if (anthropicProvider.apiKey) {
    envVars.ANTHROPIC_API_KEY = anthropicProvider.apiKey;
  }

  return {
    modelName: `anthropic/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
export const createAnthropicLlm = (profile: ProviderProfile, model: string, env: Record<string, string | undefined> = {}): LanguageModel => {
  const provider = profile.provider as AnthropicProvider;
  const apiKey = provider.apiKey || env['ANTHROPIC_API_KEY'];

  if (!apiKey) {
    throw new Error('Anthropic API key is required in Providers settings or Aider environment variables (ANTHROPIC_API_KEY)');
  }

  const anthropicProvider = createAnthropic({
    apiKey,
    headers: profile.headers,
  });
  return anthropicProvider(model);
};

type AnthropicMetadata = {
  anthropic: {
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
  };
};

// === Cost and Usage Functions ===
export const calculateAnthropicCost = (modelInfo: ModelInfo | undefined, sentTokens: number, receivedTokens: number, providerMetadata?: unknown): number => {
  if (!modelInfo) {
    return 0;
  }

  const inputCost = sentTokens * modelInfo.inputCostPerToken;
  const outputCost = receivedTokens * modelInfo.outputCostPerToken;
  let cacheCost = 0;

  const { anthropic } = (providerMetadata as AnthropicMetadata) || {};
  if (anthropic) {
    const cacheCreationInputTokens = anthropic.cacheCreationInputTokens ?? 0;
    const cacheReadInputTokens = anthropic.cacheReadInputTokens ?? 0;
    const cacheCreationCost = cacheCreationInputTokens * (modelInfo.cacheWriteInputTokenCost ?? modelInfo.inputCostPerToken);
    const cacheReadCost = cacheReadInputTokens * (modelInfo.cacheReadInputTokenCost ?? 0);
    cacheCost = cacheCreationCost + cacheReadCost;
  }

  return inputCost + outputCost + cacheCost;
};

export const getAnthropicUsageReport = (
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

  const { anthropic } = (providerMetadata as AnthropicMetadata) || {};
  if (anthropic) {
    usageReportData.cacheWriteTokens = anthropic.cacheCreationInputTokens;
    usageReportData.cacheReadTokens = anthropic.cacheReadInputTokens;
  }

  return usageReportData;
};

// === Configuration Helper Functions ===
export const getAnthropicCacheControl = (_profile: AgentProfile, _provider: LlmProvider): CacheControl => {
  return {
    anthropic: {
      cacheControl: { type: 'ephemeral' },
    },
  };
};

// === Complete Strategy Implementation ===
export const anthropicProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createAnthropicLlm,
  calculateCost: calculateAnthropicCost,
  getUsageReport: getAnthropicUsageReport,

  // Model discovery functions
  loadModels: loadAnthropicModels,
  hasEnvVars: hasAnthropicEnvVars,
  getAiderMapping: getAnthropicAiderMapping,

  // Configuration helpers
  getCacheControl: getAnthropicCacheControl,
};
