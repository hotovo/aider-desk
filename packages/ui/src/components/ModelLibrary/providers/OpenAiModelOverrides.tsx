import { getDefaultProviderParams, LlmProvider, OpenAiProvider } from '@aider-desk/common/agent';

import { DisableStreaming } from '../DisableStreaming';

import { OpenAiAdvancedSettings } from './OpenAiAdvancedSettings';

type Props = {
  provider: LlmProvider;
  overrides: Partial<OpenAiProvider>;
  onChange: (overrides: Record<string, unknown>) => void;
};

export const OpenAiModelOverrides = ({ provider, overrides, onChange }: Props) => {
  // Convert overrides to OpenAiProvider format for AdvancedSettings
  const fullProvider: OpenAiProvider = {
    ...getDefaultProviderParams('openai'),
    ...(provider as OpenAiProvider),
    ...overrides,
  };

  // Convert OpenAiProvider back to overrides format
  const handleProviderChange = (updatedProvider: OpenAiProvider) => {
    const newOverrides = {
      reasoningEffort: updatedProvider.reasoningEffort,
      useWebSearch: updatedProvider.useWebSearch,
      disableStreaming: updatedProvider.disableStreaming,
    };

    // Remove undefined values
    const cleanedOverrides = Object.fromEntries(Object.entries(newOverrides).filter(([_, value]) => value !== undefined));

    onChange(cleanedOverrides);
  };

  // Handle disable streaming change separately
  const handleDisableStreamingChange = (disableStreaming: boolean) => {
    const updatedProvider = { ...fullProvider, disableStreaming };
    handleProviderChange(updatedProvider);
  };

  return (
    <div className="space-y-4">
      <OpenAiAdvancedSettings provider={fullProvider} onChange={handleProviderChange} />
      <DisableStreaming checked={fullProvider.disableStreaming ?? false} onChange={handleDisableStreamingChange} />
    </div>
  );
};
