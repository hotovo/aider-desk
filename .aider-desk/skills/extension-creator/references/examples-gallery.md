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
  author: 'AiderDesk',
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
  author: 'AiderDesk',
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
  author: 'AiderDesk',
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

## Common Patterns Summary

| Pattern | Extension | Use Case |
|---------|-----------|----------|
| Commands | theme.ts | Add /commands |
| Modes | plan-mode.ts | Custom conversation modes |
| Blocking | permission-gate.ts | Prevent operations |
| Modifying | tree-sitter-repo-map | Change event data |
| Config | tree-sitter-repo-map | Persistent settings |
| Agents | pirate.ts | Custom agent profiles |
| Tools | chunkhound-search | Custom AI tools |
