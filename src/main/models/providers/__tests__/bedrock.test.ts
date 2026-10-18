import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResourceNotFoundException } from '@aws-sdk/client-bedrock';
import { ProviderProfile, SettingsData } from '@common/types';

import { loadBedrockModels } from '../bedrock';

import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));

vi.mock('@aws-sdk/client-bedrock', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@aws-sdk/client-bedrock')>()),
  BedrockClient: class {
    send = mockSend;
  },
}));

vi.mock('@/logger');
vi.mock('@/utils', () => ({
  getEffectiveEnvironmentVariable: vi.fn(),
}));

const profile: ProviderProfile = {
  id: 'bedrock-test',
  provider: { name: 'bedrock', region: 'us-east-1' },
};
const settings = {} as SettingsData;

const inferenceProfile = (modelId: string) => ({
  inferenceProfileId: `us.${modelId}`,
  status: 'ACTIVE',
  models: [{ modelArn: `arn:aws:bedrock:us-east-1::foundation-model/${modelId}` }],
});

const availableResponse = {
  authorizationStatus: 'AUTHORIZED',
  entitlementAvailability: 'AVAILABLE',
  regionAvailability: 'AVAILABLE',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSend.mockReset();
  vi.mocked(getEffectiveEnvironmentVariable).mockImplementation((name) => (name === 'AWS_PROFILE' ? { value: 'test-profile', source: 'test' } : undefined));
});

describe('loadBedrockModels', () => {
  it('skips retired models at debug level while still discovering available models', async () => {
    const error = new ResourceNotFoundException({
      message: 'This model version has reached the end of its life.',
      $metadata: { httpStatusCode: 404 },
    });
    mockSend
      .mockResolvedValueOnce({ inferenceProfileSummaries: [inferenceProfile('retired-model'), inferenceProfile('active-model')] })
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(availableResponse);

    const result = await loadBedrockModels(profile, settings);

    expect(result).toEqual({
      success: true,
      models: [{ id: 'us.active-model', providerId: profile.id }],
    });
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(`Profile us.retired-model with model retired-model is no longer available: ${error.message}`);
  });

  it('succeeds with an empty model list when all profiles refer to missing models', async () => {
    mockSend
      .mockResolvedValueOnce({ inferenceProfileSummaries: [inferenceProfile('missing-model')] })
      .mockRejectedValueOnce(new ResourceNotFoundException({ message: 'Model not found', $metadata: {} }));

    expect(await loadBedrockModels(profile, settings)).toEqual({ success: true, models: [] });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('keeps unexpected availability failures at error level and discovers other models', async () => {
    const error = new Error('Unexpected availability failure');
    mockSend
      .mockResolvedValueOnce({ inferenceProfileSummaries: [inferenceProfile('failed-model'), inferenceProfile('active-model')] })
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(availableResponse);

    expect(await loadBedrockModels(profile, settings)).toEqual({
      success: true,
      models: [{ id: 'us.active-model', providerId: profile.id }],
    });
    expect(logger.error).toHaveBeenCalledWith('Error checking availability for profile us.failed-model with model failed-model:', error);
  });

  it('still reports discovery failure if listing profiles fails with ResourceNotFoundException', async () => {
    const error = new ResourceNotFoundException({ message: 'Listing failed', $metadata: {} });
    mockSend.mockRejectedValueOnce(error);

    expect(await loadBedrockModels(profile, settings)).toEqual({ success: false, models: [], error: error.message });
  });
});
