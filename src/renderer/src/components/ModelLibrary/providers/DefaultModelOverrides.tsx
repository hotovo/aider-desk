import { getDefaultProviderParams, LlmProvider } from '@common/agent';

import { DisableToolCallStreaming } from '../DisableToolCallStreaming';

type Props = {
  provider: LlmProvider;
  overrides: Record<string, unknown>;
  onChange: (overrides: Record<string, unknown>) => void;
};

export const DefaultModelOverrides = ({ provider, overrides, onChange }: Props) => {
  const fullProvider = {
    ...getDefaultProviderParams(provider.name),
    ...provider,
    ...overrides,
  } as LlmProvider;

  const handleDisableToolCallStreamingChange = (disableToolCallStreaming: boolean) => {
    onChange({
      ...overrides,
      disableToolCallStreaming,
    });
  };

  return (
    <div className="space-y-4">
      <DisableToolCallStreaming checked={fullProvider.disableToolCallStreaming ?? false} onChange={handleDisableToolCallStreamingChange} />
    </div>
  );
};
