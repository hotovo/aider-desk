import { AgentProfile, ReasoningEffort, SettingsData, ToolApprovalState } from '@common/types';
import {
  AIDER_TOOL_ADD_CONTEXT_FILES,
  AIDER_TOOL_DROP_CONTEXT_FILES,
  AIDER_TOOL_GET_CONTEXT_FILES,
  AIDER_TOOL_GROUP_NAME,
  AIDER_TOOL_RUN_PROMPT,
  POWER_TOOL_AGENT,
  POWER_TOOL_BASH,
  POWER_TOOL_FILE_EDIT,
  POWER_TOOL_FILE_READ,
  POWER_TOOL_FILE_WRITE,
  POWER_TOOL_GLOB,
  POWER_TOOL_GREP,
  POWER_TOOL_GROUP_NAME,
  POWER_TOOL_SEMANTIC_SEARCH,
  TOOL_GROUP_NAME_SEPARATOR,
} from '@common/tools';

export type LlmProviderName =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'lmstudio'
  | 'bedrock'
  | 'deepseek'
  | 'openai-compatible'
  | 'ollama'
  | 'openrouter'
  | 'requesty'
  | 'groq';

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
  'deepseek',
  'gemini',
  'groq',
  'lmstudio',
  'ollama',
  'openai',
  'openai-compatible',
  'openrouter',
  'requesty',
];

export interface OpenAiProvider extends LlmProviderBase {
  name: 'openai';
  apiKey: string;
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
  models: string[];
}
export const isGroqProvider = (provider: LlmProviderBase): provider is GroqProvider => provider.name === 'groq';

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
  models: string[];
}
export const isOpenAiCompatibleProvider = (provider: LlmProviderBase): provider is OpenAiCompatibleProvider => provider.name === 'openai-compatible';

export const isOllamaProvider = (provider: LlmProviderBase): provider is OllamaProvider => provider.name === 'ollama';

export interface OpenRouterProvider extends LlmProviderBase {
  name: 'openrouter';
  apiKey: string;
  models: string[];
}
export const isOpenRouterProvider = (provider: LlmProviderBase): provider is OpenRouterProvider => provider.name === 'openrouter';

export interface RequestyProvider extends LlmProviderBase {
  name: 'requesty';
  apiKey: string;
  models: string[];
  useAutoCache: boolean;
  reasoningEffort: ReasoningEffort;
}
export const isRequestyProvider = (provider: LlmProviderBase): provider is RequestyProvider => provider.name === 'requesty';

export type LlmProvider =
  | OpenAiProvider
  | AnthropicProvider
  | GeminiProvider
  | LmStudioProvider
  | BedrockProvider
  | DeepseekProvider
  | GroqProvider
  | OpenAiCompatibleProvider
  | OllamaProvider
  | OpenRouterProvider
  | RequestyProvider;

export const DEFAULT_AGENT_PROVIDER_MODELS: Partial<Record<LlmProviderName, string[]>> = {
  openai: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o-mini', 'o4-mini'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-3-7-sonnet-20250219', 'claude-3-5-haiku-20241022'],
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash'],
  groq: ['moonshotai/kimi-k2-instruct'],
  lmstudio: ['qwen/qwen3-8b'],
  deepseek: ['deepseek-chat'],
  bedrock: ['us.anthropic.claude-3-7-sonnet-20250219-v1:0', 'anthropic.claude-3-7-sonnet-20250219-v1:0'],
  openrouter: ['anthropic/claude-sonnet-4'],
  requesty: ['anthropic/claude-sonnet-4-20250514'],
};

const DEFAULT_AGENT_PROFILE_ID = 'default';

export const DEFAULT_AGENT_PROFILE: AgentProfile = {
  id: DEFAULT_AGENT_PROFILE_ID,
  name: 'Power Tools',
  description: '',
  provider: 'anthropic',
  model: DEFAULT_AGENT_PROVIDER_MODELS.anthropic![0],
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
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_AGENT}`]: ToolApprovalState.Always,
  },
  includeContextFiles: true,
  includeRepoMap: false,
  usePowerTools: true,
  useAiderTools: false,
  useTodoTools: true,
  customInstructions: '',
  enabledServers: [],
  autoApprove: false,
};

export const INIT_PROJECT_RULES_AGENT_PROFILE: AgentProfile = {
  ...DEFAULT_AGENT_PROFILE,
  id: 'init',
  maxIterations: 50,
  maxTokens: 5000,
  includeRepoMap: true,
  includeContextFiles: false,
  usePowerTools: true,
  useAiderTools: false,
  useTodoTools: false,
  autoApprove: true,
  toolApprovals: {
    ...DEFAULT_AGENT_PROFILE.toolApprovals,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_EDIT}`]: ToolApprovalState.Never,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_WRITE}`]: ToolApprovalState.Always,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_BASH}`]: ToolApprovalState.Never,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_AGENT}`]: ToolApprovalState.Never,
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
  autoApprove: true,
  toolApprovals: {
    ...DEFAULT_AGENT_PROFILE.toolApprovals,
    [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_AGENT}`]: ToolApprovalState.Never,
  },
};

export const getLlmProviderConfig = (providerName: LlmProviderName, settings: SettingsData | null): LlmProvider => {
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
      case 'groq':
        provider = {
          name: 'groq',
          apiKey: '',
          models: [],
        } satisfies GroqProvider;
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
          models: [],
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
          models: [],
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
          models: [],
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
