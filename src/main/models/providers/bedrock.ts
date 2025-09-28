import { BedrockClient, GetFoundationModelAvailabilityCommand, type InferenceProfileSummary, ListInferenceProfilesCommand } from '@aws-sdk/client-bedrock';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { Model, ModelInfo, ProviderProfile, SettingsData, UsageReportData } from '@common/types';
import { BedrockProvider, isBedrockProvider } from '@common/agent';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';

import type { LanguageModel, LanguageModelUsage } from 'ai';

import { AiderModelMapping, LlmProviderStrategy } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { Project } from '@/project/project';
import { LoadModelsResponse } from '@/models/types';

export const loadBedrockModels = async (profile: ProviderProfile, modelsInfo: Record<string, ModelInfo>): Promise<LoadModelsResponse> => {
  if (!isBedrockProvider(profile.provider)) {
    return {
      models: [],
      success: false,
    };
  }

  const provider = profile.provider as BedrockProvider;
  const regionEnv = getEffectiveEnvironmentVariable('AWS_REGION', undefined);
  const region = provider.region || regionEnv?.value || '';
  const accessKeyIdEnv = getEffectiveEnvironmentVariable('AWS_ACCESS_KEY_ID', undefined);
  const accessKeyId = provider.accessKeyId || accessKeyIdEnv?.value || '';
  const secretAccessKeyEnv = getEffectiveEnvironmentVariable('AWS_SECRET_ACCESS_KEY', undefined);
  const secretAccessKey = provider.secretAccessKey || secretAccessKeyEnv?.value || '';
  const sessionTokenEnv = getEffectiveEnvironmentVariable('AWS_SESSION_TOKEN', undefined);
  const sessionToken = provider.sessionToken || sessionTokenEnv?.value || '';
  const profileEnv = getEffectiveEnvironmentVariable('AWS_PROFILE', undefined);

  if (!region) {
    logger.debug('AWS region is required for Bedrock. Please set it in Providers settings or via AWS_REGION environment variable.');
    return {
      models: [],
      success: false,
    };
  }

  // Check if we have explicit keys or if AWS_PROFILE is set in the main process env
  if (!accessKeyId && !secretAccessKey && !profileEnv?.value) {
    return {
      models: [],
      success: false,
    };
  }

  try {
    const client = new BedrockClient({
      region,
      ...(accessKeyId &&
        secretAccessKey && {
          credentials: {
            accessKeyId,
            secretAccessKey,
            sessionToken: sessionToken || undefined,
          },
        }),
    });

    const allActiveProfiles: InferenceProfileSummary[] = [];
    let nextToken: string | undefined;

    do {
      const command = new ListInferenceProfilesCommand({
        maxResults: 50,
        nextToken,
      });

      const response = await client.send(command);
      nextToken = response.nextToken; // Will be undefined if no more pages

      // Collect active profiles
      const pageActiveProfiles = response.inferenceProfileSummaries?.filter((profile) => profile.status === 'ACTIVE') || [];
      allActiveProfiles.push(...pageActiveProfiles);
    } while (nextToken);

    // Now, prepare availability checks in parallel
    const availabilityPromises = allActiveProfiles.map(async (inferenceProfile) => {
      if (!inferenceProfile.inferenceProfileId || !inferenceProfile.models || inferenceProfile.models.length === 0) {
        logger.warn('Profile missing inferenceProfileId or models, skipping');
        return Promise.reject(new Error('Invalid profile'));
      }

      // Extract modelId from the first model's modelArn
      const firstModelArn = inferenceProfile.models[0].modelArn;
      const modelId = firstModelArn ? firstModelArn.split('/').pop() : undefined;

      if (!modelId) {
        logger.warn('Unable to extract modelId from profile, skipping');
        return Promise.reject(new Error('Invalid modelId'));
      }

      const availabilityCommand = new GetFoundationModelAvailabilityCommand({
        modelId,
      });

      try {
        const response = await client.send(availabilityCommand);
        return { profile: inferenceProfile, modelId, response };
      } catch (error) {
        logger.error(`Error checking availability for profile ${inferenceProfile.inferenceProfileId!} with model ${modelId!}:`, error);
        return null;
      }
    });

    const availabilityResults = await Promise.all(availabilityPromises);

    const availableProfiles: Model[] = [];
    for (const result of availabilityResults) {
      if (!result) {
        continue;
      }

      const { profile: inferenceProfile, modelId, response } = result;

      // Check if the model is authorized and available
      if (response.authorizationStatus === 'AUTHORIZED' && response.entitlementAvailability === 'AVAILABLE' && response.regionAvailability === 'AVAILABLE') {
        const info = modelsInfo[modelId];
        if (info) {
          availableProfiles.push({
            id: inferenceProfile.inferenceProfileId!,
            providerId: profile.id,
            ...info,
          });
        } else {
          availableProfiles.push({
            id: inferenceProfile.inferenceProfileId!,
            providerId: profile.id,
          });
        }
        logger.debug(`Profile ${inferenceProfile.inferenceProfileId!} with model ${modelId!} is available and authorized`);
      } else {
        logger.debug(`Profile ${inferenceProfile.inferenceProfileId!} with model ${modelId!} is not available or not authorized`, {
          authorizationStatus: response.authorizationStatus,
          entitlementAvailability: response.entitlementAvailability,
          regionAvailability: response.regionAvailability,
        });
      }
    }

    return { models: availableProfiles, success: true };
  } catch (error) {
    return {
      models: [],
      success: false,
      error: typeof error === 'string' ? error : error instanceof Error ? error.message : JSON.stringify(error),
    };
  }
};

export const hasBedrockEnvVars = (projectDir?: string, settings?: SettingsData): boolean => {
  const region = getEffectiveEnvironmentVariable('AWS_REGION', projectDir, settings)?.value;
  const accessKeyId = getEffectiveEnvironmentVariable('AWS_ACCESS_KEY_ID', projectDir, settings)?.value;
  const profile = getEffectiveEnvironmentVariable('AWS_PROFILE', projectDir, settings)?.value;
  return !!region && (!!accessKeyId || !!profile);
};

export const getBedrockAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  const bedrockProvider = provider.provider as BedrockProvider;
  const envVars: Record<string, string> = {};

  if (bedrockProvider.accessKeyId) {
    envVars.AWS_ACCESS_KEY_ID = bedrockProvider.accessKeyId;
  }

  if (bedrockProvider.secretAccessKey) {
    envVars.AWS_SECRET_ACCESS_KEY = bedrockProvider.secretAccessKey;
  }

  if (bedrockProvider.region) {
    envVars.AWS_DEFAULT_REGION = bedrockProvider.region;
  }

  if (bedrockProvider.sessionToken) {
    envVars.AWS_SESSION_TOKEN = bedrockProvider.sessionToken;
  }

  return {
    modelName: `bedrock/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
export const createBedrockLlm = (profile: ProviderProfile, model: string, env: Record<string, string | undefined> = {}): LanguageModel => {
  const provider = profile.provider as BedrockProvider;
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
      'AWS credentials (accessKeyId/secretAccessKey) or AWS_PROFILE must be provided for Bedrock in Providers settings or Aider environment variables.',
    );
  }

  // AI SDK Bedrock provider handles credentials via environment variables or default chain.
  // We pass credentials explicitly only if they were found in config or env.
  // Otherwise, we let the SDK handle the default credential chain (which includes AWS_PROFILE from process.env).
  const bedrockProviderInstance = createAmazonBedrock({
    region,
    headers: profile.headers,
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
};

// === Cost and Usage Functions ===
export const calculateBedrockCost = (modelInfo: ModelInfo | undefined, sentTokens: number, receivedTokens: number, _providerMetadata?: unknown): number => {
  if (!modelInfo) {
    return 0;
  }

  // Standard cost calculation without caching adjustments
  const inputCost = sentTokens * modelInfo.inputCostPerToken;
  const outputCost = receivedTokens * modelInfo.outputCostPerToken;

  return inputCost + outputCost;
};

export const getBedrockUsageReport = (
  project: Project,
  provider: ProviderProfile,
  modelId: string,
  messageCost: number,
  usage: LanguageModelUsage,
  _providerMetadata?: unknown,
): UsageReportData => {
  return {
    model: `${provider.id}/${modelId}`,
    sentTokens: usage.promptTokens,
    receivedTokens: usage.completionTokens,
    messageCost,
    agentTotalCost: project.agentTotalCost + messageCost,
  };
};

// === Complete Strategy Implementation ===
export const bedrockProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createBedrockLlm,
  calculateCost: calculateBedrockCost,
  getUsageReport: getBedrockUsageReport,

  // Model discovery functions
  loadModels: loadBedrockModels,
  hasEnvVars: hasBedrockEnvVars,
  getAiderMapping: getBedrockAiderMapping,
};
