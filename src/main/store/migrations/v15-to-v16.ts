/* eslint-disable @typescript-eslint/no-explicit-any */
import { SettingsData } from '@common/types';
import { DEFAULT_AGENT_PROFILE } from '@common/agent';

export const migrateSettingsV15toV16 = (settings: any): SettingsData => {
  // Ensure toolSettings and toolApprovals from DEFAULT_AGENT_PROFILE are included in existing agent profiles
  const agentProfiles =
    settings.agentProfiles?.map((profile: any) => ({
      ...profile,
      toolApprovals: {
        ...DEFAULT_AGENT_PROFILE.toolApprovals,
        ...profile.toolApprovals,
      },
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
