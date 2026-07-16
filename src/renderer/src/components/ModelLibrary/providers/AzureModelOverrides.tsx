import { getDefaultProviderParams, AzureProvider, LlmProvider } from '@common/agent';

import { DisableStreaming } from '../DisableStreaming';
import { DisableToolCallStreaming } from '../DisableToolCallStreaming';

import { AzureAdvancedSettings } from './AzureAdvancedSettings';

type Props = {
  provider: LlmProvider;
  overrides: Partial<AzureProvider>;
  onChange: (overrides: Record<string, unknown>) => void;
};

export const AzureModelOverrides = ({ provider, overrides, onChange }: Props) => {
  const fullProvider: AzureProvider = {
    ...getDefaultProviderParams('azure'),
    ...(provider as AzureProvider),
    ...overrides,
  };

  const handleProviderChange = (updatedProvider: AzureProvider) => {
    const newOverrides = {
      reasoningEffort: updatedProvider.reasoningEffort,
      disableStreaming: updatedProvider.disableStreaming,
      disableToolCallStreaming: updatedProvider.disableToolCallStreaming,
    };

    const cleanedOverrides = Object.fromEntries(Object.entries(newOverrides).filter(([_, value]) => value !== undefined));

    onChange(cleanedOverrides);
  };

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
      <AzureAdvancedSettings provider={fullProvider} onChange={handleProviderChange} />
      <DisableStreaming checked={fullProvider.disableStreaming ?? false} onChange={handleDisableStreamingChange} />
      <DisableToolCallStreaming checked={fullProvider.disableToolCallStreaming ?? false} onChange={handleDisableToolCallStreamingChange} />
    </div>
  );
};
