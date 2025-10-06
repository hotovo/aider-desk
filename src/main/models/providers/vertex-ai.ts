import { v1beta1 } from '@google-cloud/aiplatform';
import { GoogleAuth } from 'google-auth-library';
import { Model, ModelInfo, ProviderProfile, SettingsData, UsageReportData } from '@common/types';
import { isVertexAiProvider, LlmProvider, VertexAiProvider } from '@common/agent';
import { createVertex } from '@ai-sdk/google-vertex';

import type { JSONValue, LanguageModel, LanguageModelUsage } from 'ai';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { Project } from '@/project/project';

export const loadVertexAIModels = async (
  profile: ProviderProfile,
  modelsInfo: Record<string, ModelInfo>,
  settings: SettingsData,
): Promise<LoadModelsResponse> => {
  if (!isVertexAiProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider as VertexAiProvider;

  const projectEnv = getEffectiveEnvironmentVariable('VERTEX_PROJECT', settings);
  const locationEnv = getEffectiveEnvironmentVariable('VERTEX_LOCATION', settings);
  const credentialsEnv = getEffectiveEnvironmentVariable('GOOGLE_APPLICATION_CREDENTIALS', settings);

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

export const hasVertexAiEnvVars = (_settings: SettingsData): boolean => {
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
export const createVertexAiLlm = (
  profile: ProviderProfile,
  model: string,
  settings: SettingsData,
  projectDir: string
): LanguageModel => {
  const provider = profile.provider as VertexAiProvider;
  
  let project = provider.project;
  if (!project) {
    const effectiveVar = getEffectiveEnvironmentVariable('VERTEXAI_PROJECT', settings, projectDir);
    if (effectiveVar) {
      project = effectiveVar.value;
      logger.debug(`Loaded VERTEXAI_PROJECT from ${effectiveVar.source}`);
    }
  }
  
  if (!project) {
    throw new Error('Vertex AI project is required in Providers settings or Aider environment variables (VERTEXAI_PROJECT)');
  }
  
  let location = provider.location;
  if (!location) {
    const effectiveVar = getEffectiveEnvironmentVariable('VERTEXAI_LOCATION', settings, projectDir);
    if (effectiveVar) {
      location = effectiveVar.value;
      logger.debug(`Loaded VERTEXAI_LOCATION from ${effectiveVar.source}`);
    }
  }
  
  if (!location) {
    location = 'global';
  }
  
  let googleCloudCredentialsJson = provider.googleCloudCredentialsJson;
  if (!googleCloudCredentialsJson) {
    const effectiveVar = getEffectiveEnvironmentVariable('GOOGLE_APPLICATION_CREDENTIALS', settings, projectDir);
    if (effectiveVar) {
      googleCloudCredentialsJson = effectiveVar.value;
      logger.debug(`Loaded GOOGLE_APPLICATION_CREDENTIALS from ${effectiveVar.source}`);
    }
  }

  const vertexProvider = createVertex({
    project,
    location,
    headers: profile.headers,
    baseURL: `https://${location && location !== 'global' ? location + '-' : ''}aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google`,
    ...(googleCloudCredentialsJson && {
      credentials: JSON.parse(googleCloudCredentialsJson),
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

export const getVertexAiProviderOptions = (llmProvider: LlmProvider, model: Model): Record<string, Record<string, JSONValue>> | undefined => {
  if (isVertexAiProvider(llmProvider)) {
    const providerOverrides = model.providerOverrides as Partial<VertexAiProvider> | undefined;

    // Use model-specific overrides, falling back to provider defaults
    const includeThoughts = providerOverrides?.includeThoughts ?? llmProvider.includeThoughts;
    const thinkingBudget = providerOverrides?.thinkingBudget ?? llmProvider.thinkingBudget;

    return {
      google: {
        ...((includeThoughts || thinkingBudget) && {
          thinkingConfig: {
            includeThoughts: includeThoughts && (thinkingBudget ?? 0) > 0,
            thinkingBudget: thinkingBudget || null,
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
