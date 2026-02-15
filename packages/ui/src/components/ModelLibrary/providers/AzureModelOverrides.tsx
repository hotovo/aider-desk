import { getDefaultProviderParams, AzureProvider, LlmProvider } from '@aider-desk/common/agent';

import { DisableStreaming } from '../DisableStreaming';

import { AzureAdvancedSettings } from './AzureAdvancedSettings';

type Props = {
  provider: LlmProvider;
  overrides: Partial<AzureProvider>;
  onChange: (overrides: Record<string, unknown>) => void;
};

export const AzureModelOverrides = ({ provider, overrides, onChange }: Props) => {
  // Convert overrides to AzureProvider format for AdvancedSettings
  const fullProvider: AzureProvider = {
    ...getDefaultProviderParams('azure'),
    ...(provider as AzureProvider),
    ...overrides,
  };

  // Convert AzureProvider back to overrides format
  const handleProviderChange = (updatedProvider: AzureProvider) => {
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
      <AzureAdvancedSettings provider={fullProvider} onChange={handleProviderChange} />
      <DisableStreaming checked={fullProvider.disableStreaming ?? false} onChange={handleDisableStreamingChange} />
    </div>
  );
};
