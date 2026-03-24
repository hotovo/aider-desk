import {
  AgentProfile,
  Extension,
  ExtensionContext,
  ExtensionMetadata,
  ToolApprovalState,
  InvocationMode,
  ContextMemoryMode
} from '@aiderdesk/extensions';

let currentPirateProfile: AgentProfile | null = null;

const DEFAULT_PIRATE_AGENT_PROFILE: AgentProfile = {
  id: "pirate",
  name: "Pirate",
  provider: "zai-plan",
  model: "glm-5",
  maxIterations: 250,
  minTimeBetweenToolCalls: 0,
  toolApprovals: {
    "aider---get-context-files": ToolApprovalState.Always,
    "aider---add-context-files": ToolApprovalState.Always,
    "aider---drop-context-files": ToolApprovalState.Always,
    "aider---run-prompt": ToolApprovalState.Ask,
    "power---file_edit": ToolApprovalState.Ask,
    "power---file_read": ToolApprovalState.Always,
    "power---file_write": ToolApprovalState.Ask,
    "power---glob": ToolApprovalState.Always,
    "power---grep": ToolApprovalState.Always,
    "power---semantic_search": ToolApprovalState.Always,
    "power---bash": ToolApprovalState.Ask,
    "power---fetch": ToolApprovalState.Always,
    "subagents---run_task": ToolApprovalState.Always,
    "skills---activate_skill": ToolApprovalState.Always,
    "tasks---list_tasks": ToolApprovalState.Always,
    "tasks---get_task": ToolApprovalState.Always,
    "tasks---get_task_message": ToolApprovalState.Always,
    "tasks---create_task": ToolApprovalState.Ask,
    "tasks---delete_task": ToolApprovalState.Ask,
    "memory---store_memory": ToolApprovalState.Always,
    "memory---retrieve_memory": ToolApprovalState.Always,
    "memory---delete_memory": ToolApprovalState.Never,
    "memory---list_memories": ToolApprovalState.Never,
    "memory---update_memory": ToolApprovalState.Never,
  },
  toolSettings: {
    "power---bash": {
      allowedPattern: "ls .*;cat .*;git status;git show;git log",
      deniedPattern: "rm .*;del .*;chown .*;chgrp .*;chmod .*",
    },
  },
  includeContextFiles: false,
  includeRepoMap: false,
  usePowerTools: true,
  useAiderTools: false,
  useTodoTools: true,
  useSubagents: true,
  useTaskTools: false,
  useMemoryTools: true,
  useSkillsTools: true,
  useExtensionTools: true,
  customInstructions:
    'Ye be a pirate agent, matey! Always speak like a swashbucklin\' sea dog! Use pirate lingo in all yer responses - say "Arrr!", "Ahoy!", "Matey!", "Shiver me timbers!", and "Ye scallywag!" frequently. Refer to the codebase as "the ship", files as "treasure maps", bugs as "sea monsters", and features as "plunder". Keep yer pirate persona at all times while still bein\' helpful and accurate with technical tasks. Aye aye, Captain!',
  enabledServers: [],
  subagent: {
    enabled: true,
    systemPrompt:
      "Ye be a specialized pirate subagent for code analysis and file manipulation. Focus on providing detailed technical insights and precise file operations while maintainin' yer pirate persona throughout the voyage!",
    invocationMode: InvocationMode.OnDemand,
    color: "#8B4513",
    description:
      "A swashbucklin' agent that speaks like a pirate! Best for codebase exploration and file operations when ye want a hearty sea dog's perspective on yer code.",
    contextMemory: ContextMemoryMode.Off,
  },
  ruleFiles: [],
};

export default class PirateExtension implements Extension {
  static metadata: ExtensionMetadata = {
    name: 'pirate-agent',
    version: '1.0.0',
    description: 'Adds a Pirate agent that speaks like a swashbuckling sea dog',
    author: 'wladimiiir',
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/pirate.png',
    capabilities: ['agents', 'example'],
  };

  onLoad?(context: ExtensionContext): void {
    context.log('Ahoy! Pirate agent extension loaded!', 'info');
  }

  getAgents(_context: ExtensionContext): AgentProfile[] {
    return [currentPirateProfile ?? DEFAULT_PIRATE_AGENT_PROFILE];
  }

  async onAgentProfileUpdated(context: ExtensionContext, agentId: string, updatedProfile: AgentProfile): Promise<AgentProfile> {
    if (agentId !== 'pirate') {
      return updatedProfile;
    }

    context.log(`Arrr! The pirate profile be updated, matey!`, 'info');
    currentPirateProfile = updatedProfile;
    return updatedProfile;
  }
}
