/* eslint-disable @typescript-eslint/no-explicit-any */
import { SettingsData } from '@common/types';

export const migrateV12ToV13 = (settings: any): SettingsData => {
  return {
    ...settings,
    server: settings.server || {
      enabled: false,
      basicAuth: {
        enabled: false,
        username: '',
        password: '',
      },
    },
  };
};
