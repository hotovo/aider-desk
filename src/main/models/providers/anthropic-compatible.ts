import { isAnthropicCompatibleProvider, LlmProvider, AnthropicCompatibleProvider } from '@common/agent';
import { createAnthropic } from '@ai-sdk/anthropic';
import { Model, Reasoning, ProviderProfile, SettingsData, TlsPolicyRegistrar } from '@common/types';

import type { SharedV4ProviderOptions } from '@ai-sdk/provider';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { syncProviderTlsRule } from '@/models/utils';
import { getAnthropicAdaptiveThinkingOptions, ensureV1Suffix, normalizeError, stripV1Suffix } from '@/models/providers/shared';
import { getAnthropicCacheControl } from '@/models/providers/anthropic';
import { createStrategyFromDescriptor } from '@/models/providers/strategy-factory';

// loadModels keeps its Anthropic-specific fetch: x-api-key + anthropic-version headers
const loadAnthropicCompatibleModels = async (
  profile: ProviderProfile,
  settings: SettingsData,
  tlsRegistrar?: TlsPolicyRegistrar,
): Promise<LoadModelsResponse> => {
  if (!isAnthropicCompatibleProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider as AnthropicCompatibleProvider;
  const apiKey = provider.apiKey || '';
  const baseUrl = provider.baseUrl;

  const apiKeyEnv = getEffectiveEnvironmentVariable('ANTHROPIC_API_KEY', settings);
  const baseUrlEnv = getEffectiveEnvironmentVariable('ANTHROPIC_API_BASE', settings);

  const effectiveApiKey = apiKey || apiKeyEnv?.value;
  const effectiveBaseUrl = baseUrl || baseUrlEnv?.value;

  if (!(effectiveApiKey && effectiveBaseUrl)) {
    return { models: [], success: false };
  }

  syncProviderTlsRule(tlsRegistrar, effectiveBaseUrl, provider.sslVerify, provider.caCertPath);

  try {
    const response = await fetch(`${ensureV1Suffix(effectiveBaseUrl)}/models`, {
      headers: {
        'x-api-key': effectiveApiKey,
        'anthropic-version': '2023-06-01',
      },
    });
    if (!response.ok) {
      const errorMsg = `Anthropic-compatible models API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
      logger.debug(errorMsg);
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

    logger.info(`Loaded ${models.length} Anthropic-compatible models for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = normalizeError(error, 'Unknown error loading Anthropic-compatible models');
    logger.warn('Failed to fetch Anthropic-compatible models via API:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

const getAnthropicCompatibleAiderMapping = (provider: ProviderProfile, modelId: string, settings: SettingsData, projectDir: string): AiderModelMapping => {
  const compatibleProvider = provider.provider as AnthropicCompatibleProvider;
  const envVars: Record<string, string> = {};

  let apiKey = compatibleProvider.apiKey;
  let baseUrl = compatibleProvider.baseUrl;

  if (!apiKey) {
    const effectiveVar = getEffectiveEnvironmentVariable('ANTHROPIC_API_KEY', settings, projectDir);
    if (effectiveVar) {
      apiKey = effectiveVar.value;
    }
  }

  if (!baseUrl) {
    const effectiveVar = getEffectiveEnvironmentVariable('ANTHROPIC_API_BASE', settings, projectDir);
    if (effectiveVar) {
      baseUrl = effectiveVar.value;
    }
  }

  if (apiKey) {
    envVars.ANTHROPIC_API_KEY = apiKey;
  }
  if (baseUrl) {
    envVars.ANTHROPIC_BASE_URL = stripV1Suffix(baseUrl);
  }

  // Use anthropic prefix for Anthropic-compatible providers
  return {
    modelName: `anthropic/${modelId}`,
    environmentVariables: envVars,
  };
};

export const getAnthropicCompatibleProviderOptions = (llmProvider: LlmProvider, _model: Model, reasoning?: Reasoning): SharedV4ProviderOptions | undefined => {
  if (!isAnthropicCompatibleProvider(llmProvider) || (reasoning && reasoning !== 'provider-default')) {
    return undefined;
  }

  return getAnthropicAdaptiveThinkingOptions();
};

export const anthropicCompatibleProviderStrategy: LlmProviderStrategy = createStrategyFromDescriptor({
  name: 'anthropic-compatible',
  label: 'Anthropic-compatible',
  sdkFactory: createAnthropic,
  apiKeyEnv: 'ANTHROPIC_API_KEY',
  apiKeyRequired: (provider) => `API key is required for ${provider.name}. Check Providers settings or Aider environment variables (ANTHROPIC_API_KEY).`,
  baseUrl: {
    envKey: 'ANTHROPIC_API_BASE',
    required: (provider) =>
      `Base URL is required for ${provider.name} provider. Set it in Providers settings or via the ANTHROPIC_API_BASE environment variable.`,
    // The @ai-sdk/anthropic SDK only appends `/messages` to the baseURL, so it must include /v1
    transform: ensureV1Suffix,
  },
  tlsSync: true,
  isProvider: isAnthropicCompatibleProvider,
  hasEnvKeys: ['ANTHROPIC_API_KEY', 'ANTHROPIC_API_BASE'],
  overrides: {
    loadModels: loadAnthropicCompatibleModels,
    getAiderMapping: getAnthropicCompatibleAiderMapping,
    getCacheControl: getAnthropicCacheControl,
    getProviderOptions: getAnthropicCompatibleProviderOptions,
  },
});
