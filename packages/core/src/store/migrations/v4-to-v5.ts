/* eslint-disable @typescript-eslint/no-explicit-any */
import { SettingsData } from '@aider-desk/common/types';

export const migrateSettingsV4toV5 = (settingsV4: any): SettingsData => {
  const openRouterProvider = settingsV4.llmProviders['openrouter'];
  if (openRouterProvider) {
    openRouterProvider.models = [openRouterProvider.model];
    delete openRouterProvider.model;
  }

  const openAiCompatible = settingsV4.llmProviders['openai-compatible'];
  if (openAiCompatible) {
    openAiCompatible.models = [openAiCompatible.model];
    delete openAiCompatible.model;
  }

  return settingsV4;
};
