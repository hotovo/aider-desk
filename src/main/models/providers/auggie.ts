import { existsSync } from 'fs';
import { homedir } from 'os';
import path from 'path';

import { AuggieProvider, isAuggieProvider } from '@common/agent';
import { Model, ProviderProfile, SettingsData, UsageReportData } from '@common/types';

import type { LanguageModelV2 } from '@ai-sdk/provider';
import type { AugmentLanguageModel as AugmentLanguageModelType } from '@augmentcode/auggie-sdk';

import logger from '@/logger';
import { AiderModelMapping, LlmProviderStrategy } from '@/models';
import { LoadModelsResponse } from '@/models/types';
import { findExecutableInPath, getEffectiveEnvironmentVariable } from '@/utils';
import { getDefaultModelInfo } from '@/models/providers/default';
import { Task } from '@/task';

type AuggieSdkModule = typeof import('@augmentcode/auggie-sdk');

const loadAuggieSdk = async (): Promise<AuggieSdkModule> => import('@augmentcode/auggie-sdk');

const AUGGIE_MODELS = [
  {
    id: 'claude-haiku-4-5',
    maxInputTokens: 200000,
    maxOutputTokensLimit: 8192,
  },
  {
    id: 'claude-sonnet-4',
    maxInputTokens: 200000,
    maxOutputTokensLimit: 16384,
  },
  {
    id: 'claude-sonnet-4-5',
    maxInputTokens: 200000,
    maxOutputTokensLimit: 16384,
  },
  {
    id: 'claude-opus-4-5',
    maxInputTokens: 200000,
    maxOutputTokensLimit: 32768,
  },
  {
    id: 'claude-opus-4-6',
    maxInputTokens: 200000,
    maxOutputTokensLimit: 32768,
  },
  {
    id: 'claude-opus-4-7',
    maxInputTokens: 200000,
    maxOutputTokensLimit: 32768,
  },
  { id: 'gpt-5-1', maxInputTokens: 200000, maxOutputTokensLimit: 16384 },
  { id: 'gpt-5-2', maxInputTokens: 200000, maxOutputTokensLimit: 16384 },
  { id: 'gpt-5-4', maxInputTokens: 200000, maxOutputTokensLimit: 16384 },
];

export const loadAuggieModels = async (profile: ProviderProfile, _settings: SettingsData): Promise<LoadModelsResponse> => {
  if (!isAuggieProvider(profile.provider)) {
    return {
      models: [],
      success: false,
    };
  }

  const models: Model[] = AUGGIE_MODELS.map((model) => ({
    id: model.id,
    providerId: profile.id,
    maxInputTokens: model.maxInputTokens,
    maxOutputTokensLimit: model.maxOutputTokensLimit,
  }));

  logger.info(`Loaded ${models.length} Auggie models for profile ${profile.id}`);
  return { models, success: true };
};

export const hasAuggieEnvVars = (settings: SettingsData): boolean => {
  if (
    getEffectiveEnvironmentVariable('AUGMENT_API_TOKEN', settings, undefined)?.value &&
    getEffectiveEnvironmentVariable('AUGMENT_API_URL', settings, undefined)?.value
  ) {
    return true;
  }

  const auggieSessionFile = path.join(homedir(), '.augment', 'session.json');
  if (findExecutableInPath('auggie') && existsSync(auggieSessionFile)) {
    return true;
  }

  return false;
};

export const getAuggieAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  const auggieProvider = provider.provider as AuggieProvider;
  const envVars: Record<string, string> = {};

  if (auggieProvider.apiKey) {
    envVars.AUGMENT_API_TOKEN = auggieProvider.apiKey;
  }
  if (auggieProvider.apiUrl) {
    envVars.AUGMENT_API_URL = auggieProvider.apiUrl;
  }

  return {
    modelName: `auggie/${modelId}`,
    environmentVariables: envVars,
  };
};

export const createAuggieLlm = async (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): Promise<LanguageModelV2> => {
  const provider = profile.provider as AuggieProvider;
  let apiKey = provider.apiKey;
  let apiUrl = provider.apiUrl;

  if (!apiKey) {
    const effectiveVar = getEffectiveEnvironmentVariable('AUGMENT_API_TOKEN', settings, projectDir);
    if (effectiveVar) {
      apiKey = effectiveVar.value;
      logger.debug(`Loaded AUGMENT_API_TOKEN from ${effectiveVar.source}`);
    }
  }

  if (!apiUrl) {
    const effectiveUrlVar = getEffectiveEnvironmentVariable('AUGMENT_API_URL', settings, projectDir);
    if (effectiveUrlVar) {
      apiUrl = effectiveUrlVar.value;
      logger.debug(`Loaded AUGMENT_API_URL from ${effectiveUrlVar.source}`);
    }
  }

  if (apiKey && !apiUrl) {
    throw new Error('API URL is required when API key is provided.');
  }

  const { AugmentLanguageModel, resolveAugmentCredentials } = await loadAuggieSdk();
  const AugmentLanguageModelCtor = AugmentLanguageModel as typeof AugmentLanguageModelType;

  if (apiKey && apiUrl) {
    return new AugmentLanguageModelCtor(model.id, {
      apiKey,
      apiUrl,
    }) as LanguageModelV2;
  } else {
    const credentials = await resolveAugmentCredentials();
    return new AugmentLanguageModelCtor(model.id, credentials) as LanguageModelV2;
  }
};

const getAuggieUsageReport = (_task: Task, _provider: ProviderProfile, model: Model): UsageReportData => {
  return {
    model: model.id,
    sentTokens: 0,
    receivedTokens: 0,
    messageCost: 0,
    agentTotalCost: 0,
  };
};

export const auggieProviderStrategy: LlmProviderStrategy = {
  createLlm: createAuggieLlm,
  getUsageReport: getAuggieUsageReport,
  loadModels: loadAuggieModels,
  hasEnvVars: hasAuggieEnvVars,
  getAiderMapping: getAuggieAiderMapping,
  getModelInfo: getDefaultModelInfo,
};
