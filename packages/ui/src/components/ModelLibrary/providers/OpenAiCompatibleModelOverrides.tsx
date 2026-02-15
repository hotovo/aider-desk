import { getDefaultProviderParams, LlmProvider, OpenAiCompatibleProvider } from '@aider-desk/common/agent';

import { DisableStreaming } from '../DisableStreaming';

import { OpenAiCompatibleAdvancedSettings } from './OpenAiCompatibleAdvancedSettings';

type Props = {
  provider: LlmProvider;
  overrides: Partial<OpenAiCompatibleProvider>;
  onChange: (overrides: Record<string, unknown>) => void;
};

export const OpenAiCompatibleModelOverrides = ({ provider, overrides, onChange }: Props) => {
  // Convert overrides to OpenAiCompatibleProvider format for AdvancedSettings
  const fullProvider: OpenAiCompatibleProvider = {
    ...getDefaultProviderParams('openai-compatible'),
    ...(provider as OpenAiCompatibleProvider),
    ...overrides,
  };

  // Convert OpenAiCompatibleProvider back to overrides format
  const handleProviderChange = (updatedProvider: OpenAiCompatibleProvider) => {
    const newOverrides = {
      reasoningEffort: updatedProvider.reasoningEffort,
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
      <OpenAiCompatibleAdvancedSettings provider={fullProvider} onChange={handleProviderChange} />
      <DisableStreaming checked={fullProvider.disableStreaming ?? false} onChange={handleDisableStreamingChange} />
    </div>
  );
};
