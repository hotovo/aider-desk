# Data Model: ZAI Coding Plan Provider

## Core Entity

### ZaiPlanProvider
**Description**: Configuration entity for ZAI provider settings following existing provider pattern
**Fields**:
- `name: 'zai-plan'` - Provider identifier (fixed)
- `apiKey: string` - ZAI API authentication key

## Type System Integration

### Provider Type Extensions
Following the existing pattern in `src/common/agent.ts`:

```typescript
// Add to LlmProviderName union
export type LlmProviderName =
  | 'anthropic'
  | 'azure'
  | 'bedrock'
  | 'cerebras'
  | 'deepseek'
  | 'gemini'
  | 'groq'
  | 'lmstudio'
  | 'ollama'
  | 'openai'
  | 'openai-compatible'
  | 'openrouter'
  | 'requesty'
  | 'vertex-ai'
  | 'zai-plan';  // New addition

// Add provider interface
export interface ZaiPlanProvider extends LlmProviderBase {
  name: 'zai-plan';
  apiKey: string;
}

// Add type guard
export const isZaiPlanProvider = (provider: LlmProviderBase): provider is ZaiPlanProvider => 
  provider.name === 'zai-plan';

// Add to LlmProvider union
export type LlmProvider =
  | OpenAiProvider
  | AnthropicProvider
  | AzureProvider
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
  | RequestyProvider
  | ZaiPlanProvider;  // New addition

// Add to AVAILABLE_PROVIDERS array
export const AVAILABLE_PROVIDERS: LlmProviderName[] = [
  'anthropic',
  'azure',
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
  'zai-plan',  // New addition
];
```

### Default Provider Parameters
Following the existing pattern in `getDefaultProviderParams` function:

```typescript
case 'zai-plan':
  provider = {
    name: 'zai-plan',
    apiKey: '',
  } satisfies ZaiPlanProvider;
  break;
```

## Model Information
Models will be discovered dynamically via the ZAI API endpoint `https://api.z.ai/api/paas/v4/models` and will follow the existing Model interface pattern from `@common/types`.

## Integration Points

### Agent System
- Provider selection in agent profiles
- Model configuration using existing Model interface
- Cost tracking integration following existing patterns

### UI Components
- Provider configuration form following existing parameter component patterns
- Model selection using existing ModelLibrary components
- Status indicators following existing provider patterns

### Storage
- Configuration persistence using electron-store (existing pattern)
- Model caching following existing provider patterns
- Usage tracking using existing database schema

## Implementation Strategy

The ZAI provider will follow the exact same patterns as existing providers:
1. Type definitions in `src/common/agent.ts`
2. Provider implementation in `src/main/models/providers/zai-plan.ts`
3. UI components in `src/renderer/src/components/ModelLibrary/providers/`
4. Integration with existing model manager and agent systems