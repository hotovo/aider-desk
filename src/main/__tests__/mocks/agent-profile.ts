import { AgentProfile, ContextMemoryMode, InvocationMode, ToolApprovalState } from '@common/types';

/**
 * Creates a minimal mock for AgentProfile
 * Provides only the properties needed for testing
 */
export const createMockAgentProfile = (overrides: Partial<AgentProfile> = {}): AgentProfile => {
  const defaultMock: AgentProfile = {
    id: 'test-profile',
    projectDir: undefined,
    name: 'Test Profile',
    provider: 'test-provider',
    model: 'test-model',
    useAiderTools: true,
    usePowerTools: true,
    useTodoTools: true,
    useSubagents: true,
    useMemoryTools: true,
    useSkillsTools: true,
    toolApprovals: {} as Record<string, ToolApprovalState>,
    subagent: {
      enabled: false,
      contextMemory: ContextMemoryMode.LastMessage,
      systemPrompt: '',
      invocationMode: InvocationMode.Automatic,
      color: 'blue',
      description: '',
      includeRules: false,
    },
    isSubagent: false,
  } as AgentProfile;

  return { ...defaultMock, ...overrides };
};
