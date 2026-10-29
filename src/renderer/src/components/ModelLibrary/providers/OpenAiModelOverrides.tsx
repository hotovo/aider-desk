import { getDefaultProviderParams, LlmProvider, OpenAiProvider } from '@common/agent';

import { DisableToolCallStreaming } from '../DisableToolCallStreaming';

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
      store: updatedProvider.store,
      disableToolCallStreaming: updatedProvider.disableToolCallStreaming,
    };

    // Remove undefined values
    const cleanedOverrides = Object.fromEntries(Object.entries(newOverrides).filter(([, value]) => value !== undefined));

    onChange(cleanedOverrides);
  };

  const handleDisableToolCallStreamingChange = (disableToolCallStreaming: boolean) => {
    const updatedProvider = { ...fullProvider, disableToolCallStreaming };
    handleProviderChange(updatedProvider);
  };

  return (
    <div className="space-y-4">
      <OpenAiAdvancedSettings provider={fullProvider} onChange={handleProviderChange} />
      <DisableToolCallStreaming checked={fullProvider.disableToolCallStreaming ?? false} onChange={handleDisableToolCallStreamingChange} />
    </div>
  );
};
