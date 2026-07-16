import { getDefaultProviderParams, GeminiProvider, LlmProvider } from '@common/agent';

import { DisableStreaming } from '../DisableStreaming';
import { DisableToolCallStreaming } from '../DisableToolCallStreaming';

import { GeminiAdvancedSettings } from './GeminiAdvancedSettings';

type Props = {
  provider: LlmProvider;
  overrides: Partial<GeminiProvider>;
  onChange: (overrides: Record<string, unknown>) => void;
};

export const GeminiModelOverrides = ({ provider, overrides, onChange }: Props) => {
  // Convert overrides to GeminiProvider format for AdvancedSettings
  const fullProvider: GeminiProvider = {
    ...getDefaultProviderParams('gemini'),
    ...(provider as GeminiProvider),
    ...overrides,
  };

  // Convert GeminiProvider back to overrides format
  const handleProviderChange = (updatedProvider: GeminiProvider) => {
    const newOverrides = {
      thinkingBudget: updatedProvider.thinkingBudget,
      includeThoughts: updatedProvider.includeThoughts,
      useSearchGrounding: updatedProvider.useSearchGrounding,
      disableStreaming: updatedProvider.disableStreaming,
      disableToolCallStreaming: updatedProvider.disableToolCallStreaming,
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

  const handleDisableToolCallStreamingChange = (disableToolCallStreaming: boolean) => {
    const updatedProvider = { ...fullProvider, disableToolCallStreaming };
    handleProviderChange(updatedProvider);
  };

  return (
    <div className="space-y-4">
      <GeminiAdvancedSettings provider={fullProvider} onChange={handleProviderChange} />
      <DisableStreaming checked={fullProvider.disableStreaming ?? false} onChange={handleDisableStreamingChange} />
      <DisableToolCallStreaming checked={fullProvider.disableToolCallStreaming ?? false} onChange={handleDisableToolCallStreamingChange} />
    </div>
  );
};
