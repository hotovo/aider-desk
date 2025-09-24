import { AgentProfile, ContextMemoryMode, InvocationMode, ReasoningEffort, SettingsData, ToolApprovalState } from '@common/types';
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
  TOOL_GROUP_NAME_SEPARATOR,
} from '@common/tools';

export type LlmProviderName =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'vertex-ai'
  | 'lmstudio'
  | 'bedrock'
  | 'deepseek'
  | 'openai-compatible'
  | 'ollama'
  | 'openrouter'
  | 'requesty'
  | 'groq'
  | 'cerebras';

export interface LlmProviderBase {
  name: LlmProviderName;
}

export interface OllamaProvider extends LlmProviderBase {
  name: 'ollama';
  baseUrl: string;
}

export const AVAILABLE_PROVIDERS: LlmProviderName[] = [
  'anthropic',
  'bedrock',
  'cerebras',
  'deepseek',
  'gemini',
  'groq',
  'lmstudio',
  'ollama',
  'openai',
  'openai-compatible',
  'openrouter',
  'requesty',
  'vertex-ai',
];

export interface OpenAiProvider extends LlmProviderBase {
  name: 'openai';
  apiKey: string;
  reasoningEffort?: ReasoningEffort;
}
export const isOpenAiProvider = (provider: LlmProviderBase): provider is OpenAiProvider => provider.name === 'openai';

export interface AnthropicProvider extends LlmProviderBase {
  name: 'anthropic';
  apiKey: string;
}
export const isAnthropicProvider = (provider: LlmProviderBase): provider is AnthropicProvider => provider.name === 'anthropic';

export interface GeminiProvider extends LlmProviderBase {
  name: 'gemini';
  apiKey: string;
  customBaseUrl?: string;
  includeThoughts: boolean;
  thinkingBudget: number;
  useSearchGrounding: boolean;
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
}
export const isOpenAiCompatibleProvider = (provider: LlmProviderBase): provider is OpenAiCompatibleProvider => provider.name === 'openai-compatible';

export const isOllamaProvider = (provider: LlmProviderBase): provider is OllamaProvider => provider.name === 'ollama';

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

export type LlmProvider =
  | OpenAiProvider
  | AnthropicProvider
  | GeminiProvider
  | VertexAiProvider
  | LmStudioProvider
  | BedrockProvider
  | DeepseekProvider
  | GroqProvider
  | CerebrasProvider
  | OpenAiCompatibleProvider
  | OllamaProvider
  | OpenRouterProvider
  | RequestyProvider;

export const DEFAULT_PROVIDER_MODEL: Partial<Record<LlmProviderName, string>> = {
  anthropic: 'claude-sonnet-4-20250514',
  cerebras: 'llama3.1-8b',
  deepseek: 'deepseek-chat',
  gemini: 'gemini-2.5-pro',
  openai: 'gpt-5',
  openrouter: 'anthropic/claude-sonnet-4',
  requesty: 'anthropic/claude-sonnet-4-20250514',
};

const DEFAULT_AGENT_PROFILE_ID = 'default';

export const DEFAULT_AGENT_PROFILE: AgentProfile = {
  id: DEFAULT_AGENT_PROFILE_ID,
  name: 'Default Agent',
  provider: 'anthropic',
  model: DEFAULT_PROVIDER_MODEL.anthropic!,
  maxIterations: 100,
  maxTokens: 8192,
  minTimeBetweenToolCalls: 0,
  temperature: 0.1,
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
  },
  includeContextFiles: true,
  includeRepoMap: false,
  usePowerTools: true,
  useAiderTools: false,
  useTodoTools: true,
  useSubagents: true,
  customInstructions: '',
  enabledServers: [],
  autoApprove: false,
  subagent: {
    enabled: false,
    systemPrompt: '',
    invocationMode: InvocationMode.OnDemand,
    color: '#3368a8',
    description: '',
    contextMemory: ContextMemoryMode.Off,
  },
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
  maxTokens: 5000,
  includeRepoMap: true,
  includeContextFiles: false,
  usePowerTools: true,
  useAiderTools: false,
  useTodoTools: false,
  useSubagents: false,
  autoApprove: true,
  toolApprovals: {
    ...DEFAULT_AGENT_PROFILE.toolApprovals,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_EDIT}`]: ToolApprovalState.Never,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_WRITE}`]: ToolApprovalState.Always,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_BASH}`]: ToolApprovalState.Never,
    [`${SUBAGENTS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${SUBAGENTS_TOOL_RUN_TASK}`]: ToolApprovalState.Never,
  },
};

export const COMPACT_CONVERSATION_AGENT_PROFILE: AgentProfile = {
  ...DEFAULT_AGENT_PROFILE,
  id: 'compact',
  maxIterations: 5,
  maxTokens: 8192,
  includeRepoMap: false,
  includeContextFiles: false,
  usePowerTools: false,
  useAiderTools: false,
  useTodoTools: false,
  useSubagents: false,
  autoApprove: true,
  toolApprovals: {
    ...DEFAULT_AGENT_PROFILE.toolApprovals,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_EDIT}`]: ToolApprovalState.Never,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_WRITE}`]: ToolApprovalState.Never,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_BASH}`]: ToolApprovalState.Never,
    [`${SUBAGENTS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${SUBAGENTS_TOOL_RUN_TASK}`]: ToolApprovalState.Never,
  },
};

export const getLlmProviderConfig = (providerName: LlmProviderName, settings?: SettingsData | null): LlmProvider => {
  let provider = settings?.llmProviders[providerName] || null;

  if (!provider) {
    const baseConfig: LlmProviderBase = {
      name: providerName,
    };

    switch (providerName) {
      case 'openai':
        provider = {
          name: 'openai',
          apiKey: '',
        } satisfies OpenAiProvider;
        break;
      case 'anthropic':
        provider = {
          name: 'anthropic',
          apiKey: '',
        } satisfies AnthropicProvider;
        break;
      case 'gemini':
        provider = {
          name: 'gemini',
          apiKey: '',
          useSearchGrounding: false,
          includeThoughts: false,
          thinkingBudget: 0,
          customBaseUrl: '',
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
        } satisfies OpenAiCompatibleProvider;
        break;
      case 'ollama':
        provider = {
          name: 'ollama',
          baseUrl: '',
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
          sort: 'price',
          requireParameters: true,
        } satisfies OpenRouterProvider;
        break;
      case 'lmstudio':
        provider = {
          name: 'lmstudio',
          baseUrl: '',
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
      default:
        // For any other provider, create a base structure. This might need more specific handling if new providers are added.
        provider = {
          ...baseConfig,
        } as LlmProvider;
    }

    return provider;
  } else {
    return {
      ...provider,
    };
  }
};

export const isSubagentEnabled = (agentProfile: AgentProfile, currentProfileId?: string): boolean => {
  return Boolean(agentProfile.subagent.systemPrompt && agentProfile.subagent.enabled && (!currentProfileId || agentProfile.id !== currentProfileId));
};
