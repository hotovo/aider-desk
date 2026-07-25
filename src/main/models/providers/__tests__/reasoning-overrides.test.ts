import { describe, expect, it, vi } from 'vitest';
import { AlibabaPlanProvider, AnthropicCompatibleProvider, AnthropicProvider, AzureProvider, DeepseekProvider, MinimaxProvider } from '@common/agent';
import { Model, ReasoningEffort } from '@common/types';

import { alibabaPlanProviderStrategy } from '../alibaba-plan';
import { getAnthropicProviderOptions } from '../anthropic';
import { getAnthropicCompatibleProviderOptions } from '../anthropic-compatible';
import { azureProviderStrategy } from '../azure';
import { deepseekProviderStrategy } from '../deepseek';
import { getMinimaxProviderOptions } from '../minimax';

vi.mock('@/logger');

const model: Model = {
  id: 'test-model',
  providerId: 'test-provider',
};

describe('provider reasoning overrides', () => {
  it('lets portable reasoning control Alibaba thinking', () => {
    const provider: AlibabaPlanProvider = {
      name: 'alibaba-plan',
      apiKey: 'test',
      thinkingEnabled: true,
      thinkingBudget: 8192,
    };

    expect(alibabaPlanProviderStrategy.getProviderOptions?.(provider, model, 'high')).toBeUndefined();
    expect(alibabaPlanProviderStrategy.getProviderOptions?.(provider, model, 'none')).toBeUndefined();
    expect(alibabaPlanProviderStrategy.getProviderOptions?.(provider, model, 'provider-default')).toEqual({
      alibaba: {
        enableThinking: true,
        thinkingBudget: 8192,
      },
    });
  });

  it.each([
    ['Anthropic', getAnthropicProviderOptions, { name: 'anthropic', apiKey: 'test' } as AnthropicProvider],
    ['Anthropic-compatible', getAnthropicCompatibleProviderOptions, { name: 'anthropic-compatible', apiKey: 'test' } as AnthropicCompatibleProvider],
    ['MiniMax', getMinimaxProviderOptions, { name: 'minimax', apiKey: 'test' } as MinimaxProvider],
  ])('lets portable reasoning control %s thinking', (_name, getProviderOptions, provider) => {
    expect(getProviderOptions(provider, model, 'none')).toBeUndefined();
    expect(getProviderOptions(provider, model, 'high')).toBeUndefined();
    expect(getProviderOptions(provider, model, 'provider-default')).toEqual({
      anthropic: {
        thinking: { type: 'adaptive', display: 'summarized' },
      },
    });
  });

  it('uses the effective reasoning override for Azure parameters', () => {
    const provider: AzureProvider = {
      name: 'azure',
      apiKey: 'test',
      resourceName: 'test',
      reasoningEffort: ReasoningEffort.High,
    };

    expect(azureProviderStrategy.getProviderParameters?.(provider, model, 'none')).toEqual({});

    provider.reasoningEffort = ReasoningEffort.None;
    expect(azureProviderStrategy.getProviderParameters?.(provider, model, 'high')).toEqual({
      maxOutputTokens: undefined,
      temperature: undefined,
    });
  });

  it('uses the effective reasoning override for DeepSeek parameters', () => {
    const provider: DeepseekProvider = {
      name: 'deepseek',
      apiKey: 'test',
      thinkingEnabled: true,
    };

    expect(deepseekProviderStrategy.getProviderParameters?.(provider, model, 'none')).toEqual({});

    provider.thinkingEnabled = false;
    expect(deepseekProviderStrategy.getProviderParameters?.(provider, model, 'high')).toEqual({
      temperature: undefined,
      topP: undefined,
    });
  });
});
