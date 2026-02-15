/* eslint-disable @typescript-eslint/no-explicit-any */
import { AgentProfile, SettingsData } from '@aider-desk/common/types';

export const migrateV7ToV8 = (settings: SettingsData): SettingsData => {
  const agentProfiles = (settings as any).agentProfiles as AgentProfile[] | undefined;
  if (!agentProfiles) {
    return settings;
  }

  const updatedAgentProfiles: AgentProfile[] = agentProfiles.map((profile) => {
    // Add temperature field with default value of 0.7 if it doesn't exist
    return {
      ...profile,
      temperature: profile.temperature ?? 0.1,
    };
  });

  return {
    ...settings,
    agentProfiles: updatedAgentProfiles,
  } as any;
};
