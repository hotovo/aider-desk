/* eslint-disable @typescript-eslint/no-explicit-any */
import { ContextMemoryMode, SettingsData } from '@common/types';

export const migrateV11ToV12 = (settings: any): SettingsData => {
  const updatedAgentProfiles =
    settings.agentProfiles?.map((profile: any) => ({
      ...profile,
      subagent: {
        ...profile.subagent,
        contextMemory: profile.subagent.hasContextMemory ? ContextMemoryMode.FullContext : ContextMemoryMode.Off,
        hasContextMemory: undefined, // Remove old field
      },
    })) || [];

  return {
    ...settings,
    agentProfiles: updatedAgentProfiles,
  };
};
