import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI, type GoogleGenerativeAIProviderOptions } from '@ai-sdk/google';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { createOllama } from 'ollama-ai-provider';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createRequesty, type RequestyProviderMetadata } from '@requesty/ai-sdk';
import {
  isAnthropicProvider,
  isBedrockProvider,
  isDeepseekProvider,
  isGeminiProvider,
  isOllamaProvider,
  isOpenAiCompatibleProvider,
  isOpenAiProvider,
  isOpenRouterProvider,
  isRequestyProvider,
  LlmProvider,
} from '@common/agent';
import { AIDER_DESK_TITLE, AIDER_DESK_WEBSITE } from 'src/main/constants';
import { AgentProfile, ReasoningEffort, UsageReportData } from '@common/types';
import { ModelInfoManager } from 'src/main/model-info-manager';
import { Project } from 'src/main/project';

import type { JSONValue, LanguageModel, LanguageModelUsage } from 'ai';

export const createLlm = (provider: LlmProvider, model: string, env: Record<string, string | undefined> = {}): LanguageModel => {
  if (!model) {
    throw new Error(`Model name is required for ${provider.name} provider`);
  }

  if (isAnthropicProvider(provider)) {
    const apiKey = provider.apiKey || env['ANTHROPIC_API_KEY'];
    if (!apiKey) {
      throw new Error('Anthropic API key is required in Agent provider settings or Aider environment variables (ANTHROPIC_API_KEY)');
    }
    const anthropicProvider = createAnthropic({ apiKey });
    return anthropicProvider(model);
  } else if (isOpenAiProvider(provider)) {
    const apiKey = provider.apiKey || env['OPENAI_API_KEY'];
    if (!apiKey) {
      throw new Error('OpenAI API key is required in Agent provider settings or Aider environment variables (OPENAI_API_KEY)');
    }
    const openAIProvider = createOpenAI({
      apiKey,
      compatibility: 'strict',
    });
    return openAIProvider(model, {
      structuredOutputs: false,
    });
  } else if (isGeminiProvider(provider)) {
    const apiKey = provider.apiKey || env['GEMINI_API_KEY'];
    if (!apiKey) {
      throw new Error('Gemini API key is required in Agent provider settings or Aider environment variables (GEMINI_API_KEY)');
    }
    const baseUrl = provider.customBaseUrl || env['GEMINI_API_BASE_URL'];

    const googleProvider = createGoogleGenerativeAI({
      apiKey,
      baseURL: baseUrl,
    });
    return googleProvider(model, {
      useSearchGrounding: provider.useSearchGrounding,
    });
  } else if (isDeepseekProvider(provider)) {
    const apiKey = provider.apiKey || env['DEEPSEEK_API_KEY'];
    if (!apiKey) {
      throw new Error('Deepseek API key is required in Agent provider settings or Aider environment variables (DEEPSEEK_API_KEY)');
    }
    const deepseekProvider = createDeepSeek({ apiKey });
    return deepseekProvider(model);
  } else if (isOpenAiCompatibleProvider(provider)) {
    const apiKey = provider.apiKey || env['OPENAI_API_KEY'];
    if (!apiKey) {
      throw new Error(`API key is required for ${provider.name}. Check Agent provider settings or Aider environment variables (OPENAI_API_KEY).`);
    }
    const baseUrl = provider.baseUrl || env['OPENAI_API_BASE'];
    if (!baseUrl) {
      throw new Error(`Base URL is required for ${provider.name} provider. Set it in Agent provider settings or via the OPENAI_API_BASE environment variable.`);
    }
    // Use createOpenAICompatible to get a provider instance, then get the model
    const compatibleProvider = createOpenAICompatible({
      name: provider.name,
      apiKey,
      baseURL: baseUrl,
    });
    return compatibleProvider(model);
  } else if (isBedrockProvider(provider)) {
    const region = provider.region || env['AWS_REGION'];
    const accessKeyId = provider.accessKeyId || env['AWS_ACCESS_KEY_ID'];
    const secretAccessKey = provider.secretAccessKey || env['AWS_SECRET_ACCESS_KEY'];
    const sessionToken = provider.sessionToken || env['AWS_SESSION_TOKEN'];

    if (!region) {
      throw new Error('AWS region is required for Bedrock. You can set it in the MCP settings or Aider environment variables (AWS_REGION).');
    }
    // Check if we have explicit keys or if AWS_PROFILE is set in the main process env
    if (!accessKeyId && !secretAccessKey && !process.env.AWS_PROFILE) {
      throw new Error(
        'AWS credentials (accessKeyId/secretAccessKey) or AWS_PROFILE must be provided for Bedrock in Agent provider settings or Aider environment variables.',
      );
    }

    // AI SDK Bedrock provider handles credentials via environment variables or default chain.
    // We pass credentials explicitly only if they were found in config or env.
    // Otherwise, we let the SDK handle the default credential chain (which includes AWS_PROFILE from process.env).
    const bedrockProviderInstance = createAmazonBedrock({
      region,
      ...(accessKeyId &&
        secretAccessKey && {
          accessKeyId,
          secretAccessKey,
          sessionToken,
        }),
      // Let the SDK handle the default chain if explicit keys aren't provided
      credentialProvider: !accessKeyId && !secretAccessKey ? fromNodeProviderChain() : undefined,
    });
    return bedrockProviderInstance(model);
  } else if (isOllamaProvider(provider)) {
    const baseUrl = provider.baseUrl || env['OLLAMA_API_BASE'];
    if (!baseUrl) {
      throw new Error('Base URL is required for Ollama provider. Set it in Agent provider settings or via the OLLAMA_API_BASE environment variable.');
    }
    // Ensure the baseUrl ends with /api for ollama-ai-provider
    const finalBaseUrl = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
    const ollamaInstance = createOllama({ baseURL: finalBaseUrl });
    return ollamaInstance(model, {
      simulateStreaming: true,
    });
  } else if (isOpenRouterProvider(provider)) {
    const apiKey = provider.apiKey || env['OPENROUTER_API_KEY'];
    if (!apiKey) {
      throw new Error('OpenRouter API key is required in Agent provider settings or Aider environment variables (OPENROUTER_API_KEY)');
    }
    const openRouter = createOpenRouter({
      apiKey,
      compatibility: 'strict',
      headers: {
        'HTTP-Referer': AIDER_DESK_WEBSITE,
        'X-Title': AIDER_DESK_TITLE,
      },
      extraBody: {
        provider: {
          require_parameters: true,
        },
      },
    });
    return openRouter.chat(model, {
      usage: {
        include: true,
      },
    });
  } else if (isRequestyProvider(provider)) {
    const apiKey = provider.apiKey || env['REQUESTY_API_KEY'];
    if (!apiKey) {
      throw new Error('Requesty API key is required in Agent provider settings or Aider environment variables (REQUESTY_API_KEY)');
    }

    const requestyProvider = createRequesty({
      apiKey,
      compatibility: 'strict',
      headers: {
        'HTTP-Referer': AIDER_DESK_WEBSITE,
        'X-Title': AIDER_DESK_TITLE,
      },
      extraBody: {
        ...(provider.useAutoCache && { requesty: { auto_cache: true } }),
      },
    });
    return requestyProvider(model, {
      includeReasoning: provider.reasoningEffort !== ReasoningEffort.None,
      reasoningEffort: provider.reasoningEffort === ReasoningEffort.None ? undefined : provider.reasoningEffort,
    });
  } else {
    throw new Error(`Unsupported LLM provider: ${JSON.stringify(provider)}`);
  }
};

type AnthropicMetadata = {
  anthropic: {
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
  };
};

type OpenAiMetadata = {
  openai: {
    cachedPromptTokens?: number;
  };
};

type OpenRouterMetadata = {
  openrouter: {
    usage: {
      completionTokens: number;
      completionTokensDetails: {
        reasoningTokens: number;
      };
      cost: number;
      promptTokens: number;
      promptTokensDetails?: {
        cachedTokens: number;
      };
      totalTokens: number;
    };
  };
};

type GoogleMetadata = {
  google: {
    cachedContentTokenCount?: number;
  };
};

export const calculateCost = (
  modelInfoManager: ModelInfoManager,
  profile: AgentProfile,
  sentTokens: number,
  receivedTokens: number,
  providerMetadata?: AnthropicMetadata | OpenAiMetadata | OpenRouterMetadata | RequestyProviderMetadata | unknown,
) => {
  if (profile.provider === 'openrouter') {
    const { openrouter } = providerMetadata as OpenRouterMetadata;
    return openrouter.usage.cost;
  }

  // Get the model name directly from the provider
  const model = profile.model;
  if (!model) {
    return 0;
  }
  const modelInfo = modelInfoManager.getModelInfo(model);
  if (!modelInfo) {
    return 0;
  }

  // Calculate cost in dollars (costs are per million tokens)
  let inputCost = sentTokens * modelInfo.inputCostPerToken;
  const outputCost = receivedTokens * modelInfo.outputCostPerToken;
  let cacheCost = 0;

  if (profile.provider === 'anthropic') {
    const { anthropic } = providerMetadata as AnthropicMetadata;
    const cacheCreationInputTokens = anthropic.cacheCreationInputTokens ?? 0;
    const cacheReadInputTokens = anthropic.cacheReadInputTokens ?? 0;
    const cacheCreationCost = cacheCreationInputTokens * (modelInfo.cacheWriteInputTokenCost ?? modelInfo.inputCostPerToken);
    const cacheReadCost = cacheReadInputTokens * (modelInfo.cacheReadInputTokenCost ?? 0);

    cacheCost = cacheCreationCost + cacheReadCost;
  } else if (profile.provider === 'openai') {
    const { openai } = providerMetadata as OpenAiMetadata;
    const cachedPromptTokens = openai.cachedPromptTokens ?? 0;

    inputCost = (sentTokens - cachedPromptTokens) * modelInfo.inputCostPerToken;
    cacheCost = cachedPromptTokens * (modelInfo.cacheReadInputTokenCost ?? modelInfo.inputCostPerToken);
  } else if (profile.provider === 'gemini') {
    const { google } = providerMetadata as GoogleMetadata;
    const cachedPromptTokens = google.cachedContentTokenCount ?? 0;

    inputCost = (sentTokens - cachedPromptTokens) * modelInfo.inputCostPerToken;
    cacheCost = cachedPromptTokens * (modelInfo.cacheReadInputTokenCost ?? modelInfo.inputCostPerToken * 0.25);
  } else if (profile.provider === 'requesty') {
    const { requesty } = providerMetadata as RequestyProviderMetadata;
    const cachingTokens = requesty.usage?.cachingTokens ?? 0;
    const cachedTokens = requesty.usage?.cachedTokens ?? 0;

    const cacheCreationCost = cachingTokens * (modelInfo.cacheWriteInputTokenCost ?? modelInfo.inputCostPerToken);
    const cacheReadCost = cachedTokens * (modelInfo.cacheReadInputTokenCost ?? 0);

    inputCost = (sentTokens - cachedTokens) * modelInfo.inputCostPerToken;
    cacheCost = cacheCreationCost + cacheReadCost;
  }

  return inputCost + outputCost + cacheCost;
};

export const getUsageReport = (
  project: Project,
  profile: AgentProfile,
  messageCost: number,
  usage: LanguageModelUsage,
  providerMetadata?: AnthropicMetadata | OpenAiMetadata | OpenRouterMetadata | RequestyProviderMetadata | unknown,
): UsageReportData => {
  const usageReportData: UsageReportData = {
    sentTokens: usage.promptTokens,
    receivedTokens: usage.completionTokens,
    messageCost,
    agentTotalCost: project.agentTotalCost + messageCost,
  };

  if (profile.provider === 'anthropic') {
    const { anthropic } = providerMetadata as AnthropicMetadata;
    usageReportData.cacheWriteTokens = anthropic.cacheCreationInputTokens;
    usageReportData.cacheReadTokens = anthropic.cacheReadInputTokens;
  } else if (profile.provider === 'openai') {
    const { openai } = providerMetadata as OpenAiMetadata;
    usageReportData.cacheReadTokens = openai.cachedPromptTokens;
    usageReportData.sentTokens -= openai.cachedPromptTokens ?? 0;
  } else if (profile.provider === 'openrouter') {
    const { openrouter } = providerMetadata as OpenRouterMetadata;
    usageReportData.cacheReadTokens = openrouter.usage.promptTokensDetails?.cachedTokens;
    usageReportData.sentTokens -= usageReportData.cacheReadTokens ?? 0;
  } else if (profile.provider === 'gemini') {
    const { google } = providerMetadata as GoogleMetadata;
    usageReportData.cacheReadTokens = google.cachedContentTokenCount;
    usageReportData.sentTokens -= usageReportData.cacheReadTokens ?? 0;
  } else if (profile.provider === 'requesty') {
    const { requesty } = providerMetadata as RequestyProviderMetadata;
    usageReportData.cacheWriteTokens = requesty.usage?.cachingTokens;
    usageReportData.cacheReadTokens = requesty.usage?.cachedTokens;
    usageReportData.sentTokens -= usageReportData.cacheReadTokens ?? 0;
  }

  return usageReportData;
};

export type CacheControl = Record<string, Record<string, JSONValue>> | undefined;
export const getCacheControl = (profile: AgentProfile): CacheControl => {
  if (profile.provider === 'anthropic') {
    return {
      anthropic: {
        cacheControl: { type: 'ephemeral' },
      },
    };
  } else if (profile.provider === 'requesty') {
    if (profile.model.startsWith('anthropic/')) {
      return {
        requesty: {
          cacheControl: { type: 'ephemeral' },
        },
      };
    }
  } else if (profile.provider === 'openrouter') {
    if (profile.model.startsWith('anthropic/')) {
      return {
        openrouter: {
          cacheControl: { type: 'ephemeral' },
        },
      };
    }
  }

  return undefined;
};

export const getProviderOptions = (llmProvider: LlmProvider): Record<string, Record<string, JSONValue>> | undefined => {
  if (isGeminiProvider(llmProvider)) {
    return {
      google: {
        ...((llmProvider.includeThoughts || llmProvider.thinkingBudget) && {
          thinkingConfig: {
            includeThoughts: llmProvider.includeThoughts,
            thinkingBudget: llmProvider.thinkingBudget ?? 0,
          },
        }),
      } satisfies GoogleGenerativeAIProviderOptions,
    };
  }

  return undefined;
};
