# Examples Gallery

Real extension examples from the AiderDesk repository.

## Single-File Examples

### Theme Switcher (Commands)

```typescript
// theme.ts - Adds /theme command
import type { Extension, ExtensionContext, CommandDefinition } from '@aiderdesk/extensions';

const AVAILABLE_THEMES = ['dark', 'light', 'ocean', 'forest'];

const THEME_COMMAND: CommandDefinition = {
  name: 'theme',
  description: 'Switch the AiderDesk theme',
  arguments: [
    { description: 'Theme name', required: true, options: AVAILABLE_THEMES }
  ],
  async execute(args: string[], context: ExtensionContext): Promise<void> {
    const themeName = args[0];
    await context.updateSettings({ theme: themeName });
    context.getTaskContext()?.addLogMessage('info', `Theme: ${themeName}`);
  }
};

class ThemeExtension implements Extension {
  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('Theme Extension loaded', 'info');
  }

  getCommands(_context: ExtensionContext): CommandDefinition[] {
    return [THEME_COMMAND];
  }
}

export const metadata = {
  name: 'Theme Extension',
  version: '1.0.0',
  description: 'Adds /theme command',
  author: 'my_git_name',
  capabilities: ['commands']
};

export default ThemeExtension;
```

### Plan Mode (Modes + Events)

```typescript
// plan-mode.ts - Adds Plan mode with prepended instructions
import type { Extension, ExtensionContext, ModeDefinition, AgentStartedEvent } from '@aiderdesk/extensions';

const PLAN_USER_MESSAGE = 'Create a plan before coding...';

class PlanModeExtension implements Extension {
  getModes(): ModeDefinition[] {
    return [{ name: 'plan', label: 'Plan', description: 'Plan first', icon: 'GoProjectRoadmap' }];
  }

  async onAgentStarted(event: AgentStartedEvent): Promise<Partial<AgentStartedEvent>> {
    if (event.mode !== 'plan') return {};

    return {
      contextMessages: [
        { id: 'plan-user', role: 'user', content: PLAN_USER_MESSAGE },
        { id: 'plan-assistant', role: 'assistant', content: 'OK, I will plan first.' },
        ...event.contextMessages
      ]
    };
  }
}

export const metadata = {
  name: 'Plan Mode',
  version: '1.0.0',
  description: 'Adds Plan mode',
  author: 'my_git_name',
  capabilities: ['modes', 'events']
};

export default PlanModeExtension;
```

### Permission Gate (Blocking)

```typescript
// permission-gate.ts - Blocks dangerous commands
import type { Extension, ExtensionContext, ToolCalledEvent } from '@aiderdesk/extensions';

const DANGEROUS_PATTERNS = ['rm -rf', 'sudo', 'chmod 777'];

class PermissionGateExtension implements Extension {
  async onToolCalled(event: ToolCalledEvent, context: ExtensionContext): Promise<Partial<ToolCalledEvent>> {
    if (event.tool !== 'power---bash') return {};

    const command = event.toolInput.command as string;
    if (DANGEROUS_PATTERNS.some(p => command.includes(p))) {
      const taskContext = context.getTaskContext();
      const answer = await taskContext?.askQuestion(
        `Allow dangerous command: ${command}?`,
        { options: ['Yes', 'No'] }
      );
      if (answer !== 'Yes') {
        return { blocked: true };
      }
    }
    return {};
  }
}

export const metadata = {
  name: 'Permission Gate',
  version: '1.0.0',
  description: 'Prompts for dangerous commands',
  author: 'my_git_name',
  capabilities: ['events']
};

export default PermissionGateExtension;
```

## Folder Examples

### Tree-Sitter Repo Map (Folder + Dependencies)

```
tree-sitter-repo-map/
├── index.ts              # Main extension
├── config.ts             # Config management
├── logger.ts             # Local logger
├── constants.ts          # Extension constants
├── repo-map-manager.ts   # Core functionality
├── tree-sitter-parser.ts # Parser wrapper
├── package.json          # Dependencies
├── tsconfig.json         # TS config
├── README.md             # Docs
└── resources/
    ├── wasm/             # Tree-sitter WASM files
    └── queries/          # Language queries
```

Key patterns:
- Local imports only (no `@/` paths)
- Config stored in extension directory
- Resources bundled with extension
- Singleton manager pattern

### Sandbox (External Dependencies)

```
sandbox/
├── index.ts           # Extension implementation
└── package.json       # @anthropic-ai/sandbox-runtime
```

```json
// package.json
{
  "dependencies": {
    "@anthropic-ai/sandbox-runtime": "^0.0.38"
  }
}
```

### TPS Counter (UI Components + Data)

```typescript
// tps-counter/index.ts - Display tokens per second metrics
import { readFileSync } from 'fs';
import { join } from 'path';
import type {
  Extension,
  ExtensionContext,
  UIComponentDefinition,
  ResponseChunkEvent,
  ResponseCompletedEvent
} from '@aiderdesk/extensions';

export default class TPSCounterExtension implements Extension {
  static metadata = {
    name: 'TPS Counter',
    version: '1.0.0',
    description: 'Displays tokens per second for responses',
    author: 'my_git_name',
    capabilities: ['metrics', 'ui'],
  };

  private messageStartTimes = new Map<string, number>();
  private messageTpsData = new Map<string, { tps: number; tokens: number; duration: number }>();
  private currentData = { averageTps: 0, messageCount: 0 };

  async onResponseChunk(event: ResponseChunkEvent): Promise<void> {
    const messageId = event.chunk.messageId;
    if (!this.messageStartTimes.has(messageId)) {
      this.messageStartTimes.set(messageId, Date.now());
    }
  }

  async onResponseCompleted(event: ResponseCompletedEvent, context: ExtensionContext): Promise<void> {
    const messageId = event.response.messageId;
    const startTime = this.messageStartTimes.get(messageId);
    if (!startTime) return;

    const duration = (Date.now() - startTime) / 1000;
    const tokens = event.response.usageReport?.receivedTokens || 0;
    const tps = duration > 0 ? tokens / duration : 0;

    this.messageTpsData.set(messageId, { tps, tokens, duration });
    this.currentData.averageTps = this.calculateAverage();
    this.currentData.messageCount++;

    // Trigger UI refresh
    context.triggerUIDataRefresh('tps-counter');
    context.triggerUIDataRefresh('tps-counter-message-bar');
  }

  getUIComponents(): UIComponentDefinition[] {
    return [
      {
        id: 'tps-counter',
        placement: 'task-usage-info-bottom',
        jsx: readFileSync(join(__dirname, './TPSCounter.jsx'), 'utf-8'),
        loadData: true,
      },
      {
        id: 'tps-counter-message-bar',
        placement: 'task-message-bar',
        jsx: readFileSync(join(__dirname, './TPSMessageBar.jsx'), 'utf-8'),
        loadData: true,
      },
    ];
  }

  async getUIExtensionData(componentId: string): Promise<unknown> {
    if (componentId === 'tps-counter') {
      return this.currentData;
    }
    if (componentId === 'tps-counter-message-bar') {
      return Object.fromEntries(this.messageTpsData);
    }
    return undefined;
  }

  private calculateAverage(): number {
    // Calculate average TPS from all messages
    const values = Array.from(this.messageTpsData.values());
    return values.reduce((sum, v) => sum + v.tps, 0) / values.length;
  }
}
```

**TPSCounter.jsx:**
```jsx
({ data }) => {
  if (!data || data.messageCount === 0) return null;

  return (
    <div className="flex items-center gap-1 text-2xs mt-1 w-full justify-between">
      <span>Avg. tokens/s:</span>
      <span>{Math.round(data.averageTps)}</span>
    </div>
  );
}
```

**TPSMessageBar.jsx:**
```jsx
({ data, message }) => {
  if (!data || !message?.id) return null;

  const messageTps = data[message.id];
  if (!messageTps) return null;

  return (
    <span
      className="text-2xs mt-[4px] text-text-muted"
      title={`${messageTps.tokens} tokens in ${messageTps.duration.toFixed(2)}s`}
    >
      {Math.round(messageTps.tps)} TPS
    </span>
  );
}
```

### Multi-Model Run (Interactive UI)

```typescript
// multi-model-run/index.ts - Run prompts across multiple models
import { readFileSync } from 'fs';
import { join } from 'path';
import type {
  Extension,
  ExtensionContext,
  UIComponentDefinition,
  PromptStartedEvent
} from '@aiderdesk/extensions';

interface MultiModelState {
  models: Array<{ index: number; modelId: string }>;
  useWorktrees: boolean;
}

export default class MultiModelRunExtension implements Extension {
  static metadata = {
    name: 'Multi-Model Run',
    version: '1.0.0',
    description: 'Run prompts across multiple models',
    author: 'my_git_name',
    capabilities: ['ui', 'task-manipulation'],
  };

  private state: MultiModelState = { models: [], useWorktrees: true };

  getUIComponents(): UIComponentDefinition[] {
    return [{
      id: 'multi-model-selector',
      placement: 'task-input-above',
      jsx: readFileSync(join(__dirname, './MultiModelSelector.jsx'), 'utf-8'),
      loadData: true,
    }];
  }

  async getUIExtensionData(componentId: string): Promise<unknown> {
    if (componentId === 'multi-model-selector') {
      return this.state;
    }
    return undefined;
  }

  async executeUIExtensionAction(
    componentId: string,
    action: string,
    args: unknown[],
    context: ExtensionContext
  ): Promise<unknown> {
    if (componentId !== 'multi-model-selector') return;

    if (action === 'add-model') {
      this.state.models.push({
        index: this.state.models.length,
        modelId: ''
      });
      context.triggerUIDataRefresh('multi-model-selector');
    }

    if (action === 'remove-model') {
      const index = args[0] as number;
      this.state.models = this.state.models.filter(m => m.index !== index);
      context.triggerUIDataRefresh('multi-model-selector');
    }

    if (action === 'update-model') {
      const [index, modelId] = args as [number, string];
      const model = this.state.models.find(m => m.index === index);
      if (model) {
        model.modelId = modelId;
        context.triggerUIDataRefresh('multi-model-selector');
      }
    }

    if (action === 'set-use-worktrees') {
      this.state.useWorktrees = args[0] as boolean;
      context.triggerUIDataRefresh('multi-model-selector');
    }

    return { success: true };
  }

  async onPromptStarted(event: PromptStartedEvent, context: ExtensionContext): Promise<void> {
    const selectedModels = this.state.models.filter(m => m.modelId);
    if (selectedModels.length === 0) return;

    // Create duplicate tasks for each additional model
    const projectContext = context.getProjectContext();
    const taskContext = context.getTaskContext();

    for (const model of selectedModels.slice(1)) {
      await projectContext.createTask({
        name: `${taskContext?.data.name} (${model.modelId})`,
        initialPrompt: event.prompt,
        modelId: model.modelId,
      });
    }
  }
}
```

**MultiModelSelector.jsx:**
```jsx
({ data, models, providers, ui, executeExtensionAction }) => {
  const { useCallback } = React;
  const { Button, ModelSelector, Checkbox } = ui;

  const modelSelections = data?.models ?? [];
  const useWorktrees = data?.useWorktrees ?? true;

  const handleAddModel = useCallback(async () => {
    await executeExtensionAction('add-model');
  }, [executeExtensionAction]);

  const handleRemoveModel = useCallback((index) => async () => {
    await executeExtensionAction('remove-model', index);
  }, [executeExtensionAction]);

  const handleModelChange = useCallback((index) => async (model) => {
    const modelId = model ? `${model.providerId}/${model.id}` : '';
    await executeExtensionAction('update-model', index, modelId);
  }, [executeExtensionAction]);

  const handleWorktreesChange = useCallback(async (checked) => {
    await executeExtensionAction('set-use-worktrees', checked);
  }, [executeExtensionAction]);

  return (
    <div className="flex flex-col gap-2 pb-2 w-full">
      <div className="flex gap-4 w-full justify-between items-center">
        <div className="flex items-center gap-2 flex-wrap">
          {modelSelections.map((selection) => (
            <div key={selection.index} className="flex items-center gap-1">
              <ModelSelector
                models={models}
                providers={providers}
                selectedModelId={selection.modelId}
                onChange={handleModelChange(selection.index)}
              />
              <button
                onClick={handleRemoveModel(selection.index)}
                className="text-text-muted hover:text-text-primary"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <Checkbox
            label="Use worktrees"
            checked={useWorktrees}
            onChange={handleWorktreesChange}
            size="xs"
          />
          <Button
            variant="outline"
            size="xs"
            onClick={handleAddModel}
          >
            + Add model
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### External Rules (Config Component + Events)

Extension with a **config component** (settings dialog) that lets users configure additional rule folders, plus an event handler that uses the loaded config.

```
external-rules/
├── index.ts              # Main extension with 3 config methods + event handler
├── ConfigComponent.jsx   # Settings UI (text input for comma-separated folders)
└── config.json           # Persisted config: { "ruleFolders": "" }
```

**index.ts:**
```typescript
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Extension, ExtensionContext, RuleFilesRetrievedEvent } from '@aiderdesk/extensions';

const configComponentJsx = readFileSync(join(__dirname, './ConfigComponent.jsx'), 'utf-8');

const DEFAULT_RULE_DIRECTORIES = ['.cursor/rules', '.roo/rules'];
const DEFAULT_ROOT_RULE_FILES = ['CLAUDE.md'];

interface ExternalRulesConfig {
  ruleFolders: string;
}

const DEFAULT_CONFIG: ExternalRulesConfig = { ruleFolders: '' };

export default class ExternalRulesExtension implements Extension {
  static metadata = {
    name: 'External Rules',
    version: '1.0.0',
    description: 'Includes rule files from Cursor, Claude Code, and Roo Code',
    author: 'author-name',
    capabilities: ['context'],
  };

  private configPath: string;

  constructor() {
    this.configPath = join(__dirname, 'config.json');
  }

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('External Rules Extension loaded', 'info');
  }

  // --- Config Component API ---

  getConfigComponent(_context: ExtensionContext): string {
    return configComponentJsx;
  }

  async getConfigData(_context: ExtensionContext): Promise<ExternalRulesConfig> {
    try {
      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, 'utf-8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
      }
    } catch { /* ignore */ }
    return { ...DEFAULT_CONFIG };
  }

  async saveConfigData(configData: unknown, _context: ExtensionContext): Promise<unknown> {
    const merged: ExternalRulesConfig = { ...DEFAULT_CONFIG, ...configData as Partial<ExternalRulesConfig> };
    writeFileSync(this.configPath, JSON.stringify(merged, null, 2), 'utf-8');
    return merged;
  }

  // --- Event Handler using loaded config ---

  async onRuleFilesRetrieved(event: RuleFilesRetrievedEvent, context: ExtensionContext) {
    const projectDir = context.getProjectDir();
    if (!projectDir) return undefined;

    // Load user-configured additional folders
    const config = await this.getConfigData(context);
    const additionalFolders = config.ruleFolders
      ? config.ruleFolders.split(',').map((f) => f.trim()).filter(Boolean)
      : [];

    // Merge defaults with user folders
    const allDirectories = [...DEFAULT_RULE_DIRECTORIES, ...additionalFolders];
    // ... scan directories and return augmented files ...
  }
}
```

**ConfigComponent.jsx:**
```jsx
({ config, updateConfig, ui }) => {
  const { Input } = ui;

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Additional Rule Folders"
        value={config?.ruleFolders || ''}
        onChange={(value) => updateConfig({ ...config, ruleFolders: value })}
        placeholder=".custom-rules, .ai/rules"
      />
      <p className="text-xs text-text-secondary -mt-2">
        Comma-separated folder paths relative to project root. Scanned in addition to built-in sources.
      </p>
    </div>
  );
};
```

**Key patterns shown:**
- JSX loaded from external file via `readFileSync` at module level
- Three-method config API: `getConfigComponent`, `getConfigData`, `saveConfigData`
- **No inner state**: reads directly from `config` prop, uses `ui.Input` instead of raw HTML
- Config used at runtime by event handlers (`onRuleFilesRetrieved` calls `this.getConfigData`)
- Default merging ensures missing fields are handled gracefully

## Common Patterns Summary

| Pattern | Extension | Use Case |
|---------|-----------|----------|
| Commands | theme.ts | Add /commands |
| Modes | plan-mode.ts | Custom conversation modes |
| Blocking | permission-gate.ts | Prevent operations |
| Modifying | tree-sitter-repo-map | Change event data |
| Config | tree-sitter-repo-map | Persistent settings (internal) |
| **Config Component** | **external-rules** | **Settings UI dialog with Save/Cancel** |
| Agents | pirate.ts | Custom agent profiles |
| Tools | chunkhound-search | Custom AI tools |
| UI Display | tps-counter | Show information in UI |
| UI Interactive | multi-model-run | User input in UI |
