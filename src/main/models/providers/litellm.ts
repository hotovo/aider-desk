import { isLitellmProvider, LitellmProvider } from '@common/agent';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { Model, ProviderProfile, SettingsData } from '@common/types';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { createStrategyFromDescriptor } from '@/models/providers/strategy-factory';
import { normalizeError } from '@/models/providers/shared';

interface LiteLLMModelInfo {
  model_name: string;
  id?: string;
  max_tokens?: number;
  max_input_tokens?: number;
  max_output_tokens?: number;
  context_window?: number;
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  litellm_params?: {
    max_tokens?: number;
    max_input_tokens?: number;
    max_output_tokens?: number;
    context_window?: number;
    input_cost_per_token?: number;
    output_cost_per_token?: number;
  };
  model_info?: {
    max_tokens?: number;
    max_input_tokens?: number;
    max_output_tokens?: number;
    context_window?: number;
    input_cost_per_token?: number;
    output_cost_per_token?: number;
  };
}

const getValue = (
  info: LiteLLMModelInfo,
  key: 'context_window' | 'max_input_tokens' | 'max_output_tokens' | 'max_tokens' | 'input_cost_per_token' | 'output_cost_per_token',
) => {
  return info[key] ?? info.model_info?.[key] ?? info.litellm_params?.[key];
};

export const loadLitellmModels = async (profile: ProviderProfile, settings: SettingsData): Promise<LoadModelsResponse> => {
  if (!isLitellmProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider as LitellmProvider;
  const apiKey = provider.apiKey || '';
  const baseUrl = provider.baseUrl;

  const apiKeyEnv = getEffectiveEnvironmentVariable('LITELLM_API_KEY', settings);
  const baseUrlEnv = getEffectiveEnvironmentVariable('LITELLM_API_BASE', settings);

  const effectiveApiKey = apiKey || apiKeyEnv?.value;
  const effectiveBaseUrl = baseUrl || baseUrlEnv?.value;

  if (!effectiveBaseUrl) {
    return { models: [], success: false };
  }

  try {
    // Fetch /model/info for detailed pricing and config
    // This is required for LiteLLM provider
    let modelInfos: LiteLLMModelInfo[] = [];

    const infoResponse = await fetch(`${effectiveBaseUrl}/model/info`, {
      headers: { Authorization: `Bearer ${effectiveApiKey}` },
    });

    if (!infoResponse.ok) {
      const errorMsg = `LiteLLM /model/info API response failed: ${infoResponse.status} ${infoResponse.statusText} ${await infoResponse.text()}`;
      logger.error(errorMsg);
      return { models: [], success: false, error: errorMsg };
    }

    const infoData = await infoResponse.json();
    if (infoData && typeof infoData === 'object') {
      if ('data' in infoData && Array.isArray(infoData.data)) {
        modelInfos = infoData.data;
      } else if (Array.isArray(infoData)) {
        modelInfos = infoData;
      } else {
        // Sometimes it might return a map directly
        modelInfos = Object.values(infoData);
      }
    }

    if (modelInfos.length === 0) {
      logger.warn('LiteLLM /model/info returned no models');
      return { models: [], success: true };
    }

    // Group by model_name to handle load balancing
    const modelsByName: Record<string, LiteLLMModelInfo[]> = {};

    modelInfos.forEach((info) => {
      const name = info.model_name;
      if (name) {
        if (!modelsByName[name]) {
          modelsByName[name] = [];
        }
        modelsByName[name].push(info);
      }
    });

    const models: Model[] = Object.entries(modelsByName).map(([name, infos]) => {
      // Aggregate values across all backends for this model name
      // For limits (context window, max output), use MIN to be safe
      // For costs, use MAX to be safe/conservative

      const contextWindows = infos.map((i) => getValue(i, 'context_window') || getValue(i, 'max_input_tokens')).filter((v) => typeof v === 'number');
      const maxOutputs = infos.map((i) => getValue(i, 'max_output_tokens') || getValue(i, 'max_tokens')).filter((v) => typeof v === 'number');
      const inputCosts = infos.map((i) => getValue(i, 'input_cost_per_token')).filter((v) => typeof v === 'number');
      const outputCosts = infos.map((i) => getValue(i, 'output_cost_per_token')).filter((v) => typeof v === 'number');

      const maxInputTokens = contextWindows.length > 0 ? Math.min(...contextWindows) : undefined;
      const maxOutputTokensLimit = maxOutputs.length > 0 ? Math.min(...maxOutputs) : undefined;
      const inputCostPerToken = inputCosts.length > 0 ? Math.max(...inputCosts) : undefined;
      const outputCostPerToken = outputCosts.length > 0 ? Math.max(...outputCosts) : undefined;

      return {
        id: name,
        providerId: profile.id,
        maxInputTokens,
        maxOutputTokensLimit,
        inputCostPerToken,
        outputCostPerToken,
      } satisfies Model;
    });

    logger.info(`Loaded ${models.length} LiteLLM models from /model/info for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = normalizeError(error, 'Unknown error loading LiteLLM models');
    logger.error('Error loading LiteLLM models:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

const getLitellmAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  const litellmProvider = provider.provider as LitellmProvider;
  const envVars: Record<string, string> = {};

  if (litellmProvider.apiKey) {
    envVars.LITELLM_API_KEY = litellmProvider.apiKey;
  }
  if (litellmProvider.baseUrl) {
    // Ensure no trailing slash to avoid double slashes if Aider appends paths
    envVars.LITELLM_API_BASE = litellmProvider.baseUrl.replace(/\/$/, '');
  }

  return {
    modelName: `litellm/${modelId}`,
    environmentVariables: envVars,
  };
};

export const litellmProviderStrategy: LlmProviderStrategy = createStrategyFromDescriptor({
  name: 'litellm',
  label: 'LiteLLM',
  sdkFactory: createOpenAICompatible,
  // dummy key for the OpenAI-compatible client, which expects a key
  extraFactoryOptions: ({ apiKey }) => ({ name: 'litellm', includeUsage: true, ...(apiKey ? {} : { apiKey: 'sk-dummy' }) }),
  apiKeyEnv: 'LITELLM_API_KEY',
  // the API key is optional here; the shared client gets a dummy key when unset
  apiKeyRequired: null,
  baseUrl: {
    envKey: 'LITELLM_API_BASE',
    required: 'Base URL is required for LiteLLM provider',
  },
  hasEnvKeys: ['LITELLM_API_BASE'],
  overrides: {
    loadModels: loadLitellmModels,
    getAiderMapping: getLitellmAiderMapping,
  },
});
