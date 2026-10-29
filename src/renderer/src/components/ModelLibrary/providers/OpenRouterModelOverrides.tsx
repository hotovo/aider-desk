import { getDefaultProviderParams, LlmProvider, OpenRouterProvider } from '@common/agent';

import { DisableToolCallStreaming } from '../DisableToolCallStreaming';

import { OpenRouterAdvancedSettings } from './OpenRouterAdvancedSettings';

type Props = {
  provider: LlmProvider;
  overrides: Partial<OpenRouterProvider>;
  onChange: (overrides: Record<string, unknown>) => void;
};

export const OpenRouterModelOverrides = ({ provider, overrides, onChange }: Props) => {
  // Convert overrides to OpenRouterProvider format for AdvancedSettings
  const fullProvider: OpenRouterProvider = {
    ...getDefaultProviderParams('openrouter'),
    ...(provider as OpenRouterProvider),
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
      <OpenRouterAdvancedSettings provider={fullProvider} onChange={handleProviderChange} />
      <DisableToolCallStreaming checked={fullProvider.disableToolCallStreaming ?? false} onChange={handleDisableToolCallStreamingChange} />
    </div>
  );
};
