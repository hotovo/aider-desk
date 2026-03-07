import { AgentProfile, ContextMemoryMode, InvocationMode, Model, ReasoningEffort, ToolApprovalState } from '@common/types';
import {
  AIDER_TOOL_ADD_CONTEXT_FILES,
  AIDER_TOOL_DROP_CONTEXT_FILES,
  AIDER_TOOL_GET_CONTEXT_FILES,
  AIDER_TOOL_GROUP_NAME,
  AIDER_TOOL_RUN_PROMPT,
  POWER_TOOL_BASH,
  POWER_TOOL_FETCH,
  POWER_TOOL_FILE_EDIT,
  POWER_TOOL_FILE_READ,
  POWER_TOOL_FILE_WRITE,
  POWER_TOOL_GLOB,
  POWER_TOOL_GREP,
  POWER_TOOL_GROUP_NAME,
  POWER_TOOL_SEMANTIC_SEARCH,
  SUBAGENTS_TOOL_GROUP_NAME,
  SUBAGENTS_TOOL_RUN_TASK,
  SKILLS_TOOL_ACTIVATE_SKILL,
  SKILLS_TOOL_GROUP_NAME,
  TASKS_TOOL_CREATE_TASK,
  TASKS_TOOL_DELETE_TASK,
  TASKS_TOOL_GET_TASK,
  TASKS_TOOL_GET_TASK_MESSAGE,
  TASKS_TOOL_GROUP_NAME,
  TASKS_TOOL_LIST_TASKS,
  TOOL_GROUP_NAME_SEPARATOR,
  MEMORY_TOOL_DELETE,
  MEMORY_TOOL_GROUP_NAME,
  MEMORY_TOOL_LIST,
  MEMORY_TOOL_RETRIEVE,
  MEMORY_TOOL_STORE,
  MEMORY_TOOL_UPDATE,
} from '@common/tools';

export type LlmProviderName =
  | 'anthropic'
  | 'anthropic-compatible'
  | 'azure'
  | 'bedrock'
  | 'cerebras'
  | 'claude-agent-sdk'
  | 'deepseek'
  | 'gemini'
  | 'gemini-cli'
  | 'gpustack'
  | 'groq'
  | 'alibaba-plan'
  | 'kimi-plan'
  | 'litellm'
  | 'lmstudio'
  | 'minimax'
  | 'ollama'
  | 'openai'
  | 'openai-compatible'
  | 'opencode'
  | 'openrouter'
  | 'requesty'
  | 'synthetic'
  | 'vertex-ai'
  | 'zai-plan';

export interface LlmProviderBase {
  name: LlmProviderName;
  disableStreaming?: boolean;
  voiceEnabled?: boolean;
}

export const DEFAULT_VOICE_SYSTEM_INSTRUCTIONS = 'Expect words related to programming, development, and technology.';

export interface VoiceControlSettings {
  idleTimeoutMs: number;
  systemInstructions: string;
}

export interface OllamaProvider extends LlmProviderBase {
  name: 'ollama';
  baseUrl: string;
}

export const AVAILABLE_PROVIDERS: LlmProviderName[] = [
  'alibaba-plan',
  'anthropic',
  'anthropic-compatible',
  'azure',
  'bedrock',
  'cerebras',
  'claude-agent-sdk',
  'deepseek',
  'gemini',
  'gemini-cli',
  'gpustack',
  'groq',
  'kimi-plan',
  'litellm',
  'lmstudio',
  'minimax',
  'ollama',
  'openai',
  'openai-compatible',
  'opencode',
  'openrouter',
  'requesty',
  'synthetic',
  'vertex-ai',
  'zai-plan',
];

export enum OpenAiVoiceModel {
  Gpt4oMiniTranscribe = 'gpt-4o-mini-transcribe',
  Gpt4oTranscribe = 'gpt-4o-transcribe',
}

export interface OpenAiVoiceControlSettings extends VoiceControlSettings {
  model: OpenAiVoiceModel;
  language: string;
}

export interface OpenAiProvider extends LlmProviderBase {
  name: 'openai';
  apiKey: string;
  reasoningEffort?: ReasoningEffort;
  useWebSearch: boolean;
  voice?: Partial<OpenAiVoiceControlSettings>;
}
export const isOpenAiProvider = (provider: LlmProviderBase): provider is OpenAiProvider => provider.name === 'openai';

export interface AzureProvider extends LlmProviderBase {
  name: 'azure';
  apiKey: string;
  resourceName: string;
  apiVersion?: string;
  reasoningEffort?: ReasoningEffort;
}
export const isAzureProvider = (provider: LlmProviderBase): provider is AzureProvider => provider.name === 'azure';

export interface AnthropicProvider extends LlmProviderBase {
  name: 'anthropic';
  apiKey: string;
}
export const isAnthropicProvider = (provider: LlmProviderBase): provider is AnthropicProvider => provider.name === 'anthropic';

export interface AnthropicCompatibleProvider extends LlmProviderBase {
  name: 'anthropic-compatible';
  apiKey: string;
  baseUrl?: string;
}
export const isAnthropicCompatibleProvider = (provider: LlmProviderBase): provider is AnthropicCompatibleProvider => provider.name === 'anthropic-compatible';

export interface KimiPlanProvider extends LlmProviderBase {
  name: 'kimi-plan';
  apiKey: string;
}
export const isKimiPlanProvider = (provider: LlmProviderBase): provider is KimiPlanProvider => provider.name === 'kimi-plan';

export interface AlibabaPlanProvider extends LlmProviderBase {
  name: 'alibaba-plan';
  apiKey: string;
}
export const isAlibabaPlanProvider = (provider: LlmProviderBase): provider is AlibabaPlanProvider => provider.name === 'alibaba-plan';

export enum GeminiVoiceModel {
  GeminiLive25FlashNativeAudio = 'gemini-2.5-flash-native-audio-preview-12-2025',
}

export interface GeminiVoiceControlSettings extends VoiceControlSettings {
  model: GeminiVoiceModel;
  temperature: number;
}

export interface GeminiProvider extends LlmProviderBase {
  name: 'gemini';
  apiKey: string;
  customBaseUrl?: string;
  includeThoughts: boolean;
  thinkingBudget: number;
  useSearchGrounding: boolean;
  voice?: Partial<GeminiVoiceControlSettings>;
}

export const isGeminiProvider = (provider: LlmProviderBase): provider is GeminiProvider => provider.name === 'gemini';

export interface VertexAiProvider extends LlmProviderBase {
  name: 'vertex-ai';
  project: string;
  location: string;
  googleCloudCredentialsJson?: string;
  includeThoughts: boolean;
  thinkingBudget: number;
}

export const isVertexAiProvider = (provider: LlmProviderBase): provider is VertexAiProvider => provider.name === 'vertex-ai';

export interface LmStudioProvider extends LlmProviderBase {
  name: 'lmstudio';
  baseUrl: string;
}
export const isLmStudioProvider = (provider: LlmProviderBase): provider is LmStudioProvider => provider.name === 'lmstudio';

export interface DeepseekProvider extends LlmProviderBase {
  name: 'deepseek';
  apiKey: string;
}
export const isDeepseekProvider = (provider: LlmProviderBase): provider is DeepseekProvider => provider.name === 'deepseek';

export interface GroqProvider extends LlmProviderBase {
  name: 'groq';
  apiKey: string;
}
export const isGroqProvider = (provider: LlmProviderBase): provider is GroqProvider => provider.name === 'groq';

export interface CerebrasProvider extends LlmProviderBase {
  name: 'cerebras';
  apiKey: string;
}
export const isCerebrasProvider = (provider: LlmProviderBase): provider is CerebrasProvider => provider.name === 'cerebras';

export interface ClaudeAgentSdkProvider extends LlmProviderBase {
  name: 'claude-agent-sdk';
  systemPrompt?: string;
  mcpServers?: Record<string, unknown>;
}
export const isClaudeAgentSdkProvider = (provider: LlmProviderBase): provider is ClaudeAgentSdkProvider => provider.name === 'claude-agent-sdk';

export interface GeminiCliProvider extends LlmProviderBase {
  name: 'gemini-cli';
  projectId?: string;
}
export const isGeminiCliProvider = (provider: LlmProviderBase): provider is GeminiCliProvider => provider.name === 'gemini-cli';

export interface BedrockProvider extends LlmProviderBase {
  name: 'bedrock';
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  sessionToken?: string;
}
export const isBedrockProvider = (provider: LlmProviderBase): provider is BedrockProvider => provider.name === 'bedrock';

export interface OpenAiCompatibleProvider extends LlmProviderBase {
  name: 'openai-compatible';
  apiKey: string;
  baseUrl?: string;
  reasoningEffort?: ReasoningEffort;
}
export const isOpenAiCompatibleProvider = (provider: LlmProviderBase): provider is OpenAiCompatibleProvider => provider.name === 'openai-compatible';

export interface LitellmProvider extends LlmProviderBase {
  name: 'litellm';
  apiKey: string;
  baseUrl: string;
}
export const isLitellmProvider = (provider: LlmProviderBase): provider is LitellmProvider => provider.name === 'litellm';

export const isOllamaProvider = (provider: LlmProviderBase): provider is OllamaProvider => provider.name === 'ollama';

export interface GpustackProvider extends LlmProviderBase {
  name: 'gpustack';
  apiKey?: string;
  baseUrl?: string;
}
export const isGpustackProvider = (provider: LlmProviderBase): provider is GpustackProvider => provider.name === 'gpustack';

export interface OpenRouterProvider extends LlmProviderBase {
  name: 'openrouter';
  apiKey: string;
  // Advanced routing options
  requireParameters: boolean;
  order: string[];
  only: string[];
  ignore: string[];
  allowFallbacks: boolean;
  dataCollection: 'allow' | 'deny';
  quantizations: string[];
  sort: 'price' | 'throughput' | null;
}
export const isOpenRouterProvider = (provider: LlmProviderBase): provider is OpenRouterProvider => provider.name === 'openrouter';

export interface RequestyProvider extends LlmProviderBase {
  name: 'requesty';
  apiKey: string;
  useAutoCache: boolean;
  reasoningEffort: ReasoningEffort;
}
export const isRequestyProvider = (provider: LlmProviderBase): provider is RequestyProvider => provider.name === 'requesty';

export interface OpenCodeProvider extends LlmProviderBase {
  name: 'opencode';
  apiKey: string;
}
export const isOpenCodeProvider = (provider: LlmProviderBase): provider is OpenCodeProvider => provider.name === 'opencode';

export interface ZaiPlanProvider extends LlmProviderBase {
  name: 'zai-plan';
  apiKey: string;
  thinkingEnabled?: boolean;
}
export const isZaiPlanProvider = (provider: LlmProviderBase): provider is ZaiPlanProvider => provider.name === 'zai-plan';

export interface MinimaxProvider extends LlmProviderBase {
  name: 'minimax';
  apiKey: string;
}
export const isMinimaxProvider = (provider: LlmProviderBase): provider is MinimaxProvider => provider.name === 'minimax';

export interface SyntheticProvider extends LlmProviderBase {
  name: 'synthetic';
  apiKey: string;
}
export const isSyntheticProvider = (provider: LlmProviderBase): provider is SyntheticProvider => provider.name === 'synthetic';

export type LlmProvider =
  | OpenAiProvider
  | AnthropicProvider
  | AnthropicCompatibleProvider
  | AzureProvider
  | GeminiProvider
  | GeminiCliProvider
  | VertexAiProvider
  | LmStudioProvider
  | BedrockProvider
  | ClaudeAgentSdkProvider
  | DeepseekProvider
  | GroqProvider
  | GpustackProvider
  | CerebrasProvider
  | AlibabaPlanProvider
  | KimiPlanProvider
  | OpenAiCompatibleProvider
  | LitellmProvider
  | OllamaProvider
  | OpenCodeProvider
  | OpenRouterProvider
  | RequestyProvider
  | SyntheticProvider
  | ZaiPlanProvider
  | MinimaxProvider;

export const DEFAULT_MODEL_TEMPERATURE = 0.0;

export const DEFAULT_PROVIDER_MODELS: Partial<Record<LlmProviderName, string>> = {
  'alibaba-plan': 'qwen3-coder-plus',
  anthropic: 'claude-sonnet-4-5-20250929',
  cerebras: 'qwen-3-235b-a22b-instruct-2507',
  'claude-agent-sdk': 'sonnet',
  deepseek: 'deepseek-chat',
  gemini: 'gemini-3-pro',
  'gemini-cli': 'gemini-2.5-flash',
  groq: 'moonshotai/kimi-k2-instruct-0905',
  openai: 'gpt-5.2',
  openrouter: 'anthropic/claude-sonnet-4.5',
  opencode: 'claude-sonnet-4-5',
  requesty: 'anthropic/claude-sonnet-4-5',
  synthetic: 'anthropic/claude-sonnet-4.5',
  'zai-plan': 'glm-4.7',
  minimax: 'MiniMax-M2',
};

export const DEFAULT_AIDER_MAIN_MODEL = `anthropic/${DEFAULT_PROVIDER_MODELS.anthropic}`;

const DEFAULT_AGENT_PROFILE_ID = 'default';

export const DEFAULT_AGENT_PROFILE: AgentProfile = {
  id: DEFAULT_AGENT_PROFILE_ID,
  name: 'Default Agent',
  provider: 'anthropic',
  model: DEFAULT_PROVIDER_MODELS.anthropic!,
  maxIterations: 250,
  minTimeBetweenToolCalls: 0,
  toolApprovals: {
    // aider tools
    [`${AIDER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${AIDER_TOOL_GET_CONTEXT_FILES}`]: ToolApprovalState.Always,
    [`${AIDER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${AIDER_TOOL_ADD_CONTEXT_FILES}`]: ToolApprovalState.Always,
    [`${AIDER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${AIDER_TOOL_DROP_CONTEXT_FILES}`]: ToolApprovalState.Always,
    [`${AIDER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${AIDER_TOOL_RUN_PROMPT}`]: ToolApprovalState.Ask,
    // power tools
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_EDIT}`]: ToolApprovalState.Ask,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_READ}`]: ToolApprovalState.Always,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_WRITE}`]: ToolApprovalState.Ask,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_GLOB}`]: ToolApprovalState.Always,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_GREP}`]: ToolApprovalState.Always,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_SEMANTIC_SEARCH}`]: ToolApprovalState.Always,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_BASH}`]: ToolApprovalState.Ask,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FETCH}`]: ToolApprovalState.Always,
    // subagent tools
    [`${SUBAGENTS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${SUBAGENTS_TOOL_RUN_TASK}`]: ToolApprovalState.Always,
    // skills tools
    [`${SKILLS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${SKILLS_TOOL_ACTIVATE_SKILL}`]: ToolApprovalState.Always,
    // task tools
    [`${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_LIST_TASKS}`]: ToolApprovalState.Always,
    [`${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_GET_TASK}`]: ToolApprovalState.Always,
    [`${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_GET_TASK_MESSAGE}`]: ToolApprovalState.Always,
    [`${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_CREATE_TASK}`]: ToolApprovalState.Ask,
    [`${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_DELETE_TASK}`]: ToolApprovalState.Ask,
    // memory tools
    [`${MEMORY_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${MEMORY_TOOL_STORE}`]: ToolApprovalState.Always,
    [`${MEMORY_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${MEMORY_TOOL_RETRIEVE}`]: ToolApprovalState.Always,
    [`${MEMORY_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${MEMORY_TOOL_DELETE}`]: ToolApprovalState.Never,
    [`${MEMORY_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${MEMORY_TOOL_LIST}`]: ToolApprovalState.Never,
    [`${MEMORY_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${MEMORY_TOOL_UPDATE}`]: ToolApprovalState.Never,
  },
  toolSettings: {
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_BASH}`]: {
      allowedPattern: 'ls .*;cat .*;git status;git show;git log',
      deniedPattern: 'rm .*;del .*;chown .*;chgrp .*;chmod .*',
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
  customInstructions: '',
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

export const DEFAULT_AGENT_PROFILES: AgentProfile[] = [
  // Power tools
  {
    ...DEFAULT_AGENT_PROFILE,
    name: 'Power Tools',
    subagent: {
      ...DEFAULT_AGENT_PROFILE.subagent,
      description:
        'Direct file manipulation and system operations. Best for codebase analysis, file management, advanced search, data analysis, and tasks requiring precise control over individual files. This agent should be used as the main agent for analysis and coding tasks.',
      systemPrompt:
        'You are a specialized subagent for code analysis and file manipulation. Focus on providing detailed technical insights and precise file operations.',
    },
  },
  // Aider
  {
    ...DEFAULT_AGENT_PROFILE,
    id: 'aider',
    name: 'Aider',
    usePowerTools: false,
    useAiderTools: true,
    includeRepoMap: true,
    subagent: {
      ...DEFAULT_AGENT_PROFILE.subagent,
      description:
        "AI-powered code generation and refactoring. Best for implementing features, fixing bugs, and structured development workflows using Aider's intelligent code understanding and modification capabilities.",
      systemPrompt:
        'You are a specialized subagent for AI-powered code generation and refactoring. Focus on providing high-quality code modifications based on the given requirements.',
    },
    toolApprovals: {
      ...DEFAULT_AGENT_PROFILE.toolApprovals,
      [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_EDIT}`]: ToolApprovalState.Never,
      [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_WRITE}`]: ToolApprovalState.Never,
    },
  },
  // Aider with Power Search
  {
    ...DEFAULT_AGENT_PROFILE,
    id: 'aider-power-tools',
    name: 'Aider with Power Search',
    usePowerTools: true,
    useAiderTools: true,
    includeRepoMap: true,
    subagent: {
      ...DEFAULT_AGENT_PROFILE.subagent,
      description:
        "Hybrid approach combining Aider's code generation with advanced search capabilities. Best for complex development tasks requiring both intelligent code modification and comprehensive codebase exploration.",
      systemPrompt:
        'You are a specialized subagent for AI-powered code generation and advanced search. Focus on providing high-quality code modifications based on the given requirements and comprehensive codebase exploration.',
    },
    toolApprovals: {
      ...DEFAULT_AGENT_PROFILE.toolApprovals,
      [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_READ}`]: ToolApprovalState.Never,
      [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_EDIT}`]: ToolApprovalState.Never,
      [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_WRITE}`]: ToolApprovalState.Never,
      [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_BASH}`]: ToolApprovalState.Never,
    },
  },
];

export const INIT_PROJECT_AGENTS_PROFILE: AgentProfile = {
  ...DEFAULT_AGENT_PROFILE,
  id: 'init',
  maxIterations: 50,
  includeRepoMap: true,
  includeContextFiles: false,
  usePowerTools: true,
  useAiderTools: false,
  useTodoTools: false,
  useSubagents: false,
  useTaskTools: false,
  useMemoryTools: false,
  useSkillsTools: false,
  toolApprovals: {
    ...DEFAULT_AGENT_PROFILE.toolApprovals,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_EDIT}`]: ToolApprovalState.Never,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_WRITE}`]: ToolApprovalState.Always,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_BASH}`]: ToolApprovalState.Never,
    [`${SUBAGENTS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${SUBAGENTS_TOOL_RUN_TASK}`]: ToolApprovalState.Never,
  },
};

export const CONFLICT_RESOLUTION_PROFILE: AgentProfile = {
  ...DEFAULT_AGENT_PROFILE,
  id: 'conflict-resolution',
  maxIterations: 20,
  includeRepoMap: false,
  includeContextFiles: false,
  usePowerTools: true,
  useAiderTools: false,
  useTodoTools: false,
  useSubagents: false,
  useTaskTools: false,
  useMemoryTools: false,
  useSkillsTools: false,
  isSubagent: true,
  toolApprovals: {
    ...DEFAULT_AGENT_PROFILE.toolApprovals,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_EDIT}`]: ToolApprovalState.Always,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_READ}`]: ToolApprovalState.Always,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_WRITE}`]: ToolApprovalState.Never,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_GLOB}`]: ToolApprovalState.Never,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_GREP}`]: ToolApprovalState.Always,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_SEMANTIC_SEARCH}`]: ToolApprovalState.Never,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_BASH}`]: ToolApprovalState.Never,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FETCH}`]: ToolApprovalState.Never,
    [`${SUBAGENTS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${SUBAGENTS_TOOL_RUN_TASK}`]: ToolApprovalState.Never,
  },
};

export const COMPACT_CONVERSATION_AGENT_PROFILE: AgentProfile = {
  ...DEFAULT_AGENT_PROFILE,
  id: 'compact',
  maxIterations: 5,
  includeRepoMap: false,
  includeContextFiles: false,
  usePowerTools: false,
  useAiderTools: false,
  useTodoTools: false,
  useSubagents: false,
  useTaskTools: false,
  useMemoryTools: false,
  useSkillsTools: false,
  isSubagent: true,
  toolApprovals: {
    ...DEFAULT_AGENT_PROFILE.toolApprovals,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_EDIT}`]: ToolApprovalState.Never,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_WRITE}`]: ToolApprovalState.Never,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_BASH}`]: ToolApprovalState.Never,
    [`${SUBAGENTS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${SUBAGENTS_TOOL_RUN_TASK}`]: ToolApprovalState.Never,
  },
};

export const HANDOFF_AGENT_PROFILE: AgentProfile = {
  ...DEFAULT_AGENT_PROFILE,
  id: 'handoff',
  maxIterations: 5,
  includeRepoMap: false,
  includeContextFiles: false,
  usePowerTools: false,
  useAiderTools: false,
  useTodoTools: false,
  useSubagents: false,
  useTaskTools: false,
  useMemoryTools: false,
  useSkillsTools: false,
  isSubagent: true,
  toolApprovals: {
    ...DEFAULT_AGENT_PROFILE.toolApprovals,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_EDIT}`]: ToolApprovalState.Never,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_WRITE}`]: ToolApprovalState.Never,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_BASH}`]: ToolApprovalState.Never,
    [`${SUBAGENTS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${SUBAGENTS_TOOL_RUN_TASK}`]: ToolApprovalState.Never,
  },
};

export const getDefaultProviderParams = <T extends LlmProvider>(providerName: LlmProviderName): T => {
  let provider: LlmProvider;

  const baseConfig: LlmProviderBase = {
    name: providerName,
    disableStreaming: false,
  };

  switch (providerName) {
    case 'openai':
      provider = {
        name: 'openai',
        apiKey: '',
        useWebSearch: false,
        voice: {
          idleTimeoutMs: 5000,
          systemInstructions: DEFAULT_VOICE_SYSTEM_INSTRUCTIONS,
          model: OpenAiVoiceModel.Gpt4oTranscribe,
          language: 'en',
        },
      } satisfies OpenAiProvider;
      break;
    case 'azure':
      provider = {
        name: 'azure',
        apiKey: '',
        resourceName: '',
        apiVersion: '',
      } satisfies AzureProvider;
      break;
    case 'anthropic':
      provider = {
        name: 'anthropic',
        apiKey: '',
      } satisfies AnthropicProvider;
      break;
    case 'anthropic-compatible':
      provider = {
        name: 'anthropic-compatible',
        apiKey: '',
        baseUrl: '',
      } satisfies AnthropicCompatibleProvider;
      break;
    case 'gemini':
      provider = {
        name: 'gemini',
        apiKey: '',
        useSearchGrounding: false,
        includeThoughts: false,
        thinkingBudget: 0,
        customBaseUrl: '',
        voice: {
          idleTimeoutMs: 5000,
          systemInstructions: DEFAULT_VOICE_SYSTEM_INSTRUCTIONS,
          model: GeminiVoiceModel.GeminiLive25FlashNativeAudio,
          temperature: 0.7,
        },
      } satisfies GeminiProvider;
      break;
    case 'vertex-ai':
      provider = {
        name: 'vertex-ai',
        project: '',
        location: '',
        googleCloudCredentialsJson: '',
        includeThoughts: false,
        thinkingBudget: 0,
      } satisfies VertexAiProvider;
      break;
    case 'groq':
      provider = {
        name: 'groq',
        apiKey: '',
      } satisfies GroqProvider;
      break;
    case 'kimi-plan':
      provider = {
        name: 'kimi-plan',
        apiKey: '',
      } satisfies KimiPlanProvider;
      break;
    case 'alibaba-plan':
      provider = {
        name: 'alibaba-plan',
        apiKey: '',
      } satisfies AlibabaPlanProvider;
      break;
    case 'gpustack':
      provider = {
        name: 'gpustack',
        apiKey: '',
        baseUrl: 'http://localhost',
      } satisfies GpustackProvider;
      break;
    case 'cerebras':
      provider = {
        name: 'cerebras',
        apiKey: '',
      } satisfies CerebrasProvider;
      break;
    case 'deepseek':
      provider = {
        name: 'deepseek',
        apiKey: '',
      } satisfies DeepseekProvider;
      break;
    case 'bedrock':
      provider = {
        name: 'bedrock',
        accessKeyId: '',
        secretAccessKey: '',
        region: 'us-east-1', // Default region
      } satisfies BedrockProvider;
      break;
    case 'openai-compatible':
      provider = {
        name: 'openai-compatible',
        apiKey: '',
        baseUrl: '',
        reasoningEffort: ReasoningEffort.None,
      } satisfies OpenAiCompatibleProvider;
      break;
    case 'litellm':
      provider = {
        name: 'litellm',
        apiKey: '',
        baseUrl: 'http://localhost:4000',
      } satisfies LitellmProvider;
      break;
    case 'ollama':
      provider = {
        name: 'ollama',
        baseUrl: 'http://localhost:11434/api',
      } satisfies OllamaProvider;
      break;
    case 'openrouter':
      provider = {
        name: 'openrouter',
        apiKey: '',
        order: [],
        allowFallbacks: true,
        dataCollection: 'allow',
        only: [],
        ignore: [],
        quantizations: [],
        sort: null,
        requireParameters: false,
      } satisfies OpenRouterProvider;
      break;
    case 'opencode':
      provider = {
        name: 'opencode',
        apiKey: '',
      } satisfies OpenCodeProvider;
      break;
    case 'lmstudio':
      provider = {
        name: 'lmstudio',
        baseUrl: 'http://localhost:1234/v1',
      } satisfies LmStudioProvider;
      break;
    case 'requesty':
      provider = {
        name: 'requesty',
        apiKey: '',
        useAutoCache: true,
        reasoningEffort: ReasoningEffort.None,
      } satisfies RequestyProvider;
      break;
    case 'synthetic':
      provider = {
        name: 'synthetic',
        apiKey: '',
      } satisfies SyntheticProvider;
      break;
    case 'zai-plan':
      provider = {
        name: 'zai-plan',
        apiKey: '',
      } satisfies ZaiPlanProvider;
      break;
    case 'minimax':
      provider = {
        name: 'minimax',
        apiKey: '',
      } satisfies MinimaxProvider;
      break;
    case 'gemini-cli':
      provider = {
        name: 'gemini-cli',
        projectId: '',
      } satisfies GeminiCliProvider;
      break;
    default:
      // For any other provider, create a base structure. This might need more specific handling if new providers are added.
      provider = {
        ...baseConfig,
      } as LlmProvider;
  }

  return provider as T;
};

export const isSubagentEnabled = (agentProfile: AgentProfile, currentProfileId?: string): boolean => {
  return Boolean(agentProfile.subagent.systemPrompt && agentProfile.subagent.enabled && (!currentProfileId || agentProfile.id !== currentProfileId));
};

export const getProviderModelId = (model: Model): string => {
  return `${model.providerId}/${model.id}`;
};
