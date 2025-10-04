import { getDefaultProviderParams, RequestyProvider } from '@common/agent';

import { RequestyAdvancedSettings } from './RequestyAdvancedSettings';

type Props = {
  overrides: Partial<RequestyProvider>;
  onChange: (overrides: Record<string, unknown>) => void;
};

export const RequestyModelOverrides = ({ overrides, onChange }: Props) => {
  // Convert overrides to RequestyProvider format for AdvancedSettings
  const provider: RequestyProvider = {
    ...getDefaultProviderParams('requesty'),
    ...overrides,
  };

  // Convert RequestyProvider back to overrides format
  const handleProviderChange = (updatedProvider: RequestyProvider) => {
    const newOverrides = {
      useAutoCache: updatedProvider.useAutoCache,
      reasoningEffort: updatedProvider.reasoningEffort,
    };

    // Remove undefined values
    const cleanedOverrides = Object.fromEntries(Object.entries(newOverrides).filter(([_, value]) => value !== undefined));

    onChange(cleanedOverrides);
  };

  return (
    <div className="space-y-4">
      <RequestyAdvancedSettings provider={provider} onChange={handleProviderChange} />
    </div>
  );
};
