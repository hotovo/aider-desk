import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenCodeGoProvider } from '@common/agent';
import { Model, ProviderProfile, SettingsData } from '@common/types';

const mockCreateOpenAI = vi.fn();
const mockOpenAiResponses = vi.fn();
const mockCreateAnthropic = vi.fn();
const mockAnthropicModel = vi.fn();
const mockCreateOpenAICompatible = vi.fn();
const mockCompatibleModel = vi.fn();

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: (...args: unknown[]) => {
    mockCreateOpenAI(...args);
    return { responses: mockOpenAiResponses };
  },
}));

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: (...args: unknown[]) => {
    mockCreateAnthropic(...args);
    return mockAnthropicModel;
  },
}));

vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: (...args: unknown[]) => {
    mockCreateOpenAICompatible(...args);
    return mockCompatibleModel;
  },
}));

vi.mock('@/logger');

import { createOpencodeGoLlm } from '../opencode-go';

const profile: ProviderProfile = {
  id: 'opencode-go-profile',
  provider: {
    name: 'opencode-go',
    apiKey: 'test-api-key',
  } as OpenCodeGoProvider,
};

const settings = {} as SettingsData;

describe('createOpencodeGoLlm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('includes x-opencode-session header when sessionId is provided (openai-responses)', () => {
    const model: Model = { id: 'grok-4.5', providerId: 'opencode-go-profile' };
    createOpencodeGoLlm(profile, model, settings, '/project', undefined, undefined, undefined, undefined, 'test-session-123');

    expect(mockCreateOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'test-api-key',
        headers: {
          'x-opencode-session': 'test-session-123',
        },
      }),
    );
  });

  it('includes x-opencode-session header when sessionId is provided (anthropic)', () => {
    const model: Model = { id: 'minimax-m3', providerId: 'opencode-go-profile' };
    createOpencodeGoLlm(profile, model, settings, '/project', undefined, undefined, undefined, undefined, 'test-session-456');

    expect(mockCreateAnthropic).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'test-api-key',
        headers: {
          'x-opencode-session': 'test-session-456',
        },
      }),
    );
  });

  it('includes x-opencode-session header when sessionId is provided (openai-compatible)', () => {
    const model: Model = { id: 'other-model', providerId: 'opencode-go-profile' };
    createOpencodeGoLlm(profile, model, settings, '/project', undefined, undefined, undefined, undefined, 'test-session-789');

    expect(mockCreateOpenAICompatible).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'test-api-key',
        headers: {
          'x-opencode-session': 'test-session-789',
        },
      }),
    );
  });

  it('does NOT include x-opencode-session header when sessionId is not provided', () => {
    const model: Model = { id: 'grok-4.5', providerId: 'opencode-go-profile' };
    createOpencodeGoLlm(profile, model, settings, '/project');

    expect(mockCreateOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'test-api-key',
        headers: {},
      }),
    );
    const calledHeaders = mockCreateOpenAI.mock.calls[0][0].headers;
    expect(calledHeaders).not.toHaveProperty('x-opencode-session');
  });

  it('preserves existing profile headers when adding x-opencode-session', () => {
    const profileWithHeaders: ProviderProfile = {
      ...profile,
      headers: {
        'custom-header': 'custom-value',
      },
    };
    const model: Model = { id: 'grok-4.5', providerId: 'opencode-go-profile' };
    createOpencodeGoLlm(profileWithHeaders, model, settings, '/project', undefined, undefined, undefined, undefined, 'session-abc');

    expect(mockCreateOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: {
          'custom-header': 'custom-value',
          'x-opencode-session': 'session-abc',
        },
      }),
    );
  });
});
