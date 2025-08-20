/* eslint-disable @typescript-eslint/no-explicit-any */
import { SettingsData } from '@common/types';

export const migrateV10ToV11 = (settings: any): SettingsData => {
  const updatedAgentProfiles =
    settings.agentProfiles?.map((profile) => {
      // If the profile has a description, move it to the subagent
      if (profile.description) {
        return {
          ...profile,
          // Remove description from the main profile
          description: undefined,
          // Move description to subagent
          subagent: {
            ...profile.subagent,
            description: profile.description,
          },
        };
      }
      return profile;
    }) || [];

  return {
    ...settings,
    agentProfiles: updatedAgentProfiles,
  };
};
