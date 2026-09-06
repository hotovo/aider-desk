import { isOpenAiCompatibleProvider, LlmProvider, OpenAiCompatibleProvider } from '@common/agent';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { Model, ProviderProfile, Reasoning, ReasoningEffort, SettingsData, TlsPolicyRegistrar } from '@common/types';

import type { JSONValue, SharedV4ProviderOptions } from '@ai-sdk/provider';

import { LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { syncProviderTlsRule } from '@/models/utils';
import { createStrategyFromDescriptor } from '@/models/providers/strategy-factory';
import { loadOpenAiCompatibleModels, mergeModelProps } from '@/models/providers/shared';

const loadOpenaiCompatibleModels = async (profile: ProviderProfile, settings: SettingsData, tlsRegistrar?: TlsPolicyRegistrar): Promise<LoadModelsResponse> => {
  if (!isOpenAiCompatibleProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider as OpenAiCompatibleProvider;
  const apiKey = provider.apiKey || '';
  const baseUrl = provider.baseUrl;

  const apiKeyEnv = getEffectiveEnvironmentVariable('OPENAI_API_KEY', settings);
  const baseUrlEnv = getEffectiveEnvironmentVariable('OPENAI_API_BASE', settings);

  const effectiveApiKey = apiKey || apiKeyEnv?.value;
  const effectiveBaseUrl = baseUrl || baseUrlEnv?.value;

  if (!effectiveBaseUrl) {
    return { models: [], success: false };
  }

  syncProviderTlsRule(tlsRegistrar, effectiveBaseUrl, provider.sslVerify, provider.caCertPath);

  return loadOpenAiCompatibleModels({
    url: `${effectiveBaseUrl}/models`,
    headers: effectiveApiKey ? { Authorization: `Bearer ${effectiveApiKey}` } : {},
    profile,
    label: 'OpenAI-compatible',
    notOkLog: 'debug',
    catchLog: 'warn',
    mapper: (id, item) => {
      const model = item as {
        max_model_len?: number;
        context_length?: number;
        num_ctx?: number;
        context_window?: number;
        max_completion_tokens?: number;
        max_tokens?: number;
      };
      const maxInputTokens = model.max_model_len ?? model.context_length ?? model.num_ctx ?? model.context_window;
      const maxOutputTokensLimit = model.max_completion_tokens ?? model.max_tokens;

      return {
        id,
        ...(maxInputTokens != null && { maxInputTokens }),
        ...(maxOutputTokensLimit != null && { maxOutputTokensLimit }),
      } satisfies Partial<Model>;
    },
  });
};

const getOpenAiCompatibleProviderOptions = (provider: LlmProvider, model: Model, reasoning?: Reasoning): SharedV4ProviderOptions | undefined => {
  if (!isOpenAiCompatibleProvider(provider)) {
    return undefined;
  }

  const openAiCompatibleProvider = provider as OpenAiCompatibleProvider;

  // Extract reasoningEffort from model overrides or provider config
  const overrides = mergeModelProps(model, openAiCompatibleProvider, ['reasoningEffort', 'extraBody']);
  const reasoningEffort = overrides.reasoningEffort;
  const extraBody = overrides.extraBody;

  const providerOptions: Record<string, JSONValue> = {};

  // When the top-level reasoning parameter is set (not undefined or 'provider-default'),
  // omit reasoningEffort from providerOptions so the AI SDK's portable reasoning takes effect.
  // Still apply extraBody since it may contain unrelated provider settings.
  if (!reasoning || reasoning === 'provider-default') {
    const mappedReasoningEffort =
      reasoningEffort === undefined || reasoningEffort === ReasoningEffort.None
        ? undefined
        : (reasoningEffort.toLowerCase() as 'max' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh');

    if (mappedReasoningEffort) {
      providerOptions.reasoningEffort = mappedReasoningEffort;
    }
  }

  if (extraBody) {
    Object.assign(providerOptions, extraBody);
  }

  if (Object.keys(providerOptions).length > 0) {
    logger.debug('Using provider options for OpenAI Compatible:', {
      reasoning,
      hasExtraBody: !!extraBody,
    });
    return {
      [provider.name]: providerOptions,
    } satisfies SharedV4ProviderOptions;
  }

  return undefined;
};

// loadModels keeps its bespoke flow: base URL required, key optional, TLS sync
export const openaiCompatibleProviderStrategy: LlmProviderStrategy = createStrategyFromDescriptor({
  name: 'openai-compatible',
  label: 'OpenAI-compatible',
  sdkFactory: createOpenAICompatible,
  apiKeyEnv: 'OPENAI_API_KEY',
  // the API key is optional here; only the base URL is required
  apiKeyRequired: null,
  baseUrl: {
    envKey: 'OPENAI_API_BASE',
    required: (provider) => `Base URL is required for ${provider.name} provider. Set it in Providers settings or via the OPENAI_API_BASE environment variable.`,
  },
  extraFactoryOptions: ({ provider, model }) => {
    const openAiCompatibleProvider = provider as unknown as OpenAiCompatibleProvider;
    return {
      name: openAiCompatibleProvider.name,
      includeUsage: mergeModelProps(model, openAiCompatibleProvider, ['trackTokenUsage']).trackTokenUsage !== false,
    };
  },
  tlsSync: true,
  isProvider: isOpenAiCompatibleProvider,
  hasEnvKeys: ['OPENAI_API_KEY', 'OPENAI_API_BASE'],
  aider: { prefix: 'openai', apiKeyEnv: 'OPENAI_API_KEY', baseUrlField: 'baseUrl' },
  overrides: {
    loadModels: loadOpenaiCompatibleModels,
    getProviderOptions: getOpenAiCompatibleProviderOptions,
  },
});
