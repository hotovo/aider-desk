import { getDefaultProviderParams, OpenRouterProvider } from '@common/agent';

import { OpenRouterAdvancedSettings } from './OpenRouterAdvancedSettings';

type Props = {
  overrides: Partial<OpenRouterProvider>;
  onChange: (overrides: Record<string, unknown>) => void;
};

export const OpenRouterModelOverrides = ({ overrides, onChange }: Props) => {
  // Convert overrides to OpenRouterProvider format for AdvancedSettings
  const provider: OpenRouterProvider = {
    ...getDefaultProviderParams('openrouter'),
    ...overrides,
  };

  // Convert OpenRouterProvider back to overrides format
  const handleProviderChange = (updatedProvider: OpenRouterProvider) => {
    const newOverrides = {
      order: updatedProvider.order.length > 0 ? updatedProvider.order : undefined,
      only: updatedProvider.only.length > 0 ? updatedProvider.only : undefined,
      ignore: updatedProvider.ignore.length > 0 ? updatedProvider.ignore : undefined,
      quantizations: updatedProvider.quantizations.length > 0 ? updatedProvider.quantizations : undefined,
      allowFallbacks: updatedProvider.allowFallbacks,
      dataCollection: updatedProvider.dataCollection,
      sort: updatedProvider.sort,
      requireParameters: updatedProvider.requireParameters,
    };

    // Remove undefined values
    const cleanedOverrides = Object.fromEntries(Object.entries(newOverrides).filter(([_, value]) => value !== undefined));

    onChange(cleanedOverrides);
  };

  return (
    <div className="space-y-4">
      <OpenRouterAdvancedSettings provider={provider} onChange={handleProviderChange} />
    </div>
  );
};
