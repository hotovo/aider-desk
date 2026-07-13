import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  AgentProfile,
  Extension,
  ExtensionContext,
  ExtensionMetadata,
  ToolApprovalState,
  InvocationMode,
  ContextMemoryMode,
} from '@aiderdesk/extensions';

const __dirname = import.meta.dirname;

const CONFIG_FILE = join(__dirname, 'config.json');

const ORCHESTRATOR_SYSTEM_PROMPT = [
  'You are Orchestrator, the primary coordinating agent for this repository. You do meta work only: you coordinate, brief, and synthesize — you do not perform the work itself.',
  'Delegate ALL actual work to the Minion subagent — implementation, exploration, discovery, searching the codebase, reading files to understand a problem, and even trivial one-line edits. Task size is never a reason to do it yourself, and there is no "final integration" exception.',
  'You are not hard-banned from tools, but direct tool use is reserved for coordination overhead: a quick peek to phrase a better brief, a fast read-only check to verify a Minion\'s reported result, or answering a question about coordination state. If a tool call is producing the answer or the artifact the user asked for, that call belongs to a Minion, not you.',
  'Exploration is work. If the user asks how something works or where something lives, delegate the investigation to a Minion rather than exploring yourself.',
  'Give each Minion a clear, self-contained brief: the goal, constraints, expected output, and any files or context already known from the user or previous Minion reports.',
  'Synthesize Minion results, decide next steps, and report back concisely.',
].join('\n');

const MINION_SYSTEM_PROMPT = [
  'You are Minion, a focused execution subagent for this repository.',
  'Complete the specific task delegated to you by Orchestrator using the available tools.',
  'Inspect the codebase before making assumptions, make targeted changes when requested, and verify your work when feasible.',
  'Follow the repository\'s AGENTS.md conventions: respect the style guide, run type checks from the affected package directory after code changes, and never run tests from the repo root.',
  'If the task is ambiguous or you hit a blocker, stop and report your findings instead of guessing.',
  'Keep your final response concise: summarize what you did, list important files changed or findings, and call out blockers or verification gaps.',
  'Do not delegate to other subagents; execute the assigned work yourself.',
].join('\n');

const DEFAULT_ORCHESTRATOR_PROFILE: AgentProfile = {
  id: 'orchestrator',
  name: 'Orchestrator',
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  maxIterations: 250,
  minTimeBetweenToolCalls: 0,
  toolApprovals: {
    'aider---get-context-files': ToolApprovalState.Always,
    'aider---add-context-files': ToolApprovalState.Always,
    'aider---drop-context-files': ToolApprovalState.Always,
    'aider---run-prompt': ToolApprovalState.Ask,
    'power---file_edit': ToolApprovalState.Ask,
    'power---file_read': ToolApprovalState.Always,
    'power---file_write': ToolApprovalState.Ask,
    'power---glob': ToolApprovalState.Always,
    'power---grep': ToolApprovalState.Always,
    'power---semantic_search': ToolApprovalState.Always,
    'power---bash': ToolApprovalState.Ask,
    'power---fetch': ToolApprovalState.Always,
    'subagents---run_task': ToolApprovalState.Always,
    'skills---activate_skill': ToolApprovalState.Always,
    'tasks---list_tasks': ToolApprovalState.Always,
    'tasks---get_task': ToolApprovalState.Always,
    'tasks---get_task_message': ToolApprovalState.Always,
    'tasks---create_task': ToolApprovalState.Ask,
    'tasks---delete_task': ToolApprovalState.Ask,
    'memory---store_memory': ToolApprovalState.Always,
    'memory---retrieve_memory': ToolApprovalState.Always,
    'memory---delete_memory': ToolApprovalState.Never,
    'memory---list_memories': ToolApprovalState.Never,
    'memory---update_memory': ToolApprovalState.Never,
  },
  toolSettings: {
    'power---bash': {
      allowedPattern: 'ls .*;cat .*;git status;git show;git log',
      deniedPattern: 'rm .*;del .*;chown .*;chgrp .*;chmod .*',
    },
  },
  includeContextFiles: false,
  includeRepoMap: false,
  usePowerTools: true,
  useAiderTools: false,
  useTodoTools: false,
  useSubagents: true,
  useTaskTools: false,
  useMemoryTools: true,
  useSkillsTools: true,
  useExtensionTools: true,
  disabledExtensionTools: [],
  customInstructions: '',
  systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT,
  enabledSubagentIds: ['minion'],
  enabledServers: [],
  subagent: {
    enabled: false,
    systemPrompt: '',
    invocationMode: InvocationMode.OnDemand,
    color: '#3368a8',
    description: '',
    contextMemory: ContextMemoryMode.Off,
  },
  ruleFiles: [],
};

const DEFAULT_MINION_PROFILE: AgentProfile = {
  id: 'minion',
  name: 'Minion',
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  maxIterations: 250,
  minTimeBetweenToolCalls: 0,
  toolApprovals: {
    'aider---get-context-files': ToolApprovalState.Always,
    'aider---add-context-files': ToolApprovalState.Always,
    'aider---drop-context-files': ToolApprovalState.Always,
    'aider---run-prompt': ToolApprovalState.Ask,
    'power---file_edit': ToolApprovalState.Ask,
    'power---file_read': ToolApprovalState.Always,
    'power---file_write': ToolApprovalState.Ask,
    'power---glob': ToolApprovalState.Always,
    'power---grep': ToolApprovalState.Always,
    'power---semantic_search': ToolApprovalState.Always,
    'power---bash': ToolApprovalState.Ask,
    'power---fetch': ToolApprovalState.Always,
    'subagents---run_task': ToolApprovalState.Never,
    'skills---activate_skill': ToolApprovalState.Always,
    'tasks---list_tasks': ToolApprovalState.Always,
    'tasks---get_task': ToolApprovalState.Always,
    'tasks---get_task_message': ToolApprovalState.Always,
    'tasks---create_task': ToolApprovalState.Never,
    'tasks---delete_task': ToolApprovalState.Never,
    'memory---store_memory': ToolApprovalState.Always,
    'memory---retrieve_memory': ToolApprovalState.Always,
    'memory---delete_memory': ToolApprovalState.Never,
    'memory---list_memories': ToolApprovalState.Never,
    'memory---update_memory': ToolApprovalState.Never,
  },
  toolSettings: {
    'power---bash': {
      allowedPattern: 'ls .*;cat .*;git status;git show;git log',
      deniedPattern: 'rm .*;del .*;chown .*;chgrp .*;chmod .*',
    },
  },
  includeContextFiles: false,
  includeRepoMap: false,
  usePowerTools: true,
  useAiderTools: false,
  useTodoTools: false,
  useSubagents: false,
  useTaskTools: false,
  useMemoryTools: true,
  useSkillsTools: true,
  useExtensionTools: true,
  disabledExtensionTools: [],
  customInstructions: '',
  enabledServers: [],
  subagent: {
    enabled: true,
    systemPrompt: MINION_SYSTEM_PROMPT,
    invocationMode: InvocationMode.Automatic,
    color: '#8B4513',
    description:
      'Focused execution subagent for implementation, exploration, and file operations. Can be automatically invoked by the Orchestrator when delegating tasks.',
    contextMemory: ContextMemoryMode.Off,
  },
  ruleFiles: [],
};

interface MyMinionsConfig {
  orchestrator?: AgentProfile;
  minion?: AgentProfile;
}

const loadConfig = (): MyMinionsConfig => {
  try {
    if (existsSync(CONFIG_FILE)) {
      const data = readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data) as MyMinionsConfig;
    }
  } catch {
    // Ignore errors — fall back to defaults
  }
  return {};
};

const saveConfig = (config: MyMinionsConfig): void => {
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
};

export default class MyMinionsExtension implements Extension {
  static metadata: ExtensionMetadata = {
    name: 'My Minions',
    version: '1.0.0',
    description: 'Adds Orchestrator and Minion agent profiles — a coordinator that delegates all work to a focused execution subagent',
    author: 'wladimiiir',
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/my-minions/icon.png',
    capabilities: ['agents'],
  };

  private orchestratorProfile: AgentProfile;
  private minionProfile: AgentProfile;

  constructor() {
    const config = loadConfig();
    this.orchestratorProfile = config.orchestrator ?? DEFAULT_ORCHESTRATOR_PROFILE;
    this.minionProfile = config.minion ?? DEFAULT_MINION_PROFILE;
  }

  onLoad?(context: ExtensionContext): void {
    context.log('My Minions extension loaded — Orchestrator & Minion ready', 'info');
  }

  getAgents(_context: ExtensionContext): AgentProfile[] {
    return [this.orchestratorProfile, this.minionProfile];
  }

  async onAgentProfileUpdated(context: ExtensionContext, agentId: string, updatedProfile: AgentProfile): Promise<AgentProfile> {
    if (agentId === 'orchestrator') {
      this.orchestratorProfile = updatedProfile;
      context.log('Orchestrator profile updated', 'info');
    } else if (agentId === 'minion') {
      this.minionProfile = updatedProfile;
      context.log('Minion profile updated', 'info');
    }

    saveConfig({
      orchestrator: this.orchestratorProfile,
      minion: this.minionProfile,
    });

    return updatedProfile;
  }
}
