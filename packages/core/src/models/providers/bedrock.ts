import { BedrockClient, GetFoundationModelAvailabilityCommand, type InferenceProfileSummary, ListInferenceProfilesCommand } from '@aws-sdk/client-bedrock';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { Model, ModelInfo, ProviderProfile, SettingsData } from '@aider-desk/common/types';
import { BedrockProvider, DEFAULT_MODEL_TEMPERATURE, isBedrockProvider } from '@aider-desk/common/agent';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';

import type { LanguageModelV2 } from '@ai-sdk/provider';

import { AiderModelMapping, LlmProviderStrategy } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { LoadModelsResponse } from '@/models/types';
import { getDefaultUsageReport } from '@/models/providers/default';

export const loadBedrockModels = async (profile: ProviderProfile, settings: SettingsData): Promise<LoadModelsResponse> => {
  if (!isBedrockProvider(profile.provider)) {
    return {
      models: [],
      success: false,
    };
  }

  const provider = profile.provider as BedrockProvider;
  const regionEnv = getEffectiveEnvironmentVariable('AWS_REGION', settings);
  const region = provider.region || regionEnv?.value || '';
  const accessKeyIdEnv = getEffectiveEnvironmentVariable('AWS_ACCESS_KEY_ID', settings);
  const accessKeyId = provider.accessKeyId || accessKeyIdEnv?.value || '';
  const secretAccessKeyEnv = getEffectiveEnvironmentVariable('AWS_SECRET_ACCESS_KEY', settings);
  const secretAccessKey = provider.secretAccessKey || secretAccessKeyEnv?.value || '';
  const sessionTokenEnv = getEffectiveEnvironmentVariable('AWS_SESSION_TOKEN', settings);
  const sessionToken = provider.sessionToken || sessionTokenEnv?.value || '';
  const profileEnv = getEffectiveEnvironmentVariable('AWS_PROFILE', settings);

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

    const availableModels: Model[] = [];
    for (const result of availabilityResults) {
      if (!result) {
        continue;
      }

      const { profile: inferenceProfile, modelId, response } = result;

      // Check if the model is authorized and available
      if (response.authorizationStatus === 'AUTHORIZED' && response.entitlementAvailability === 'AVAILABLE' && response.regionAvailability === 'AVAILABLE') {
        availableModels.push({
          id: inferenceProfile.inferenceProfileId!,
          providerId: profile.id,
          temperature: DEFAULT_MODEL_TEMPERATURE,
        });
        logger.debug(`Profile ${inferenceProfile.inferenceProfileId!} with model ${modelId!} is available and authorized`);
      } else {
        logger.debug(`Profile ${inferenceProfile.inferenceProfileId!} with model ${modelId!} is not available or not authorized`, {
          authorizationStatus: response.authorizationStatus,
          entitlementAvailability: response.entitlementAvailability,
          regionAvailability: response.regionAvailability,
        });
      }
    }

    return { models: availableModels, success: true };
  } catch (error) {
    return {
      models: [],
      success: false,
      error: typeof error === 'string' ? error : error instanceof Error ? error.message : JSON.stringify(error),
    };
  }
};

export const hasBedrockEnvVars = (settings: SettingsData): boolean => {
  const region = getEffectiveEnvironmentVariable('AWS_REGION', settings, undefined)?.value;
  const accessKeyId = getEffectiveEnvironmentVariable('AWS_ACCESS_KEY_ID', settings, undefined)?.value;
  const profile = getEffectiveEnvironmentVariable('AWS_PROFILE', settings, undefined)?.value;
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
export const createBedrockLlm = (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): LanguageModelV2 => {
  const provider = profile.provider as BedrockProvider;
  let region = provider.region;
  let accessKeyId = provider.accessKeyId;
  let secretAccessKey = provider.secretAccessKey;
  let sessionToken = provider.sessionToken;

  if (!region) {
    const effectiveVar = getEffectiveEnvironmentVariable('AWS_REGION', settings, projectDir);
    if (effectiveVar) {
      region = effectiveVar.value;
      logger.debug(`Loaded AWS_REGION from ${effectiveVar.source}`);
    }
  }

  if (!region) {
    throw new Error('AWS region is required for Bedrock. You can set it in the MCP settings or Aider environment variables (AWS_REGION).');
  }

  if (!accessKeyId) {
    const effectiveVar = getEffectiveEnvironmentVariable('AWS_ACCESS_KEY_ID', settings, projectDir);
    if (effectiveVar) {
      accessKeyId = effectiveVar.value;
      logger.debug(`Loaded AWS_ACCESS_KEY_ID from ${effectiveVar.source}`);
    }
  }

  if (!secretAccessKey) {
    const effectiveVar = getEffectiveEnvironmentVariable('AWS_SECRET_ACCESS_KEY', settings, projectDir);
    if (effectiveVar) {
      secretAccessKey = effectiveVar.value;
      logger.debug(`Loaded AWS_SECRET_ACCESS_KEY from ${effectiveVar.source}`);
    }
  }

  if (!sessionToken) {
    const effectiveVar = getEffectiveEnvironmentVariable('AWS_SESSION_TOKEN', settings, projectDir);
    if (effectiveVar) {
      sessionToken = effectiveVar.value;
      logger.debug(`Loaded AWS_SESSION_TOKEN from ${effectiveVar.source}`);
    }
  }

  const awsProfile = getEffectiveEnvironmentVariable('AWS_PROFILE', settings, projectDir);

  if (!accessKeyId && !secretAccessKey && !awsProfile) {
    throw new Error(
      'AWS credentials (accessKeyId/secretAccessKey) or AWS_PROFILE must be provided for Bedrock in Providers settings or Aider environment variables.',
    );
  }

  const bedrockProviderInstance = createAmazonBedrock({
    region,
    headers: profile.headers,
    ...(accessKeyId &&
      secretAccessKey && {
        accessKeyId,
        secretAccessKey,
        sessionToken,
      }),
    credentialProvider: !accessKeyId && !secretAccessKey ? fromNodeProviderChain() : undefined,
  });
  return bedrockProviderInstance(model.id);
};

const getBedrockModelInfo = (_provider: ProviderProfile, modelId: string, allModelInfos: Record<string, ModelInfo>): ModelInfo | undefined => {
  const fullModelId = `amazon-bedrock/${modelId}`;
  const allModelInfo = allModelInfos[fullModelId];
  if (allModelInfo) {
    return allModelInfo;
  }

  // check by model part of the model name (e.g. excluding any prefix before the first dot)
  // Remove prefix before first dot if present (e.g., "us.anthropic.claude-3-sonnet-20240229-v1:0" -> "anthropic.claude-3-sonnet-20240229-v1:0")
  const modelIdWithoutPrefix = modelId.includes('.') ? modelId.split('.').slice(1).join('.') : modelId;

  for (const key of Object.keys(allModelInfos)) {
    // Check if key ends with the modelId without prefix
    if (key === `amazon-bedrock/${modelIdWithoutPrefix}`) {
      return allModelInfos[key];
    }
  }

  return undefined;
};

// === Complete Strategy Implementation ===
export const bedrockProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createBedrockLlm,
  getUsageReport: getDefaultUsageReport,

  // Model discovery functions
  loadModels: loadBedrockModels,
  hasEnvVars: hasBedrockEnvVars,
  getAiderMapping: getBedrockAiderMapping,
  getModelInfo: getBedrockModelInfo,
};
