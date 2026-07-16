import { getDefaultProviderParams, LlmProvider } from '@common/agent';

import { DisableStreaming } from '../DisableStreaming';
import { DisableToolCallStreaming } from '../DisableToolCallStreaming';

type Props = {
  provider: LlmProvider;
  overrides: Record<string, unknown>;
  onChange: (overrides: Record<string, unknown>) => void;
};

export const OpenCodeModelOverrides = ({ provider, overrides, onChange }: Props) => {
  const fullProvider = {
    ...getDefaultProviderParams('opencode'),
    ...provider,
    ...overrides,
  } as LlmProvider;

  const handleDisableStreamingChange = (disableStreaming: boolean) => {
    onChange({
      ...overrides,
      disableStreaming,
    });
  };

  const handleDisableToolCallStreamingChange = (disableToolCallStreaming: boolean) => {
    onChange({
      ...overrides,
      disableToolCallStreaming,
    });
  };

  return (
    <div className="space-y-4">
      <DisableStreaming checked={fullProvider.disableStreaming ?? false} onChange={handleDisableStreamingChange} />
      <DisableToolCallStreaming checked={fullProvider.disableToolCallStreaming ?? false} onChange={handleDisableToolCallStreamingChange} />
    </div>
  );
};
