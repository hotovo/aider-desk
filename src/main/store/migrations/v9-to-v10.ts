import { SettingsData } from '@common/types';
import { isOpenRouterProvider } from '@common/agent';

export const migrateV9ToV10 = (settings: SettingsData): SettingsData => {
  const updatedLlmProviders = { ...settings.llmProviders };

  if (updatedLlmProviders.openrouter && isOpenRouterProvider(updatedLlmProviders.openrouter)) {
    updatedLlmProviders.openrouter = {
      ...updatedLlmProviders.openrouter,
      requireParameters: updatedLlmProviders.openrouter.requireParameters ?? true,
    };
  }

  return {
    ...settings,
    llmProviders: updatedLlmProviders,
  };
};
