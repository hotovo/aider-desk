import { ClinePassProvider, isClinePassProvider } from '@common/agent';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { Model, ProviderProfile, SettingsData } from '@common/types';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { createStrategyFromDescriptor } from '@/models/providers/strategy-factory';
import { normalizeError } from '@/models/providers/shared';
import { MINIMAX_M3_MODEL_PRICING } from '@/models/providers/minimax';

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
    ...MINIMAX_M3_MODEL_PRICING,
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

const clinePassStaticModels = (profile: ProviderProfile): Model[] => CLINEPASS_MODELS.map((m) => toClinePassModel(m, profile.id));

// ClinePass consults CLINE_API_KEY even when provider.apiKey is set
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
    const models = clinePassStaticModels(profile);
    return { models, success: true };
  }

  try {
    const response = await fetch(`${CLINEPASS_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      const errorMsg = `ClinePass models API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
      logger.debug(errorMsg);
      return { models: clinePassStaticModels(profile), success: true };
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
      return { models: clinePassStaticModels(profile), success: true };
    }

    logger.info(`Loaded ${models.length} ClinePass models for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = normalizeError(error, 'Unknown error loading ClinePass models');
    logger.warn('Failed to fetch ClinePass models via API:', error);
    return { models: clinePassStaticModels(profile), success: true, error: errorMsg };
  }
};

const getClinePassAiderMapping = (provider: ProviderProfile, modelId: string, settings: SettingsData, projectDir: string): AiderModelMapping => {
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

export const clinePassProviderStrategy: LlmProviderStrategy = createStrategyFromDescriptor({
  name: 'clinepass',
  label: 'ClinePass',
  sdkFactory: createOpenAICompatible,
  apiKeyEnv: 'CLINE_API_KEY',
  apiKeyRequired: () => 'ClinePass API key is required in Providers settings or Aider environment variables (CLINE_API_KEY)',
  credResolver: ({ provider, settings, projectDir }) => resolveApiKey(provider as unknown as ClinePassProvider, settings, projectDir),
  fixedBaseURL: CLINEPASS_BASE_URL,
  extraFactoryOptions: () => ({ name: 'clinepass' }),
  createModelId: (model) => `cline-pass/${model.id}`,
  isProvider: isClinePassProvider,
  overrides: {
    loadModels: loadClinePassModels,
    getAiderMapping: getClinePassAiderMapping,
  },
});
