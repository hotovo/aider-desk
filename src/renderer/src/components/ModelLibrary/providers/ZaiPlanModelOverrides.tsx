import { getDefaultProviderParams, LlmProvider, ZaiPlanProvider } from '@common/agent';

import { ZaiPlanThinkingSetting } from './ZaiPlanThinkingSetting';

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
      thinkingEnabled: updatedProvider.thinkingEnabled,
    };

    const cleanedOverrides = Object.fromEntries(Object.entries(newOverrides).filter(([_, value]) => value !== undefined));

    onChange(cleanedOverrides);
  };

  return (
    <div className="space-y-4">
      <ZaiPlanThinkingSetting provider={fullProvider} onChange={handleProviderChange} />
    </div>
  );
};
