import { getDefaultProviderParams, LlmProvider } from '@aider-desk/common/agent';

import { DisableStreaming } from '../DisableStreaming';

type Props = {
  provider: LlmProvider;
  overrides: Record<string, unknown>;
  onChange: (overrides: Record<string, unknown>) => void;
};

export const DefaultModelOverrides = ({ provider, overrides, onChange }: Props) => {
  // Convert overrides to LlmProvider format
  const fullProvider = {
    ...getDefaultProviderParams(provider.name),
    ...provider,
    ...overrides,
  } as LlmProvider;

  // Convert back to overrides format
  const handleDisableStreamingChange = (disableStreaming: boolean) => {
    const newOverrides = {
      disableStreaming,
    };

    // Remove undefined values
    const cleanedOverrides = Object.fromEntries(Object.entries(newOverrides).filter(([_, value]) => value !== undefined));

    onChange(cleanedOverrides);
  };

  return (
    <div className="space-y-4">
      <DisableStreaming checked={fullProvider.disableStreaming ?? false} onChange={handleDisableStreamingChange} />
    </div>
  );
};
