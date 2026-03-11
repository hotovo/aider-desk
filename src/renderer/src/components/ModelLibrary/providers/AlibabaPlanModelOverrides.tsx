import { getDefaultProviderParams, AlibabaPlanProvider, LlmProvider } from '@common/agent';

import { AlibabaPlanThinkingSettings } from './AlibabaPlanThinkingSettings';

type Props = {
  provider: LlmProvider;
  overrides: Partial<AlibabaPlanProvider>;
  onChange: (overrides: Record<string, unknown>) => void;
};

export const AlibabaPlanModelOverrides = ({ provider, overrides, onChange }: Props) => {
  const fullProvider: AlibabaPlanProvider = {
    ...getDefaultProviderParams('alibaba-plan'),
    ...(provider as AlibabaPlanProvider),
    ...overrides,
  };

  const handleProviderChange = (updatedProvider: AlibabaPlanProvider) => {
    const newOverrides = {
      thinkingEnabled: updatedProvider.thinkingEnabled,
      thinkingBudget: updatedProvider.thinkingBudget,
    };

    const cleanedOverrides = Object.fromEntries(Object.entries(newOverrides).filter(([_, value]) => value !== undefined));

    onChange(cleanedOverrides);
  };

  return (
    <div className="space-y-4">
      <AlibabaPlanThinkingSettings provider={fullProvider} onChange={handleProviderChange} />
    </div>
  );
};
