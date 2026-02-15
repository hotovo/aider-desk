/* eslint-disable @typescript-eslint/no-explicit-any */
import { SettingsData } from '@aider-desk/common/types';

export const migrateSettingsV14toV15 = (settings: any): SettingsData => {
  // Combine aiderPreferred and agentPreferred into preferredModels
  // Add aiderPreferred first, then agentPreferred, removing duplicates
  const aiderPreferred = settings.models?.aiderPreferred || [];
  const agentPreferred = settings.models?.agentPreferred || [];

  const preferredModels = [...new Set([...aiderPreferred, ...agentPreferred])].filter((model) => model && model.split('/').length > 1);

  return {
    ...settings,
    preferredModels,
    // Remove the old models structure
    models: undefined,
  };
};
