import { AgentProfile, SettingsData, ToolApprovalState } from '@common/types';

export const migrateV6ToV7 = (settings: SettingsData): SettingsData => {
  const updatedAgentProfiles: AgentProfile[] = settings.agentProfiles.map((profile) => {
    const newToolApprovals: Record<string, ToolApprovalState> = { ...profile.toolApprovals };

    // Update AIDER_TOOL_ADD_CONTEXT_FILE to AIDER_TOOL_ADD_CONTEXT_FILES
    if (newToolApprovals['aider---add_context_file'] !== undefined) {
      newToolApprovals['aider---add_context_files'] = newToolApprovals['aider---add_context_file'];
      delete newToolApprovals['aider---add_context_file'];
    }

    // Update AIDER_TOOL_DROP_CONTEXT_FILE to AIDER_TOOL_DROP_CONTEXT_FILES
    if (newToolApprovals['aider---drop_context_file'] !== undefined) {
      newToolApprovals['aider---drop_context_files'] = newToolApprovals['aider---drop_context_file'];
      delete newToolApprovals['aider---drop_context_file'];
    }

    return {
      ...profile,
      toolApprovals: newToolApprovals,
    };
  });

  return {
    ...settings,
    agentProfiles: updatedAgentProfiles,
  };
};
