import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProviderProfile } from '@common/types';
import { LlmProvider } from '@common/agent';

import { ProviderProfileForm } from '../ProviderProfileForm';

import { render } from '@/__tests__/render';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { provider?: string }) => options?.provider || key,
  }),
}));

// Mock useApi
vi.mock('@/contexts/ApiContext', () => ({
  useApi: () => ({
    getEffectiveEnvironmentVariable: vi.fn(),
  }),
}));

// Mock useEffectiveEnvironmentVariable
vi.mock('@/hooks/useEffectiveEnvironmentVariable', () => ({
  useEffectiveEnvironmentVariable: () => ({
    value: '',
    isLoading: false,
  }),
}));

// Mock providers as they might have many dependencies
vi.mock('@/components/ModelLibrary/providers', () => ({
  OpenAiParameters: () => <div data-testid="openai-params">OpenAI Parameters</div>,
  AlibabaPlanParameters: () => <div>Alibaba Plan Parameters</div>,
  AnthropicParameters: () => <div>Anthropic Parameters</div>,
  AnthropicCompatibleParameters: () => <div>Anthropic Compatible Parameters</div>,
  AzureParameters: () => <div>Azure Parameters</div>,
  BedrockParameters: () => <div>Bedrock Parameters</div>,
  ClaudeAgentSdkParameters: () => <div>Claude Agent SDK Parameters</div>,
  DeepseekParameters: () => <div>Deepseek Parameters</div>,
  GeminiParameters: () => <div>Gemini Parameters</div>,
  GeminiCliParameters: () => <div>Gemini CLI Parameters</div>,
  GpustackParameters: () => <div>Gpustack Parameters</div>,
  GroqParameters: () => <div>Groq Parameters</div>,
  KimiPlanParameters: () => <div>KimiPlan Parameters</div>,
  LitellmParameters: () => <div>Litellm Parameters</div>,
  LmStudioParameters: () => <div>LmStudio Parameters</div>,
  MinimaxParameters: () => <div>Minimax Parameters</div>,
  OllamaParameters: () => <div>Ollama Parameters</div>,
  OpenAiCompatibleParameters: () => <div>OpenAI Compatible Parameters</div>,
  OpenRouterParameters: () => <div>OpenRouter Parameters</div>,
  RequestyParameters: () => <div>Requesty Parameters</div>,
  VertexAIParameters: () => <div>VertexAI Parameters</div>,
  ZaiPlanParameters: () => <div>ZaiPlan Parameters</div>,
  SyntheticParameters: () => <div>Synthetic Parameters</div>,
  OpenCodeParameters: () => <div>OpenCode Parameters</div>,
}));

describe('ProviderProfileForm', () => {
  it('renders with provider name', () => {
    render(<ProviderProfileForm provider="openai" providers={[]} onSave={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText('providers.openai')).toBeInTheDocument();
    expect(screen.getByTestId('openai-params')).toBeInTheDocument();
  });

  it('calls onSave when save button is clicked', () => {
    const onSave = vi.fn();
    render(<ProviderProfileForm provider="openai" providers={[]} onSave={onSave} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('providers.openai'), {
      target: { value: 'My OpenAI' },
    });

    fireEvent.click(screen.getByText('common.save'));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'My OpenAI',
        provider: expect.objectContaining({ name: 'openai' }),
      }),
    );
  });

  it('calls onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(<ProviderProfileForm provider="openai" providers={[]} onSave={vi.fn()} onCancel={onCancel} />);

    fireEvent.click(screen.getByText('common.cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows error when duplicate ID is entered', () => {
    const existingProviders: ProviderProfile[] = [{ id: 'existing-id', name: 'Existing', provider: { name: 'openai' } as unknown as LlmProvider }];
    render(<ProviderProfileForm provider="openai" providers={existingProviders} onSave={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByDisplayValue('openai'), {
      target: { value: 'existing-id' },
    });

    fireEvent.click(screen.getByText('common.save'));

    expect(screen.getByText('modelLibrary.errors.duplicateId')).toBeInTheDocument();
  });
});
