/* eslint-disable @typescript-eslint/no-explicit-any */
import { SettingsData } from '@aider-desk/common/types';
import { DEFAULT_AGENT_PROFILE, LlmProvider, LlmProviderName } from '@aider-desk/common/agent';

export const migrateSettingsV3toV4 = (settingsV3: any): SettingsData => {
  const { agentConfig, ...restOfSettings } = settingsV3;

  // Ensure agentConfig and its properties exist, providing defaults if necessary
  const currentAgentConfig = agentConfig || {
    providers: [],
    maxIterations: 10,
    maxTokens: 1000,
    minTimeBetweenToolCalls: 0,
    mcpServers: {},
    disabledServers: [],
    toolApprovals: {},
    includeContextFiles: false,
    includeRepoMap: false,
    usePowerTools: false,
    useAiderTools: true,
    customInstructions: '',
  };

  const mcpServers = currentAgentConfig.mcpServers || {};
  const activeProvider = currentAgentConfig.providers.find((provider) => provider.active);
  return {
    ...restOfSettings,
    agentProfiles: [
      {
        ...DEFAULT_AGENT_PROFILE,
        ...(activeProvider && {
          provider: activeProvider.name,
          model: activeProvider.model,
        }),
        enabledServers: Object.keys(mcpServers).filter((serverName) => !currentAgentConfig.disabledServers?.includes(serverName)),
        toolApprovals: {
          ...DEFAULT_AGENT_PROFILE.toolApprovals,
          ...currentAgentConfig.toolApprovals,
        },
        maxIterations: currentAgentConfig.maxIterations,
        maxTokens: currentAgentConfig.maxTokens,
        minTimeBetweenToolCalls: currentAgentConfig.minTimeBetweenToolCalls,
        includeContextFiles: currentAgentConfig.includeContextFiles,
        includeRepoMap: currentAgentConfig.includeRepoMap,
        usePowerTools: currentAgentConfig.usePowerTools,
        useAiderTools: currentAgentConfig.useAiderTools,
        customInstructions: currentAgentConfig.customInstructions,
      },
    ],
    mcpServers,
    llmProviders: currentAgentConfig.providers.reduce((acc: Record<LlmProviderName, LlmProvider>, provider: LlmProvider) => {
      acc[provider.name] = provider;
      return acc;
    }, {}),
  };
};

export const migrateOpenProjectsV3toV4 = (openProjectsV3: any): string[] => {
  return (
    openProjectsV3?.map((project: any) => ({
      ...project,
      settings: {
        ...project.settings,
        agentProfileId: DEFAULT_AGENT_PROFILE.id,
      },
    })) || []
  );
};
