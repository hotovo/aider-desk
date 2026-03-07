import { createOpenAI } from '@ai-sdk/openai';
import { DEFAULT_VOICE_SYSTEM_INSTRUCTIONS, isOpenAiProvider, LlmProvider, OpenAiProvider, OpenAiVoiceModel } from '@common/agent';
import { Model, ProviderProfile, ReasoningEffort, SettingsData, UsageReportData, VoiceSession } from '@common/types';

import type { LanguageModelUsage, ToolSet } from 'ai';
import type { LanguageModelV2, SharedV2ProviderOptions } from '@ai-sdk/provider';

import logger from '@/logger';
import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import { Task } from '@/task/task';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { calculateCost, getDefaultModelInfo } from '@/models/providers/default';

export const loadOpenAiModels = async (profile: ProviderProfile, settings: SettingsData): Promise<LoadModelsResponse> => {
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
        return {
          id: model.id,
          providerId: profile.id,
          temperature: undefined,
        } satisfies Model;
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

  // clear any custom base URL
  envVars.OPENAI_API_BASE = '';
  if (openaiProvider.apiKey) {
    envVars.OPENAI_API_KEY = openaiProvider.apiKey;
  }

  return {
    modelName: `openai/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
export const createOpenAiLlm = (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): LanguageModelV2 => {
  const provider = profile.provider as OpenAiProvider;
  let apiKey = provider.apiKey;

  if (!apiKey) {
    const effectiveVar = getEffectiveEnvironmentVariable('OPENAI_API_KEY', settings, projectDir);
    if (effectiveVar) {
      apiKey = effectiveVar.value;
      logger.debug(`Loaded OPENAI_API_KEY from ${effectiveVar.source}`);
    }
  }

  if (!apiKey) {
    throw new Error('OpenAI API key is required in Providers settings or Aider environment variables (OPENAI_API_KEY)');
  }

  const openAIProvider = createOpenAI({
    apiKey,
    headers: profile.headers,
  });

  return openAIProvider(model.id);
};

type OpenAiMetadata = {
  openai: {
    cachedPromptTokens?: number;
  };
};

export const getOpenAiUsageReport = (
  task: Task,
  provider: ProviderProfile,
  model: Model,
  usage: LanguageModelUsage,
  providerMetadata?: unknown,
): UsageReportData => {
  const totalSentTokens = usage.inputTokens || 0;
  const receivedTokens = usage.outputTokens || 0;

  // Extract cache read tokens from provider metadata or usage
  const { openai } = (providerMetadata as OpenAiMetadata) || {};
  const cacheReadTokens = openai?.cachedPromptTokens ?? usage.cachedInputTokens ?? 0;

  // Calculate sentTokens after deducting cached tokens
  const sentTokens = totalSentTokens - cacheReadTokens;

  // Calculate cost internally with already deducted sentTokens
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

// === Configuration Helper Functions ===
export const getOpenAiProviderOptions = (provider: LlmProvider, model: Model): SharedV2ProviderOptions | undefined => {
  if (!isOpenAiProvider(provider)) {
    return undefined;
  }

  const openAiProvider = provider as OpenAiProvider;

  // Extract reasoningEffort from model overrides or provider config
  const providerOverrides = model.providerOverrides as Partial<OpenAiProvider> | undefined;
  const reasoningEffort = providerOverrides?.reasoningEffort ?? openAiProvider.reasoningEffort;

  // Map ReasoningEffort enum to AI SDK format
  const mappedReasoningEffort =
    reasoningEffort === undefined || reasoningEffort === ReasoningEffort.None
      ? undefined
      : (reasoningEffort.toLowerCase() as 'minimal' | 'low' | 'medium' | 'high' | 'xhigh');

  if (mappedReasoningEffort) {
    logger.debug('Using reasoning effort:', { mappedReasoningEffort });
    return {
      openai: {
        reasoningSummary: 'auto',
        reasoningEffort: mappedReasoningEffort,
      },
    };
  }

  return undefined;
};

// === Provider Tools Functions ===
export const getOpenAiProviderTools = (provider: LlmProvider, model: Model): ToolSet => {
  if (!isOpenAiProvider(provider)) {
    return {};
  }

  const openAiProvider = provider as OpenAiProvider;

  // Check for model-specific overrides
  const providerOverrides = model.providerOverrides as Partial<OpenAiProvider> | undefined;
  const useWebSearch = providerOverrides?.useWebSearch ?? openAiProvider.useWebSearch;

  if (!useWebSearch) {
    return {};
  }

  const openaiProvider = createOpenAI({
    apiKey: openAiProvider.apiKey,
  });

  return {
    web_search: openaiProvider.tools.webSearch({}),
  } as ToolSet;
};

// === Complete Strategy Implementation ===
const createOpenAIVoiceSession = async (profile: ProviderProfile, settings: SettingsData): Promise<VoiceSession> => {
  if (!isOpenAiProvider(profile.provider)) {
    throw new Error('OpenAI provider not configured');
  }

  const provider = profile.provider as OpenAiProvider;
  let apiKey = provider.apiKey;

  if (!apiKey) {
    const effectiveVar = getEffectiveEnvironmentVariable('OPENAI_API_KEY', settings);
    if (effectiveVar) {
      apiKey = effectiveVar.value;
      logger.debug(`Loaded OPENAI_API_KEY from ${effectiveVar.source}`);
    }
  }

  if (!apiKey) {
    throw new Error('OpenAI API key is required for voice session');
  }

  try {
    // Generate ephemeral token for OpenAI Realtime API
    // This creates a short-lived token specifically for Realtime API usage
    const model = provider.voice?.model ?? OpenAiVoiceModel.Gpt4oTranscribe;
    const language = provider.voice?.language ?? 'en';
    const prompt = provider.voice?.systemInstructions ?? DEFAULT_VOICE_SYSTEM_INSTRUCTIONS;
    const idleTimeoutMs = provider.voice?.idleTimeoutMs ?? 5000;
    const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session: {
          type: 'transcription',
          audio: {
            input: {
              transcription: {
                language,
                model,
                prompt,
              },
              turn_detection: {
                type: 'server_vad',
                prefix_padding_ms: 300,
                silence_duration_ms: 500,
                threshold: 0.5,
                idle_timeout_ms: idleTimeoutMs,
              },
              noise_reduction: {
                type: 'near_field',
              },
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const errorMsg = `OpenAI client secrets API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
      logger.error(errorMsg, response.status, response.statusText);
      throw new Error(errorMsg);
    }

    const data = await response.json();
    const ephemeralToken = data.value;

    if (!ephemeralToken) {
      throw new Error('Failed to generate OpenAI ephemeral token');
    }

    logger.info('OpenAI ephemeral token generated');

    return {
      ephemeralToken,
      model,
      idleTimeoutMs,
    };
  } catch (error) {
    logger.error('Failed to create OpenAI voice session:', error);
    throw error;
  }
};

// === Complete Strategy Implementation ===
export const openaiProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createOpenAiLlm,
  getUsageReport: getOpenAiUsageReport,

  // Model discovery functions
  loadModels: loadOpenAiModels,
  hasEnvVars: hasOpenAiEnvVars,
  getAiderMapping: getOpenAiAiderMapping,
  getModelInfo: getDefaultModelInfo,

  // Configuration helper functions
  getProviderOptions: getOpenAiProviderOptions,
  getProviderTools: getOpenAiProviderTools,

  // Voice support
  createVoiceSession: createOpenAIVoiceSession,
};
