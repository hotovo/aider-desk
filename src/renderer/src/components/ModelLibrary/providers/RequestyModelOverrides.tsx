import { getDefaultProviderParams, LlmProvider, RequestyProvider } from '@common/agent';

import { DisableToolCallStreaming } from '../DisableToolCallStreaming';

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
      <RequestyAdvancedSettings provider={fullProvider} onChange={handleProviderChange} />
      <DisableToolCallStreaming checked={fullProvider.disableToolCallStreaming ?? false} onChange={handleDisableToolCallStreamingChange} />
    </div>
  );
};
