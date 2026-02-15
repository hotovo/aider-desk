import { getDefaultProviderParams, LlmProvider, RequestyProvider } from '@aider-desk/common/agent';

import { DisableStreaming } from '../DisableStreaming';

import { RequestyAdvancedSettings } from './RequestyAdvancedSettings';

type Props = {
  provider: LlmProvider;
  overrides: Partial<RequestyProvider>;
  onChange: (overrides: Record<string, unknown>) => void;
};

export const RequestyModelOverrides = ({ provider, overrides, onChange }: Props) => {
  // Convert overrides to RequestyProvider format for AdvancedSettings
  const fullProvider: RequestyProvider = {
    ...getDefaultProviderParams('requesty'),
    ...(provider as RequestyProvider),
    ...overrides,
  };

  // Convert RequestyProvider back to overrides format
  const handleProviderChange = (updatedProvider: RequestyProvider) => {
    const newOverrides = {
      useAutoCache: updatedProvider.useAutoCache,
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
      <RequestyAdvancedSettings provider={fullProvider} onChange={handleProviderChange} />
      <DisableStreaming checked={fullProvider.disableStreaming ?? false} onChange={handleDisableStreamingChange} />
    </div>
  );
};
