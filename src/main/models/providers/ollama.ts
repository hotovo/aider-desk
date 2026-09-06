import { isOllamaProvider, OllamaProvider } from '@common/agent';
import { createOllama } from 'ollama-ai-provider-v2';
import { simulateStreamingMiddleware, wrapLanguageModel } from 'ai';
import { Model, ProviderProfile, SettingsData } from '@common/types';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { createStrategyFromDescriptor } from '@/models/providers/strategy-factory';
import { normalizeError } from '@/models/providers/shared';

/** strips trailing slashes, then appends the Ollama REST prefix if missing */
const normalizeOllamaBaseUrl = (baseUrl: string): string => {
  let normalized = baseUrl.replace(/\/+$/, '');
  if (!normalized.endsWith('/api')) {
    normalized = `${normalized}/api`;
  }
  return normalized;
};

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
    const response = await fetch(`${normalizeOllamaBaseUrl(effectiveBaseUrl)}/tags`);
    if (!response.ok) {
      const errorMsg = `Ollama models API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
      logger.warn(errorMsg);
      return { models: [], success: false, error: errorMsg };
    }

    const data = await response.json();
    const models =
      data?.models?.map((m: { name: string; details?: { context_length?: number } }) => {
        const contextLength = m.details?.context_length;
        const maxInputTokens = typeof contextLength === 'number' && contextLength > 0 ? contextLength : undefined;
        return {
          id: m.name,
          providerId: profile.id,
          maxInputTokens,
        } satisfies Model;
      }) || [];
    logger.info(`Loaded ${models.length} Ollama models from ${effectiveBaseUrl} for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = normalizeError(error, 'Unknown error loading Ollama models');
    logger.error('Error loading Ollama models:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

const getOllamaAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
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

// Ollama is local-only (no credential, base URL only), so loadModels/mapping stay bespoke
export const ollamaProviderStrategy: LlmProviderStrategy = createStrategyFromDescriptor({
  name: 'ollama',
  label: 'Ollama',
  sdkFactory: createOllama,
  baseUrl: {
    envKey: 'OLLAMA_API_BASE',
    required: 'Base URL is required for Ollama provider. Set it in Providers settings or via the OLLAMA_API_BASE environment variable.',
    transform: normalizeOllamaBaseUrl,
  },
  wrapModel: (model) => wrapLanguageModel({ model, middleware: simulateStreamingMiddleware() }),
  isProvider: isOllamaProvider,
  hasEnvKeys: ['OLLAMA_API_BASE'],
  overrides: { loadModels: loadOllamaModels, getAiderMapping: getOllamaAiderMapping },
});
