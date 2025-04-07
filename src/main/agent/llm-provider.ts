import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import {
  isAnthropicProvider,
  isBedrockProvider,
  isDeepseekProvider,
  isGeminiProvider,
  isOpenAiCompatibleProvider,
  isOpenAiProvider,
  LlmProvider,
} from '@common/llm-providers';

import type { LanguageModel } from 'ai';

export const createLlm = (provider: LlmProvider): LanguageModel => {
  if (isAnthropicProvider(provider)) {
    if (!provider.apiKey) {
      throw new Error('Anthropic API key is required');
    }
    const anthropicProvider = createAnthropic({ apiKey: provider.apiKey });
    return anthropicProvider(provider.model);
  } else if (isOpenAiProvider(provider)) {
    if (!provider.apiKey) {
      throw new Error('OpenAI API key is required');
    }
    const openAIProvider = createOpenAI({ apiKey: provider.apiKey, compatibility: 'strict' });
    return openAIProvider(provider.model);
  } else if (isGeminiProvider(provider)) {
    if (!provider.apiKey) {
      throw new Error('Gemini API key is required');
    }
    const googleProvider = createGoogleGenerativeAI({ apiKey: provider.apiKey });
    return googleProvider(provider.model);
  } else if (isDeepseekProvider(provider)) {
    if (!provider.apiKey) {
      throw new Error('Deepseek API key is required');
    }
    const deepseekProvider = createDeepSeek({ apiKey: provider.apiKey });
    return deepseekProvider(provider.model);
  } else if (isOpenAiCompatibleProvider(provider)) {
    if (!provider.apiKey) {
      throw new Error('API key is required for OpenAI Compatible provider');
    }
    if (!provider.baseUrl) {
      throw new Error('Base URL is required for OpenAI Compatible provider');
    }
    if (!provider.model) {
      throw new Error('Model name is required for OpenAI Compatible provider');
    }
    // Use createOpenAICompatible to get a provider instance, then get the model
    const compatibleProvider = createOpenAICompatible({
      name: provider.name,
      apiKey: provider.apiKey,
      baseURL: provider.baseUrl,
    });
    return compatibleProvider(provider.model);
  } else if (isBedrockProvider(provider)) {
    if (!provider.region) {
      throw new Error('AWS region is required for Bedrock. You can set it in the MCP settings.');
    }
    if (!provider.accessKeyId && !provider.secretAccessKey && !process.env.AWS_PROFILE) {
      throw new Error('Either AWS_PROFILE environment variable or accessKeyId/secretAccessKey must be provided for Bedrock');
    }

    // AI SDK Bedrock provider handles credentials via environment variables or default chain
    // Explicit credentials can be passed if needed, but let's rely on defaults first
    const bedrockProviderInstance = createAmazonBedrock({
      region: provider.region,
      // Pass credentials if explicitly provided in settings
      ...(provider.accessKeyId &&
        provider.secretAccessKey && {
          accessKeyId: provider.accessKeyId,
          secretAccessKey: provider.secretAccessKey,
        }),
      credentialProvider: (!provider.accessKeyId && !provider.secretAccessKey && fromNodeProviderChain()) || undefined,
    });
    return bedrockProviderInstance(provider.model);
  } else {
    throw new Error(`Unsupported MCP provider: ${JSON.stringify(provider)}`);
  }
};
