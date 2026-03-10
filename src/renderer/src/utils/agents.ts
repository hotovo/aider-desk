import { AgentProfile, TaskData } from '@common/types';
import { useMemo } from 'react';

import { useAgents } from '@/contexts/AgentsContext';
import { useProjectSettings } from '@/contexts/ProjectSettingsContext';

/**
 * Resolves the active agent profile for a task following the correct hierarchy:
 * 1. Task-level agent profile ID
 * 2. Project-level agent profile ID (fallback)
 * 3. Creates temporary profile if task has provider/model
 */
export const resolveAgentProfile = (task: TaskData | undefined, projectAgentProfileId: string | undefined, profiles: AgentProfile[]): AgentProfile | null => {
  // Check task-level agent profile first
  let agentProfileId = task?.agentProfileId;

  // If no task-level profile, fall back to project-level
  if (!agentProfileId) {
    agentProfileId = projectAgentProfileId;
  }

  if (!agentProfileId) {
    return null;
  }

  let profile = profiles.find((profile) => profile.id === agentProfileId);
  if (!profile) {
    return null;
  }

  if (task?.provider && task?.model) {
    // Create a profile with task-level overrides
    profile = {
      ...profile,
      provider: task.provider,
      model: task.model,
    };
  }

  return profile;
};

/**
 * Hook to resolve the active agent profile for a task.
 * Uses useProjectSettings and useAgents internally to get the necessary data.
 */
export const useActiveAgentProfile = (task: TaskData | undefined, projectDir: string): AgentProfile | null => {
  const { projectSettings } = useProjectSettings();
  const { getProfiles } = useAgents();

  return useMemo(() => {
    return resolveAgentProfile(task, projectSettings?.agentProfileId, getProfiles(projectDir));
  }, [task, projectSettings?.agentProfileId, getProfiles, projectDir]);
};
