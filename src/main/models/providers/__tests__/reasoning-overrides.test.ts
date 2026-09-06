import { describe, expect, it, vi } from 'vitest';
import {
  AlibabaPlanProvider,
  AnthropicCompatibleProvider,
  AnthropicProvider,
  AzureProvider,
  DeepseekProvider,
  GeminiProvider,
  MinimaxProvider,
  NeuralwattProvider,
  OpenAiCompatibleProvider,
  OpenAiProvider,
  VertexAiProvider,
  ZaiPlanProvider,
} from '@common/agent';
import { Model, ReasoningEffort } from '@common/types';

import { alibabaPlanProviderStrategy } from '../alibaba-plan';
import { getAnthropicProviderOptions } from '../anthropic';
import { getAnthropicCompatibleProviderOptions } from '../anthropic-compatible';
import { azureProviderStrategy } from '../azure';
import { deepseekProviderStrategy } from '../deepseek';
import { geminiProviderStrategy } from '../gemini';
import { getMinimaxProviderOptions } from '../minimax';
import { neuralwattProviderStrategy } from '../neuralwatt';
import { getOpenAiProviderOptions } from '../openai';
import { openaiCompatibleProviderStrategy } from '../openai-compatible';
import { vertexAiProviderStrategy } from '../vertex-ai';
import { zaiPlanProviderStrategy } from '../zai-plan';

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

  it('model.providerOverrides win over conflicting provider-level deepseek options', () => {
    const provider: DeepseekProvider = {
      name: 'deepseek',
      apiKey: 'test',
      thinkingEnabled: true,
    };

    // no override on the model -> the provider-level value applies (thinking enabled)
    expect(deepseekProviderStrategy.getProviderOptions?.(provider, model, 'provider-default')).toEqual({
      deepseek: {
        thinking: { type: 'enabled' },
        reasoningEffort: 'high',
      },
    });

    // conflicting model-level override wins over the provider-level value
    const overriddenModel = {
      ...model,
      // matches the runtime cast: model.providerOverrides is Record<string, unknown> on Model
      providerOverrides: { thinkingEnabled: false } as unknown as Partial<DeepseekProvider>,
    } as Model;

    expect(deepseekProviderStrategy.getProviderOptions?.(provider, overriddenModel, 'provider-default')).toEqual({
      deepseek: {
        thinking: { type: 'disabled' },
      },
    });
  });

  it('maps OpenAI reasoning effort to provider options', () => {
    const provider: OpenAiProvider = {
      name: 'openai',
      apiKey: 'test',
      useWebSearch: false,
      reasoningEffort: ReasoningEffort.High,
    };

    // With a top-level reasoning parameter set, only the summary stays (portable reasoning)
    expect(getOpenAiProviderOptions(provider, model, 'high')).toEqual({
      openai: {
        reasoningSummary: 'auto',
      },
    });

    // provider-default: map the configured reasoningEffort
    expect(getOpenAiProviderOptions(provider, model, 'provider-default')).toEqual({
      openai: {
        reasoningSummary: 'auto',
        reasoningEffort: 'high',
      },
    });

    // explicit None maps to no reasoningEffort at all
    provider.reasoningEffort = ReasoningEffort.None;
    expect(getOpenAiProviderOptions(provider, model, 'provider-default')).toBeUndefined();
  });

  it('maps Azure reasoning effort to provider options', () => {
    const provider: AzureProvider = {
      name: 'azure',
      apiKey: 'test',
      resourceName: 'test',
      reasoningEffort: ReasoningEffort.High,
    };

    expect(azureProviderStrategy.getProviderOptions?.(provider, model, 'high')).toEqual({
      openai: {
        reasoningSummary: 'auto',
      },
    });

    expect(azureProviderStrategy.getProviderOptions?.(provider, model, 'provider-default')).toEqual({
      openai: {
        reasoningSummary: 'auto',
        reasoningEffort: 'high',
      },
    });

    provider.reasoningEffort = ReasoningEffort.None;
    expect(azureProviderStrategy.getProviderOptions?.(provider, model, 'provider-default')).toBeUndefined();
  });

  it('passes extraBody through openai-compatible provider options', () => {
    const provider = {
      name: 'openai-compatible',
      apiKey: 'test',
      reasoningEffort: ReasoningEffort.High,
      extraBody: { my_extension: { temperature: { min: 0 } } },
    } as unknown as OpenAiCompatibleProvider;

    // provider-default: reasoningEffort mapped AND extraBody merged
    expect(openaiCompatibleProviderStrategy.getProviderOptions?.(provider, model, 'provider-default')).toEqual({
      'openai-compatible': {
        reasoningEffort: 'high',
        my_extension: { temperature: { min: 0 } },
      },
    });

    // With portable reasoning, reasoningEffort is omitted but extraBody is kept
    expect(openaiCompatibleProviderStrategy.getProviderOptions?.(provider, model, 'high')).toEqual({
      'openai-compatible': {
        my_extension: { temperature: { min: 0 } },
      },
    });

    // No options configured -> undefined
    expect(
      openaiCompatibleProviderStrategy.getProviderOptions?.({ name: 'openai-compatible' } as OpenAiCompatibleProvider, model, 'provider-default'),
    ).toBeUndefined();
  });

  it('maps zai-plan thinking branches to zaiPlan provider options', () => {
    const provider: ZaiPlanProvider = {
      name: 'zai-plan',
      apiKey: 'test',
      thinkingEnabled: true,
    };

    // provider-default: reasoningEffort (default Max) + tool_stream kept
    expect(zaiPlanProviderStrategy.getProviderOptions?.(provider, model, 'provider-default')).toEqual({
      zaiPlan: {
        reasoningEffort: 'max',
        tool_stream: true,
      },
    });

    // top-level reasoning set: thinking omitted, tool_stream kept
    expect(zaiPlanProviderStrategy.getProviderOptions?.(provider, model, 'high')).toEqual({
      zaiPlan: {
        tool_stream: true,
      },
    });

    // 'none' explicitly disables thinking
    expect(zaiPlanProviderStrategy.getProviderOptions?.(provider, model, 'none')).toEqual({
      zaiPlan: {
        thinking: { type: 'disabled' },
        tool_stream: true,
      },
    });

    // thinkingEnabled: false explicitly disables thinking
    const disabled: ZaiPlanProvider = { name: 'zai-plan', apiKey: 'test', thinkingEnabled: false };
    expect(zaiPlanProviderStrategy.getProviderOptions?.(disabled, model, 'provider-default')).toEqual({
      zaiPlan: {
        thinking: { type: 'disabled' },
        tool_stream: true,
      },
    });

    // tool call streaming disabled -> tool_stream option dropped
    const noStream: ZaiPlanProvider = { name: 'zai-plan', apiKey: 'test', thinkingEnabled: true, disableToolCallStreaming: true };
    expect(zaiPlanProviderStrategy.getProviderOptions?.(noStream, model, 'provider-default')).toEqual({
      zaiPlan: {
        reasoningEffort: 'max',
      },
    });
    expect(zaiPlanProviderStrategy.getProviderOptions?.(noStream, model, 'high')).toBeUndefined();
  });

  it('maps neuralwatt reasoning effort to neuralwatt provider options', () => {
    const provider: NeuralwattProvider = {
      name: 'neuralwatt',
      apiKey: 'test',
      reasoningEffort: ReasoningEffort.High,
    };

    expect(neuralwattProviderStrategy.getProviderOptions?.(provider, model, 'provider-default')).toEqual({
      neuralwatt: {
        reasoningEffort: 'high',
      },
    });

    // portable reasoning takes over
    expect(neuralwattProviderStrategy.getProviderOptions?.(provider, model, 'high')).toBeUndefined();
    expect(neuralwattProviderStrategy.getProviderOptions?.(provider, model, 'none')).toBeUndefined();

    // no effort configured -> undefined
    expect(
      neuralwattProviderStrategy.getProviderOptions?.({ name: 'neuralwatt', apiKey: 'test' } as NeuralwattProvider, model, 'provider-default'),
    ).toBeUndefined();
  });

  it('maps gemini thinking to the google metadata key', () => {
    const provider: GeminiProvider = {
      name: 'gemini',
      apiKey: 'test',
      includeThoughts: true,
      thinkingBudget: 1024,
      useSearchGrounding: false,
    };
    const strategy = geminiProviderStrategy;

    expect(strategy.getProviderOptions?.(provider, model, 'provider-default')).toEqual({
      google: {
        thinkingConfig: {
          includeThoughts: true,
          thinkingBudget: 1024,
        },
      },
    });

    // includeThoughts survives portable reasoning, thinkingBudget does not
    expect(strategy.getProviderOptions?.(provider, model, 'high')).toEqual({
      google: {
        thinkingConfig: {
          includeThoughts: true,
        },
      },
    });

    // budget without thoughts -> includeThoughts false, budget kept
    const budgetOnly: GeminiProvider = { name: 'gemini', apiKey: 'test', thinkingBudget: 4096, includeThoughts: false, useSearchGrounding: false };
    expect(strategy.getProviderOptions?.(budgetOnly, model, 'provider-default')).toEqual({
      google: {
        thinkingConfig: {
          includeThoughts: false,
          thinkingBudget: 4096,
        },
      },
    });
  });

  it('maps vertex-ai thinking to the vertex metadata key', () => {
    const provider: VertexAiProvider = {
      name: 'vertex-ai',
      project: 'test',
      location: 'test',
      includeThoughts: true,
      thinkingBudget: 1024,
    };
    const strategy = vertexAiProviderStrategy;

    expect(strategy.getProviderOptions?.(provider, model, 'provider-default')).toEqual({
      vertex: {
        thinkingConfig: {
          includeThoughts: true,
          thinkingBudget: 1024,
        },
      },
    });

    expect(strategy.getProviderOptions?.(provider, model, 'high')).toEqual({
      vertex: {
        thinkingConfig: {
          includeThoughts: true,
        },
      },
    });
  });
});
