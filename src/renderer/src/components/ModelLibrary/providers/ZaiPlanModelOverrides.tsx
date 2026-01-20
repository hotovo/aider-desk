import { getDefaultProviderParams, LlmProvider, ZaiPlanProvider } from '@common/agent';

import { DisableStreaming } from '../DisableStreaming';

import { ZaiPlanAdvancedSettings } from './ZaiPlanAdvancedSettings';

type Props = {
  provider: LlmProvider;
  overrides: Partial<ZaiPlanProvider>;
  onChange: (overrides: Record<string, unknown>) => void;
};

export const ZaiPlanModelOverrides = ({ provider, overrides, onChange }: Props) => {
  const fullProvider: ZaiPlanProvider = {
    ...getDefaultProviderParams('zai-plan'),
    ...(provider as ZaiPlanProvider),
    ...overrides,
  };

  const handleProviderChange = (updatedProvider: ZaiPlanProvider) => {
    const newOverrides = {
      includeThoughts: updatedProvider.includeThoughts,
      disableStreaming: updatedProvider.disableStreaming,
    };

    const cleanedOverrides = Object.fromEntries(Object.entries(newOverrides).filter(([_, value]) => value !== undefined));

    onChange(cleanedOverrides);
  };

  const handleDisableStreamingChange = (disableStreaming: boolean) => {
    const updatedProvider = { ...fullProvider, disableStreaming };
    handleProviderChange(updatedProvider);
  };

  return (
    <div className="space-y-4">
      <ZaiPlanAdvancedSettings provider={fullProvider} onChange={handleProviderChange} />
      <DisableStreaming checked={fullProvider.disableStreaming ?? false} onChange={handleDisableStreamingChange} />
    </div>
  );
};
