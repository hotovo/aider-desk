import { SettingsData } from '@common/types';

export const migrateSettingsV17toV18 = async (settings: SettingsData): Promise<SettingsData> => {
  if (!settings.terminal) {
    settings.terminal = {
      shell: '',
    };
  }
  return settings;
};
