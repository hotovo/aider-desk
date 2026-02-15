/* eslint-disable @typescript-eslint/no-explicit-any */
import { SettingsData } from '@aider-desk/common/types';
import { DEFAULT_AGENT_PROFILE } from '@aider-desk/common/agent';

export const migrateSettingsV15toV16 = (settings: any): SettingsData => {
  // Ensure toolSettings from DEFAULT_AGENT_PROFILE are included in existing agent profiles
  const agentProfiles =
    settings.agentProfiles?.map((profile: any) => ({
      ...profile,
      toolSettings: {
        ...DEFAULT_AGENT_PROFILE.toolSettings,
        ...profile.toolSettings,
      },
    })) || [];

  return {
    ...settings,
    agentProfiles,
  };
};
