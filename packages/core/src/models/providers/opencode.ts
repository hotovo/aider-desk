import { Model, ProviderProfile, SettingsData } from '@aider-desk/common/types';
import { DEFAULT_MODEL_TEMPERATURE, isOpenCodeProvider, OpenCodeProvider } from '@aider-desk/common/agent';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import { getDefaultModelInfo, getDefaultUsageReport } from './default';

import type { LanguageModelV2 } from '@ai-sdk/provider';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import { getEffectiveEnvironmentVariable } from '@/utils';

const ENDPOINT_BASE_URL = 'https://opencode.ai/zen/v1';

interface OpenCodeModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

interface OpenCodeModelsResponse {
  object: string;
  data: OpenCodeModel[];
}

type ModelEndpointType = 'openai' | 'anthropic' | 'gemini' | 'openai-compatible';

const getModelEndpointType = (modelId: string): ModelEndpointType => {
  if (modelId.startsWith('gpt-') || modelId.startsWith('gpt5') || modelId.startsWith('gpt-5')) {
    return 'openai';
  }
  if (modelId.startsWith('claude-')) {
    return 'anthropic';
  }
  if (modelId.startsWith('gemini-')) {
    return 'gemini';
  }
  return 'openai-compatible';
};

const getDefaultModelTemperature = (modelId: string) => {
  if (modelId.includes('claude')) {
    return undefined;
  }
  if (modelId.includes('gemini')) {
    return 0.7;
  }
  if (modelId.includes('gpt-5') || modelId.startsWith('gpt5')) {
    return undefined;
  }
  if (modelId.includes('qwen')) {
    return 0.55;
  }
  if (modelId.includes('glm-')) {
    return 0.7;
  }
  return DEFAULT_MODEL_TEMPERATURE;
};

const loadOpencodeModels = async (profile: ProviderProfile, settings: SettingsData): Promise<LoadModelsResponse> => {
  if (!isOpenCodeProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider as OpenCodeProvider;
  const apiKey = provider.apiKey || '';
  const apiKeyEnv = getEffectiveEnvironmentVariable('OPENCODE_API_KEY', settings);
  const effectiveApiKey = apiKey || apiKeyEnv?.value || '';

  if (!effectiveApiKey) {
    return { models: [], success: false };
  }

  try {
    const response = await fetch(`${ENDPOINT_BASE_URL}/models`, {
      headers: {
        Authorization: `Bearer ${effectiveApiKey}`,
      },
    });
    if (!response.ok) {
      const errorMsg = `OpenCode models API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
      return { models: [], success: false, error: errorMsg };
    }

    const data = (await response.json()) as OpenCodeModelsResponse;
    const models =
      data.data?.map((model: OpenCodeModel) => {
        return {
          id: model.id,
          providerId: profile.id,
          temperature: getDefaultModelTemperature(model.id),
        } satisfies Model;
      }) || [];

    return { models, success: true };
  } catch (error) {
    const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error loading OpenCode models';
    return { models: [], success: false, error: errorMsg };
  }
};

export const hasOpencodeEnvVars = (settings: SettingsData): boolean => {
  return !!getEffectiveEnvironmentVariable('OPENCODE_API_KEY', settings, undefined)?.value;
};

export const getOpencodeAiderMapping = (provider: ProviderProfile, modelId: string, settings: SettingsData, projectDir: string): AiderModelMapping => {
  const opencodeProvider = provider.provider as OpenCodeProvider;
  const envVars: Record<string, string> = {
    OPENAI_API_BASE: ENDPOINT_BASE_URL,
  };

  if (opencodeProvider.apiKey) {
    envVars.OPENAI_API_KEY = opencodeProvider.apiKey;
  } else {
    const effectiveVar = getEffectiveEnvironmentVariable('OPENCODE_API_KEY', settings, projectDir);
    if (effectiveVar) {
      envVars.OPENAI_API_KEY = effectiveVar.value;
    }
  }

  // Use openai prefix for OpenCode providers
  return {
    modelName: `openai/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
export const createOpencodeLlm = (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): LanguageModelV2 => {
  const provider = profile.provider as OpenCodeProvider;
  let apiKey = provider.apiKey;

  if (!apiKey) {
    const effectiveVar = getEffectiveEnvironmentVariable('OPENCODE_API_KEY', settings, projectDir);
    if (effectiveVar) {
      apiKey = effectiveVar.value;
    }
  }

  if (!apiKey) {
    throw new Error('OpenCode API key is required in Providers settings or Aider environment variables (OPENCODE_API_KEY)');
  }

  const modelId = model.id;
  const endpointType = getModelEndpointType(modelId);

  switch (endpointType) {
    case 'openai': {
      const openai = createOpenAI({
        apiKey,
        baseURL: ENDPOINT_BASE_URL,
        headers: profile.headers,
      });
      return openai(modelId);
    }
    case 'anthropic': {
      const anthropic = createAnthropic({
        apiKey,
        baseURL: ENDPOINT_BASE_URL,
        headers: profile.headers,
      });
      return anthropic(modelId);
    }
    case 'gemini': {
      const google = createGoogleGenerativeAI({
        apiKey,
        baseURL: ENDPOINT_BASE_URL,
        headers: profile.headers,
      });
      return google(modelId);
    }
    default: {
      const compatible = createOpenAICompatible({
        name: 'opencode',
        apiKey,
        baseURL: ENDPOINT_BASE_URL,
        headers: profile.headers,
      });
      return compatible(modelId);
    }
  }
};

// === Complete Strategy Implementation ===
export const opencodeProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createOpencodeLlm,
  getUsageReport: getDefaultUsageReport,

  // Model discovery functions
  loadModels: loadOpencodeModels,
  hasEnvVars: hasOpencodeEnvVars,
  getAiderMapping: getOpencodeAiderMapping,
  getModelInfo: getDefaultModelInfo,
};
