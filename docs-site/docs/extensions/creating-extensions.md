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

<img src="./images/ui-components-overview.png" alt="UI Components in AiderDesk" width="800" />

#### Available Placements

UI components can be placed in the following locations:

| Placement | Location | Description |
|-----------|----------|-------------|
| `task-status-bar-left` | Task status bar | Left side of the task status bar |
| `task-status-bar-right` | Task status bar | Right side of the task status bar |
| `task-input-above` | Task input | Above the task input field |
| `task-messages-top` | Task messages | Top of the messages area |
| `task-messages-bottom` | Task messages | Bottom of the messages area |
| `header-left` | Header bar | Left side of the header |
| `header-right` | Header bar | Right side of the header |

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
        jsx: (props) => {
          const { Button, Flex, Text } = props.ui;
          return (
            <Flex align="center" gap="xs">
              <Button
                variant="subtle"
                size="compact-xs"
                onClick={() => props.executeExtensionAction('my-action')}
              >
                <Text size="xs">My Action</Text>
              </Button>
            </Flex>
          );
        },
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
        await taskContext.addLogMessage('info', 'Button clicked!');
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
// multi-model-selector.ts
import type { Extension, ExtensionContext, UIComponentDefinition } from '@aiderdesk/extensions';

export default class MultiModelExtension implements Extension {
  getUIComponents(context: ExtensionContext): UIComponentDefinition[] {
    return [
      {
        id: 'model-selector',
        placement: 'task-status-bar-left',
        loadData: true, // Enable data loading
        jsx: (props) => {
          const { Flex, Text, ModelSelector } = props.ui;
          const { data, executeExtensionAction } = props;
          
          // data is populated by getUIExtensionData
          const selectedModels = data?.selectedModels || [];
          
          return (
            <Flex align="center" gap="xs">
              <Text size="xs">Models:</Text>
              <ModelSelector
                value={selectedModels}
                onChange={(models) => executeExtensionAction('select-models', models)}
                multiple
              />
            </Flex>
          );
        },
      },
    ];
  }

  async getUIExtensionData(
    componentId: string,
    context: ExtensionContext
  ): Promise<unknown> {
    if (componentId === 'model-selector') {
      // Return data for the component
      return {
        selectedModels: ['gpt-4', 'claude-3'],
      };
    }
    return undefined;
  }

  async executeUIExtensionAction(
    componentId: string,
    action: string,
    args: unknown[],
    context: ExtensionContext
  ): Promise<unknown> {
    if (action === 'select-models') {
      // Handle the action and refresh UI data
      const models = args[0] as string[];
      // ... store selection ...
      
      // Trigger UI refresh to reload data
      context.triggerUIDataRefresh(componentId);
      return { success: true };
    }
    return undefined;
  }
}
```

#### Available UI Components

The following components are available via `props.ui`:

| Component | Description |
|-----------|-------------|
| `Button` | Standard button with variants |
| `IconButton` | Button with icon only |
| `Checkbox` | Checkbox input |
| `Input` | Text input field |
| `Select` | Dropdown select |
| `MultiSelect` | Multi-value select |
| `TextArea` | Multi-line text input |
| `RadioButton` | Radio button input |
| `Slider` | Range slider |
| `DatePicker` | Date picker |
| `Chip` | Tag/chip component |
| `ModelSelector` | AiderDesk model selector |
| `Flex` | Flex container |
| `Box` | Generic container |
| `Text` | Text component |
| `Badge` | Status badge |
| `Tooltip` | Tooltip wrapper |

#### Component Props

The `jsx` function receives a `props` object with:

| Property | Type | Description |
|----------|------|-------------|
| `React` | `React` | React library for hooks and createElement |
| `task` | `TaskContext` | Current task context (if available) |
| `projectDir` | `string` | Project directory path |
| `api` | `ApplicationAPI` | AiderDesk API |
| `mode` | `string` | Current chat mode |
| `models` | `Model[]` | Available models |
| `providers` | `Provider[]` | Available providers |
| `ui` | `UIComponents` | UI component library |
| `data` | `unknown` | Data from `getUIExtensionData` |
| `executeExtensionAction` | `function` | Call extension action handler |

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
