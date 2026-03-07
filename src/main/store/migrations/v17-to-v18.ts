/* eslint-disable @typescript-eslint/no-explicit-any */
import { SettingsData } from '@common/types';

export const migrateSettingsV17toV18 = (settings: any): SettingsData => {
  const currentModel = settings.memory?.model;

  if (currentModel === 'BAAI/bge-large-en-v1.5') {
    return {
      ...settings,
      memory: {
        ...settings.memory,
        model: 'BAAI/bge-base-en-v1.5',
      },
    };
  }

  return settings;
};
