import { getDefaultProviderParams, LlmProvider, NeuralwattProvider } from '@common/agent';

import { DisableToolCallStreaming } from '../DisableToolCallStreaming';

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
      <NeuralwattAdvancedSettings provider={fullProvider} onChange={handleProviderChange} />
      <DisableToolCallStreaming checked={fullProvider.disableToolCallStreaming ?? false} onChange={handleDisableToolCallStreamingChange} />
    </div>
  );
};
