/* eslint-disable @typescript-eslint/no-explicit-any */
import { SettingsData } from '@aider-desk/common/types';

export const migrateSettingsV5toV6 = (settingsV5: any): SettingsData => {
  settingsV5.models.aiderPreferred = settingsV5.models.preferred;
  delete settingsV5.models.preferred;
  settingsV5.models.agentPreferred = [];

  return settingsV5;
};
