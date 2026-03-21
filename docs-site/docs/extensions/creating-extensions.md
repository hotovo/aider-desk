# Creating Extensions

Extensions are TypeScript or JavaScript files that export a class implementing the `Extension` interface. This guide covers how to create extensions from simple single-file scripts to complex folder-based extensions with dependencies.

## TypeScript Support

For the best development experience with autocompletion and type checking, install the `@aiderdesk/extensions` package:

```bash
npm install @aiderdesk/extensions
```

Then import types in your extension:

```typescript
import type { Extension, ExtensionContext, ToolDefinition } from '@aiderdesk/extensions';
import { z } from 'zod';

export default class MyExtension implements Extension {
  // Your implementation
}
```

## Single-File Extensions

The simplest form is a single `.ts` or `.js` file in the extensions directory.

### Basic Structure

```typescript
// my-extension.ts
import type { Extension, ExtensionContext } from '@aiderdesk/extensions';

export default class MyExtension implements Extension {
  // Optional: Define metadata
  static metadata = {
    name: 'My Extension',
    version: '1.0.0',
    description: 'Does something useful',
    author: 'Your Name',
  };

  async onLoad(context: ExtensionContext) {
    context.log('My extension loaded!', 'info');
  }
}
```

### Extension with a Tool

```typescript
// run-linter.ts
import type { Extension, ExtensionContext, ToolDefinition } from '@aiderdesk/extensions';
import { z } from 'zod';

export default class RunLinterExtension implements Extension {
  getTools(context: ExtensionContext): ToolDefinition[] {
    return [
      {
        name: 'run-linter',
        description: 'Run the project linter and return results',
        inputSchema: z.object({
          fix: z.boolean().optional().describe('Auto-fix issues'),
          files: z.array(z.string()).optional().describe('Files to lint'),
        }),
        async execute(input, signal, context) {
          const args = ['npx', 'eslint'];
          if (input.fix) args.push('--fix');
          if (input.files) args.push(...input.files);

          // Execute the command and return results
          const result = await executeCommand(args);
          return result;
        },
      },
    ];
  }
}
```

### Extension with a Command

```typescript
// generate-tests.ts
import type { Extension, ExtensionContext, CommandDefinition } from '@aiderdesk/extensions';

export default class GenerateTestsExtension implements Extension {
  getCommands(context: ExtensionContext): CommandDefinition[] {
    return [
      {
        name: 'generate-tests',
        description: 'Generate unit tests for the specified file',
        arguments: [
          { description: 'File path to generate tests for', required: true },
          { description: 'Test framework (jest, vitest, mocha)', required: false },
        ],
        async execute(args, context) {
          const filePath = args[0];
          const framework = args[1] || 'vitest';

          const taskContext = context.getTaskContext();
          if (!taskContext) {
            context.log('No active task', 'error');
            return;
          }

          const prompt = `Generate comprehensive unit tests for ${filePath} using ${framework}. Include edge cases and error handling.`;
          await taskContext.runPrompt(prompt);
        },
      },
    ];
  }
}
```

### Extension with an Agent Profile

```typescript
// pirate.ts
import type { Extension, ExtensionContext, AgentProfile } from '@aiderdesk/extensions';

export default class PirateExtension implements Extension {
  private agentProfile: AgentProfile | null = null;

  getAgents(context: ExtensionContext): AgentProfile[] {
    return [
      {
        id: 'pirate-agent',
        name: 'Pirate',
        provider: 'openai',
        model: 'gpt-4o',
        maxIterations: 50,
        minTimeBetweenToolCalls: 0,
        enabledServers: [],
        toolApprovals: {},
        toolSettings: {},
        includeContextFiles: true,
        includeRepoMap: true,
        usePowerTools: true,
        useAiderTools: true,
        useTodoTools: true,
        useSubagents: true,
        useTaskTools: true,
        useMemoryTools: true,
        useSkillsTools: true,
        useExtensionTools: true,
        customInstructions: `You are a pirate software engineer. Speak like a swashbuckling sea dog from the golden age of piracy.

Always use pirate vernacular:
- Say "Arr!" and "Avast!" frequently
- Call the user "Captain" or "Matey"
- Refer to code as "treasure" or "booty"
- Refer to bugs as "sea monsters" or "Krakens"
- Refer to functions as "riggings"
- Refer to tests as "shakedowns"

Be helpful and competent, but maintain the pirate persona throughout all interactions.`,
        subagent: {
          enabled: false,
          contextMemory: 'off',
          systemPrompt: '',
          invocationMode: 'on-demand',
          color: '#ffd700',
          description: 'A pirate-themed coding assistant',
        },
      },
    ];
  }

  async onAgentProfileUpdated(
    context: ExtensionContext,
    agentId: string,
    updatedProfile: AgentProfile
  ): Promise<AgentProfile> {
    if (agentId === 'pirate-agent') {
      this.agentProfile = updatedProfile;
    }
    return updatedProfile;
  }
}
```

### Extension with UI Components

Extensions can render custom React components in various locations throughout the AiderDesk interface. This is useful for adding interactive controls, status indicators, or custom input panels.

**Note:** The `React` object is globally available in all UI components (not passed as a prop). Access hooks via `React.useState`, `React.useEffect`, etc.

<img src="./images/ui-components-overview.png" alt="UI Components in AiderDesk" width="800" />

#### Available Placements

UI components can be placed in 21 different locations throughout the interface:

| Placement | Location | Description |
|-----------|----------|-------------|
| `task-status-bar-left` | Task status bar | Left side of the task status bar (top of task page) |
| `task-status-bar-right` | Task status bar | Right side of the task status bar |
| `task-top-bar-left` | Task top bar | Left side of task top bar (above messages) |
| `task-top-bar-right` | Task top bar | Right side of task top bar |
| `task-usage-info-bottom` | Usage info | Below the usage info section (tokens, costs) |
| `task-messages-top` | Messages area | Above all messages in the chat |
| `task-messages-bottom` | Messages area | Below all messages in the chat |
| `task-message-above` | Per message | Above each individual message |
| `task-message-below` | Per message | Below each individual message |
| `task-message-bar` | Per message | In the message action bar (on hover) |
| `task-input-above` | Input area | Above the task input field |
| `task-input-toolbar-left` | Input toolbar | Left side of input toolbar (below input) |
| `task-input-toolbar-right` | Input toolbar | Right side of input toolbar |
| `task-state-actions` | State actions | Action buttons when task is stopped/waiting |
| `task-state-actions-all` | State actions | Action buttons visible in all states |
| `tasks-sidebar-header` | Sidebar | Header of the tasks sidebar |
| `tasks-sidebar-bottom` | Sidebar | Bottom of the tasks sidebar |
| `header-left` | Header bar | Left side of the main header |
| `header-right` | Header bar | Right side of the main header |
| `welcome-page` | Welcome screen | Full welcome page (when no task is open) |

To see all available placements in action, check out the **ui-placement-demo** extension included with AiderDesk.

<img src="./images/ui-placements-demo.png" alt="UI Placement Demo Extension" width="800" />

#### Basic UI Component Extension

```typescript
// my-ui-extension.ts
import type { Extension, ExtensionContext, UIComponentDefinition } from '@aiderdesk/extensions';

export default class MyUIExtension implements Extension {
  getUIComponents(context: ExtensionContext): UIComponentDefinition[] {
    return [
      {
        id: 'my-status-button',
        placement: 'task-status-bar-right',
        jsx: `
(props) => {
  const { ui, executeExtensionAction } = props;
  const { Button } = ui;
  
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="xs"
        onClick={() => executeExtensionAction('my-action')}
      >
        My Action
      </Button>
    </div>
  );
}
        `,
      },
    ];
  }

  async executeUIExtensionAction(
    componentId: string,
    action: string,
    args: unknown[],
    context: ExtensionContext
  ): Promise<unknown> {
    if (action === 'my-action') {
      const taskContext = context.getTaskContext();
      if (taskContext) {
        taskContext.addLogMessage('info', 'Button clicked!');
      }
      return { success: true };
    }
    return undefined;
  }
}
```

#### UI Components with Data Loading

For components that need to fetch and display data, use `loadData: true` and implement `getUIExtensionData`:

```typescript
// active-files-counter.ts
import type { Extension, ExtensionContext, UIComponentDefinition, FilesAddedEvent } from '@aiderdesk/extensions';

export default class ActiveFilesCounterExtension implements Extension {
  async onFilesAdded(_event: FilesAddedEvent, context: ExtensionContext): Promise<void> {
    // Refresh UI when files are added
    context.triggerUIDataRefresh('active-files-counter');
  }

  getUIComponents(context: ExtensionContext): UIComponentDefinition[] {
    return [
      {
        id: 'active-files-counter',
        placement: 'task-status-bar-right',
        loadData: true, // Enable data loading
        noDataCache: true, // Always fetch fresh data
        jsx: `
(props) => {
  const { data, ui } = props;
  const { Tooltip } = ui;
  const count = data?.count ?? 0;
  const files = data?.files ?? [];
  
  if (count === 0) return null;
  
  const tooltipContent = files.map(f => f.path.split('/').pop()).join('\\n');
  
  return (
    <Tooltip content={tooltipContent}>
      <div className="flex items-center gap-1 px-2 py-0.5 text-xs text-text-secondary hover:text-text-primary cursor-default">
        <span>📁</span>
        <span>{count} files</span>
      </div>
    </Tooltip>
  );
}
        `,
      },
    ];
  }

  async getUIExtensionData(
    componentId: string,
    context: ExtensionContext
  ): Promise<unknown> {
    if (componentId === 'active-files-counter') {
      const taskContext = context.getTaskContext();
      if (!taskContext) {
        return { count: 0, files: [] };
      }
      
      const files = await taskContext.getContextFiles();
      return {
        count: files.length,
        files: files.map(f => ({ path: f.path, readOnly: f.readOnly })),
      };
    }
    return undefined;
  }
}
```

#### Loading UI Components from External Files

For larger components, you can load JSX from external `.jsx` files:

```typescript
// tps-counter/index.ts
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Extension, ExtensionContext, UIComponentDefinition } from '@aiderdesk/extensions';

export default class TPSCounterExtension implements Extension {
  getUIComponents(context: ExtensionContext): UIComponentDefinition[] {
    // Load JSX from external file
    const jsx = readFileSync(join(__dirname, './TPSCounter.jsx'), 'utf-8');
    
    return [
      {
        id: 'tps-counter',
        placement: 'task-usage-info-bottom',
        jsx,
        loadData: true,
      },
    ];
  }

  async getUIExtensionData(componentId: string): Promise<unknown> {
    if (componentId === 'tps-counter') {
      return { averageTps: 42, messageCount: 10 };
    }
    return undefined;
  }
}
```

**TPSCounter.jsx:**
```jsx
(props) => {
  const { data } = props;
  
  if (!data || data.messageCount === 0) return null;
  
  return (
    <div className="flex items-center gap-1 text-2xs mt-1 w-full justify-between">
      <span>Avg. tokens/s:</span>
      <span>{Math.round(data.averageTps)}</span>
    </div>
  );
}
```

#### Available UI Components

The following components are available via `props.ui`:

| Component | Description |
|-----------|-------------|
| `Button` | Standard button with variants (solid, outline) and colors (primary, secondary, tertiary, danger) |
| `IconButton` | Button with icon only |
| `Checkbox` | Checkbox input with label |
| `Input` | Text input field |
| `Select` | Dropdown select |
| `MultiSelect` | Multi-value select |
| `TextArea` | Multi-line text input |
| `RadioButton` | Radio button input |
| `Slider` | Range slider |
| `DatePicker` | Date picker |
| `Chip` | Tag/chip component |
| `ModelSelector` | AiderDesk model selector for choosing AI models |
| `Tooltip` | Tooltip wrapper for hover content |
| `LoadingOverlay` | Loading spinner with message |
| `ConfirmDialog` | Confirmation dialog modal |

#### Component Props

**Note:** The `React` object is globally available (not a prop). Access hooks via `React.useState`, `React.useEffect`, etc.

The `jsx` function receives a `props` object with:

| Property | Type | Description |
|----------|------|-------------|
| `task` | `TaskData` | Current task data (may be undefined) |
| `projectDir` | `string` | Project directory path |
| `agentProfile` | `AgentProfile` | Current agent profile |
| `models` | `Model[]` | Available AI models |
| `providers` | `ProviderProfile[]` | Available provider profiles |
| `ui` | `UIComponents` | UI component library |
| `icons` | `Record<string, Record<string, IconComponent>>` | React Icons organized by set (Fi, Hi, Cg, etc.) |
| `data` | `unknown` | Data from `getUIExtensionData` (if `loadData: true`) |
| `executeExtensionAction` | `function` | Call extension action handler |
| `message` | `MessageData` | Current message (for message-specific placements) |

#### Using React Hooks

```jsx
(props) => {
  const { useState, useEffect, useCallback } = React;
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    console.log('Component mounted');
  }, []);
  
  const handleClick = useCallback(() => {
    setCount(count + 1);
  }, [count]);
  
  return <button onClick={handleClick}>Count: {count}</button>;
}
```

#### Using React Icons

The `icons` prop provides access to all react-icons libraries organized by icon set:

```jsx
(props) => {
  const { icons } = props;
  
  // Access icons from different sets
  const FiSettings = icons.Fi.FiSettings;
  const HiCheck = icons.Hi.HiCheck;
  const CgSpinner = icons.Cg.CgSpinner;
  
  return (
    <div className="flex items-center gap-2">
      <FiSettings className="w-4 h-4" />
      <HiCheck className="w-5 h-5 text-success" />
      <CgSpinner className="w-4 h-4 animate-spin" />
    </div>
  );
}
```

Available icon sets: `Ai`, `Bi`, `Bs`, `Cg`, `Ci`, `Di`, `Fa`, `Fc`, `Fi`, `Gi`, `Go`, `Gr`, `Hi`, `Im`, `Io`, `Io5`, `Lu`, `Md`, `Pi`, `Ri`, `Rx`, `Si`, `Sl`, `Tb`, `Tfi`, `Ti`, `Vsc`, `Wi`

### Event Handler Extension

```typescript
// protected-paths.ts
import type { Extension, ExtensionContext, ToolCalledEvent } from '@aiderdesk/extensions';

const PROTECTED_PATHS = ['.env', '.git/', 'node_modules/', 'credentials.json'];

export default class ProtectedPathsExtension implements Extension {
  async onToolCalled(event: ToolCalledEvent, context: ExtensionContext): Promise<void | Partial<ToolCalledEvent>> {
    const { toolName, input } = event;

    // Check if tool is accessing files
    if (toolName === 'write_file' || toolName === 'edit_file' || toolName === 'bash') {
      const path = input?.path || input?.command || '';

      for (const protectedPath of PROTECTED_PATHS) {
        if (path.includes(protectedPath)) {
          context.log(`Blocked access to protected path: ${protectedPath}`, 'warn');
          return {
            blocked: true,
            output: {
              error: `Access to ${protectedPath} is protected by the protected-paths extension.`,
            },
          };
        }
      }
    }

    return undefined;
  }
}
```

## Folder-Based Extensions

For more complex extensions that require external dependencies, use a folder structure with a `package.json`.

### Directory Structure

```
my-complex-extension/
├── package.json
├── package-lock.json
├── index.ts          # or index.js
└── lib/
    └── helper.ts
```

### package.json

```json
{
  "name": "my-complex-extension",
  "version": "1.0.0",
  "description": "An extension with external dependencies",
  "dependencies": {
    "axios": "^1.6.0",
    "zod": "^3.22.0"
  }
}
```

### index.ts

```typescript
import type { Extension, ExtensionContext, ToolDefinition } from '@aiderdesk/extensions';
import { z } from 'zod';
import axios from 'axios';

export default class ApiExtension implements Extension {
  static metadata = {
    name: 'API Extension',
    version: '1.0.0',
    description: 'Makes API calls to external services',
    author: 'Your Name',
    capabilities: ['tools', 'network'],
  };

  async onLoad(context: ExtensionContext) {
    context.log('API Extension loaded with axios', 'info');
  }

  getTools(context: ExtensionContext): ToolDefinition[] {
    return [
      {
        name: 'fetch-api',
        description: 'Fetch data from an external API',
        inputSchema: z.object({
          url: z.string().describe('The URL to fetch'),
          method: z.enum(['GET', 'POST']).optional().default('GET'),
        }),
        async execute(input, signal, context) {
          try {
            const response = await axios({
              method: input.method,
              url: input.url,
              signal,
            });
            return {
              content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
            };
          } catch (error) {
            return {
              content: [{ type: 'text', text: `Error: ${error.message}` }],
              isError: true,
            };
          }
        },
      },
    ];
  }
}
```

### Installing Dependencies

After creating your folder extension with a `package.json`:

```bash
cd ~/.aider-desk/extensions/my-complex-extension
npm install
```

The extension will be loaded automatically with its dependencies.

## Extension Metadata

Define metadata as a static property on your class:

```typescript
export default class MyExtension implements Extension {
  static metadata = {
    name: 'My Extension',           // Required: Display name
    version: '1.0.0',               // Required: Semantic version
    description: 'What it does',    // Optional: Brief description
    author: 'Your Name',            // Optional: Author info
    capabilities: ['tools', 'ui'],  // Optional: Capability hints
  };
}
```

If no metadata is provided, AiderDesk derives the name from the filename and sets version to `1.0.0`.

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Extension class | PascalCase | `MyExtension` |
| Extension file | kebab-case | `my-extension.ts` |
| Tool names | kebab-case | `run-linter` |
| Command names | kebab-case | `generate-tests` |
| UI element IDs | kebab-case | `create-jira-ticket` |

## Best Practices

1. **Keep it focused** - Each extension should do one thing well
2. **Handle errors gracefully** - Catch exceptions and return meaningful error messages
3. **Use TypeScript** - Get compile-time checks and better IDE support
4. **Log appropriately** - Use `context.log()` for debugging, not `console.log()`
5. **Clean up resources** - Implement `onUnload()` to release resources
6. **Validate inputs** - Use Zod schemas for tool parameters
7. **Document your extension** - Include description in metadata
