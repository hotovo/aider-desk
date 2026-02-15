import { getDefaultProviderParams, LlmProvider, OpenRouterProvider } from '@aider-desk/common/agent';

import { DisableStreaming } from '../DisableStreaming';

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
      <OpenRouterAdvancedSettings provider={fullProvider} onChange={handleProviderChange} />
      <DisableStreaming checked={fullProvider.disableStreaming ?? false} onChange={handleDisableStreamingChange} />
    </div>
  );
};
