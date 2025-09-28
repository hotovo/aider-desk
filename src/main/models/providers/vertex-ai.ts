import { v1beta1 } from '@google-cloud/aiplatform';
import { GoogleAuth } from 'google-auth-library';
import { Model, ModelInfo, ProviderProfile, UsageReportData } from '@common/types';
import { isVertexAiProvider, LlmProvider, VertexAiProvider } from '@common/agent';
import { createVertex } from '@ai-sdk/google-vertex';

import type { JSONValue, LanguageModel, LanguageModelUsage } from 'ai';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { Project } from '@/project/project';

export const loadVertexAIModels = async (profile: ProviderProfile, modelsInfo: Record<string, ModelInfo>): Promise<LoadModelsResponse> => {
  if (!isVertexAiProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider as VertexAiProvider;

  const projectEnv = getEffectiveEnvironmentVariable('VERTEX_PROJECT', undefined);
  const locationEnv = getEffectiveEnvironmentVariable('VERTEX_LOCATION', undefined);
  const credentialsEnv = getEffectiveEnvironmentVariable('GOOGLE_APPLICATION_CREDENTIALS', undefined);

  const project = provider.project || projectEnv?.value || '';
  const location = provider.location || locationEnv?.value || 'global';
  const googleCloudCredentialsJson = provider.googleCloudCredentialsJson || credentialsEnv?.value || '';

  if (!project) {
    logger.debug('Vertex AI project ID is required. Please set it in Providers settings or via VERTEXAI_PROJECT environment variable.');
    return { models: [], success: false };
  }

  if (!location) {
    logger.debug('Vertex AI location is required. Please set it in Providers settings or via VERTEXAI_LOCATION environment variable.');
    return { models: [], success: false };
  }

  try {
    let auth: GoogleAuth;
    if (googleCloudCredentialsJson) {
      // Use provided credentials JSON
      auth = new GoogleAuth({
        credentials: JSON.parse(googleCloudCredentialsJson),
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
    } else {
      // Use default credentials (e.g., gcloud, environment variables, or service account)
      auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
    }

    const clientOptions = {
      apiEndpoint: 'aiplatform.googleapis.com',
      auth,
    };

    const modelGardenServiceClient = new v1beta1.ModelGardenServiceClient(clientOptions);
    const [response] = await modelGardenServiceClient.listPublisherModels({
      parent: 'publishers/google',
    });

    const models = response
      .map((model) => {
        const modelId = model.name?.split('/').pop();
        const info = modelsInfo[modelId || ''];

        return {
          id: modelId,
          providerId: profile.id,
          ...info,
        };
      })
      .filter((model) => model.id) as Model[];

    logger.info(`Loaded ${models.length} Vertex AI models for project ${project} in location ${location} for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg =
      typeof error === 'string'
        ? error
        : error instanceof Error
          ? error.message
          : `Error loading Vertex AI models for project ${project} in location ${location}`;
    logger.error(errorMsg);
    return { models: [], success: false, error: errorMsg };
  }
};

export const hasVertexAiEnvVars = (): boolean => {
  // Vertex AI doesn't have a simple environment variable check like other providers
  // It requires project, location, and potentially credentials
  return false;
};

export const getVertexAiAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  const vertexProvider = provider.provider as VertexAiProvider;
  const envVars: Record<string, string> = {};

  if (vertexProvider.project) {
    envVars.VERTEXAI_PROJECT = vertexProvider.project;
  }

  if (vertexProvider.location) {
    envVars.VERTEXAI_LOCATION = vertexProvider.location;
  }

  if (vertexProvider.googleCloudCredentialsJson) {
    envVars.GOOGLE_APPLICATION_CREDENTIALS_JSON = vertexProvider.googleCloudCredentialsJson;
  }

  // Aider uses vertex_ai prefix instead of vertex-ai
  return {
    modelName: `vertex_ai/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
export const createVertexAiLlm = (profile: ProviderProfile, model: string, env: Record<string, string | undefined> = {}): LanguageModel => {
  const provider = profile.provider as VertexAiProvider;
  const project = provider.project || env['VERTEXAI_PROJECT'];
  const location = provider.location || env['VERTEXAI_LOCATION'] || 'global';

  if (!project) {
    throw new Error('Vertex AI project is required in Providers settings or Aider environment variables (VERTEXAI_PROJECT)');
  }

  const vertexProvider = createVertex({
    project: provider.project,
    location: provider.location,
    headers: profile.headers,
    // using custom base URL to fix the 'global' location
    baseURL: `https://${location && location !== 'global' ? location + '-' : ''}aiplatform.googleapis.com/v1/projects/${provider.project}/locations/${provider.location}/publishers/google`,
    ...(provider.googleCloudCredentialsJson && {
      credentials: JSON.parse(provider.googleCloudCredentialsJson),
    }),
  });
  return vertexProvider(model);
};

type VertexGoogleMetadata = {
  google: {
    cachedContentTokenCount?: number;
  };
};

// === Cost and Usage Functions ===
export const calculateVertexAiCost = (modelInfo: ModelInfo | undefined, sentTokens: number, receivedTokens: number, providerMetadata?: unknown): number => {
  if (!modelInfo) {
    return 0;
  }

  let inputCost = sentTokens * modelInfo.inputCostPerToken;
  const outputCost = receivedTokens * modelInfo.outputCostPerToken;
  let cacheCost = 0;

  const { google } = (providerMetadata as VertexGoogleMetadata) || {};
  if (google) {
    const cachedPromptTokens = google.cachedContentTokenCount ?? 0;

    inputCost = (sentTokens - cachedPromptTokens) * modelInfo.inputCostPerToken;
    cacheCost = cachedPromptTokens * (modelInfo.cacheReadInputTokenCost ?? modelInfo.inputCostPerToken * 0.25);
  }

  return inputCost + outputCost + cacheCost;
};

export const getVertexAiUsageReport = (
  project: Project,
  provider: ProviderProfile,
  modelId: string,
  messageCost: number,
  usage: LanguageModelUsage,
  providerMetadata?: unknown,
): UsageReportData => {
  const usageReportData: UsageReportData = {
    model: `${provider.id}/${modelId}`,
    sentTokens: usage.promptTokens,
    receivedTokens: usage.completionTokens,
    messageCost,
    agentTotalCost: project.agentTotalCost + messageCost,
  };

  const { google } = (providerMetadata as VertexGoogleMetadata) || {};
  if (google) {
    usageReportData.cacheReadTokens = google.cachedContentTokenCount;
    usageReportData.sentTokens -= usageReportData.cacheReadTokens ?? 0;
  }

  return usageReportData;
};

export const getVertexAiProviderOptions = (llmProvider: LlmProvider): Record<string, Record<string, JSONValue>> | undefined => {
  if (isVertexAiProvider(llmProvider)) {
    return {
      google: {
        ...((llmProvider.includeThoughts || llmProvider.thinkingBudget) && {
          thinkingConfig: {
            includeThoughts: llmProvider.includeThoughts && (llmProvider.thinkingBudget ?? 0) > 0,
            thinkingBudget: llmProvider.thinkingBudget || null,
          },
        }),
      },
    };
  }

  return undefined;
};

// === Complete Strategy Implementation ===
export const vertexAiProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createVertexAiLlm,
  calculateCost: calculateVertexAiCost,
  getUsageReport: getVertexAiUsageReport,

  // Model discovery functions
  loadModels: loadVertexAIModels,
  hasEnvVars: hasVertexAiEnvVars,
  getAiderMapping: getVertexAiAiderMapping,

  // Configuration helpers
  getProviderOptions: getVertexAiProviderOptions,
};
