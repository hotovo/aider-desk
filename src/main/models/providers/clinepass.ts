import { Model, ProviderProfile, SettingsData } from '@common/types';
import { ClinePassProvider, isClinePassProvider } from '@common/agent';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import type { LanguageModelV2 } from '@ai-sdk/provider';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { getDefaultModelInfo, getDefaultUsageReport } from '@/models/providers/default';

const CLINEPASS_BASE_URL = 'https://api.cline.bot/api/v1';

interface ClinePassModelMetadata {
  id: string;
  maxInputTokens: number;
  inputCostPerToken: number;
  outputCostPerToken: number;
  cacheReadInputTokenCost: number;
  cacheWriteInputTokenCost?: number;
}

const CLINEPASS_MODELS: ClinePassModelMetadata[] = [
  {
    id: 'glm-5.2',
    maxInputTokens: 200000,
    inputCostPerToken: 0.0000014, // $1.40 per 1M
    outputCostPerToken: 0.0000044, // $4.40 per 1M
    cacheReadInputTokenCost: 0.00000026, // $0.26 per 1M
  },
  {
    id: 'kimi-k2.7-code',
    maxInputTokens: 262144,
    inputCostPerToken: 0.00000095, // $0.95 per 1M
    outputCostPerToken: 0.000004, // $4.00 per 1M
    cacheReadInputTokenCost: 0.00000019, // $0.19 per 1M
  },
  {
    id: 'kimi-k2.6',
    maxInputTokens: 262144,
    inputCostPerToken: 0.00000095, // $0.95 per 1M
    outputCostPerToken: 0.000004, // $4.00 per 1M
    cacheReadInputTokenCost: 0.00000016, // $0.16 per 1M
  },
  {
    id: 'deepseek-v4-pro',
    maxInputTokens: 1000000,
    inputCostPerToken: 0.00000174, // $1.74 per 1M
    outputCostPerToken: 0.00000348, // $3.48 per 1M
    cacheReadInputTokenCost: 0.0000000145, // $0.0145 per 1M
  },
  {
    id: 'deepseek-v4-flash',
    maxInputTokens: 1000000,
    inputCostPerToken: 0.00000014, // $0.14 per 1M
    outputCostPerToken: 0.00000028, // $0.28 per 1M
    cacheReadInputTokenCost: 0.0000000028, // $0.0028 per 1M
  },
  {
    id: 'mimo-v2.5',
    maxInputTokens: 262144,
    inputCostPerToken: 0.00000014, // $0.14 per 1M
    outputCostPerToken: 0.00000028, // $0.28 per 1M
    cacheReadInputTokenCost: 0.0000000028, // $0.0028 per 1M
  },
  {
    id: 'mimo-v2.5-pro',
    maxInputTokens: 262144,
    inputCostPerToken: 0.00000174, // $1.74 per 1M
    outputCostPerToken: 0.00000348, // $3.48 per 1M
    cacheReadInputTokenCost: 0.0000000145, // $0.0145 per 1M
  },
  {
    id: 'minimax-m3',
    maxInputTokens: 1000000,
    inputCostPerToken: 0.0000003, // $0.30 per 1M
    outputCostPerToken: 0.0000012, // $1.20 per 1M
    cacheReadInputTokenCost: 0.00000006, // $0.06 per 1M
  },
  {
    id: 'qwen3.7-max',
    maxInputTokens: 262144,
    inputCostPerToken: 0.0000025, // $2.50 per 1M
    outputCostPerToken: 0.0000075, // $7.50 per 1M
    cacheReadInputTokenCost: 0.0000005, // $0.50 per 1M
    cacheWriteInputTokenCost: 0.000003125, // $3.125 per 1M
  },
  {
    id: 'qwen3.7-plus',
    maxInputTokens: 1000000,
    inputCostPerToken: 0.0000004, // $0.40 per 1M (≤ 256K tier)
    outputCostPerToken: 0.0000016, // $1.60 per 1M (≤ 256K tier)
    cacheReadInputTokenCost: 0.00000004, // $0.04 per 1M (≤ 256K tier)
    cacheWriteInputTokenCost: 0.0000005, // $0.50 per 1M (≤ 256K tier)
  },
];

const CLINEPASS_MODEL_METADATA_MAP = new Map(CLINEPASS_MODELS.map((m) => [m.id, m]));

const toClinePassModel = (metadata: ClinePassModelMetadata, providerId: string): Model => ({
  id: metadata.id,
  providerId,
  maxInputTokens: metadata.maxInputTokens,
  inputCostPerToken: metadata.inputCostPerToken,
  outputCostPerToken: metadata.outputCostPerToken,
  cacheReadInputTokenCost: metadata.cacheReadInputTokenCost,
  ...(metadata.cacheWriteInputTokenCost != null && { cacheWriteInputTokenCost: metadata.cacheWriteInputTokenCost }),
});

interface ClinePassApiModel {
  id: string;
}

interface ClinePassApiResponse {
  data: ClinePassApiModel[];
}

const resolveApiKey = (provider: ClinePassProvider, settings: SettingsData, projectDir?: string): string => {
  const envKey = getEffectiveEnvironmentVariable('CLINE_API_KEY', settings, projectDir);
  return provider.apiKey || envKey?.value || '';
};

export const loadClinePassModels = async (profile: ProviderProfile, settings: SettingsData): Promise<LoadModelsResponse> => {
  if (!isClinePassProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider;
  const apiKey = resolveApiKey(provider, settings);

  if (!apiKey) {
    logger.debug('ClinePass API key not available, using static model list');
    const models = CLINEPASS_MODELS.map((m) => toClinePassModel(m, profile.id));
    return { models, success: true };
  }

  try {
    const response = await fetch(`${CLINEPASS_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      const errorMsg = `ClinePass models API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
      logger.debug(errorMsg);
      const models = CLINEPASS_MODELS.map((m) => toClinePassModel(m, profile.id));
      return { models, success: true };
    }

    const data: ClinePassApiResponse = await response.json();
    const models =
      data.data
        ?.filter((model: ClinePassApiModel) => model.id.startsWith('cline-pass/'))
        .map((model: ClinePassApiModel) => {
          const strippedId = model.id.replace('cline-pass/', '');
          const metadata = CLINEPASS_MODEL_METADATA_MAP.get(strippedId);
          if (metadata) {
            return toClinePassModel(metadata, profile.id);
          }
          return { id: strippedId, providerId: profile.id } satisfies Model;
        }) || [];

    if (models.length === 0) {
      logger.debug('No models returned from ClinePass API, using static model list');
      const staticModels = CLINEPASS_MODELS.map((m) => toClinePassModel(m, profile.id));
      return { models: staticModels, success: true };
    }

    logger.info(`Loaded ${models.length} ClinePass models for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error loading ClinePass models';
    logger.warn('Failed to fetch ClinePass models via API:', error);
    const models = CLINEPASS_MODELS.map((m) => toClinePassModel(m, profile.id));
    return { models, success: true, error: errorMsg };
  }
};

export const hasClinePassEnvVars = (settings: SettingsData): boolean => {
  return !!getEffectiveEnvironmentVariable('CLINE_API_KEY', settings, undefined)?.value;
};

export const getClinePassAiderMapping = (provider: ProviderProfile, modelId: string, settings: SettingsData, projectDir: string): AiderModelMapping => {
  const clinePassProvider = provider.provider as ClinePassProvider;
  const envVars: Record<string, string> = {
    OPENAI_API_BASE: CLINEPASS_BASE_URL,
  };

  const apiKey = resolveApiKey(clinePassProvider, settings, projectDir);
  if (apiKey) {
    envVars.OPENAI_API_KEY = apiKey;
  }

  return {
    modelName: `openai/cline-pass/${modelId}`,
    environmentVariables: envVars,
  };
};

export const createClinePassLlm = (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): LanguageModelV2 => {
  const provider = profile.provider as ClinePassProvider;
  const apiKey = resolveApiKey(provider, settings, projectDir);

  if (!apiKey) {
    throw new Error('ClinePass API key is required in Providers settings or Aider environment variables (CLINE_API_KEY)');
  }

  const compatibleProvider = createOpenAICompatible({
    name: 'clinepass',
    apiKey,
    baseURL: CLINEPASS_BASE_URL,
    headers: profile.headers,
  });
  return compatibleProvider(`cline-pass/${model.id}`);
};

export const clinePassProviderStrategy: LlmProviderStrategy = {
  createLlm: createClinePassLlm,
  getUsageReport: getDefaultUsageReport,
  loadModels: loadClinePassModels,
  hasEnvVars: hasClinePassEnvVars,
  getAiderMapping: getClinePassAiderMapping,
  getModelInfo: getDefaultModelInfo,
};
