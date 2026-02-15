import { SettingsData } from '@aider-desk/common/types';
import { isOpenRouterProvider } from '@aider-desk/common/agent';

export const migrateV8ToV9 = (settings: SettingsData): SettingsData => {
  const updatedLlmProviders = { ...settings.llmProviders };

  if (updatedLlmProviders.openrouter && isOpenRouterProvider(updatedLlmProviders.openrouter)) {
    updatedLlmProviders.openrouter = {
      ...updatedLlmProviders.openrouter,
      order: updatedLlmProviders.openrouter.order ?? [],
      allowFallbacks: updatedLlmProviders.openrouter.allowFallbacks ?? true,
      dataCollection: updatedLlmProviders.openrouter.dataCollection ?? 'allow',
      only: updatedLlmProviders.openrouter.only ?? [],
      ignore: updatedLlmProviders.openrouter.ignore ?? [],
      quantizations: updatedLlmProviders.openrouter.quantizations ?? [],
      sort: updatedLlmProviders.openrouter.sort ?? null,
    };
  }

  return {
    ...settings,
    llmProviders: updatedLlmProviders,
  };
};
