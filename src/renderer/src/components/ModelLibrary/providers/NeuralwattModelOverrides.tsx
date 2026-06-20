import { getDefaultProviderParams, LlmProvider, NeuralwattProvider } from '@common/agent';

import { DisableStreaming } from '../DisableStreaming';

import { NeuralwattAdvancedSettings } from './NeuralwattAdvancedSettings';

type Props = {
  provider: LlmProvider;
  overrides: Partial<NeuralwattProvider>;
  onChange: (overrides: Record<string, unknown>) => void;
};

export const NeuralwattModelOverrides = ({ provider, overrides, onChange }: Props) => {
  const fullProvider: NeuralwattProvider = {
    ...getDefaultProviderParams('neuralwatt'),
    ...(provider as NeuralwattProvider),
    ...overrides,
  };

  const handleProviderChange = (updatedProvider: NeuralwattProvider) => {
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
      <NeuralwattAdvancedSettings provider={fullProvider} onChange={handleProviderChange} />
      <DisableStreaming checked={fullProvider.disableStreaming ?? false} onChange={handleDisableStreamingChange} />
    </div>
  );
};
