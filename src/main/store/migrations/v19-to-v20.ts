/* eslint-disable @typescript-eslint/no-explicit-any */
import { SettingsData } from '@common/types';

export const migrateSettingsV19toV20 = (settings: any): SettingsData => {
  const oldThreshold = settings.taskSettings?.contextCompactingThreshold;

  return {
    ...settings,
    taskSettings: {
      ...settings.taskSettings,
      contextCompactingThreshold:
        typeof oldThreshold === 'number' ? { percentage: oldThreshold, tokens: 100000 } : oldThreshold || { percentage: 90, tokens: 100000 },
    },
  };
};
