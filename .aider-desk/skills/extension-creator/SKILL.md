---
name: extension-creator
description: Create AiderDesk extensions by setting up extension files, defining metadata, implementing Extension interface methods, and updating documentation. Use when building a new extension, creating extension commands, tools, or event handlers.
---

# Extension Creator

Create AiderDesk extensions that extend functionality through events, commands, tools, agents, and modes.

## Extension Types

1. **Single-file extensions** - Simple extensions in one `.ts` file (e.g., `theme.ts`)
2. **Folder extensions** - Complex extensions with dependencies and multiple files (e.g., `tree-sitter-repo-map/`)

## Quick Workflow

1. **Determine type**: Single-file (no dependencies) or folder (has npm dependencies, resources)
2. **Create location**: `packages/extensions/extensions/` directory
3. **Implement Extension interface** with required methods
4. **Add metadata export**
5. **Update documentation files**
6. **Verify with code-checker**

## Files to Create

### Single-File Extension

```
packages/extensions/extensions/my-extension.ts
```

### Folder Extension

```
packages/extensions/extensions/my-extension/
├── index.ts           # Main extension file (implements Extension)
├── package.json       # npm dependencies
├── tsconfig.json      # TypeScript config (module: ES2020+)
├── README.md          # Documentation
├── config.ts          # Optional: persistent config storage
├── logger.ts          # Optional: local logger
├── constants.ts       # Optional: extension constants
└── resources/         # Optional: WASM, queries, assets
```

## Extension Structure

```typescript
import type { Extension, ExtensionContext, AgentStartedEvent } from '@aiderdesk/extensions';

class MyExtension implements Extension {
  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('Extension loaded', 'info');
  }

  // Optional: Register commands
  getCommands(_context: ExtensionContext): CommandDefinition[] {
    return [MY_COMMAND];
  }

  // Optional: Handle events
  async onAgentStarted(
    event: AgentStartedEvent,
    context: ExtensionContext
  ): Promise<void | Partial<AgentStartedEvent>> {
    // Modify event or return partial
    return { contextMessages: [...event.contextMessages] };
  }
}

export const metadata = {
  name: 'My Extension',
  version: '1.0.0',
  description: 'What this extension does',
  author: 'Author Name',
  capabilities: ['events', 'commands'], // or: 'tools', 'agents', 'modes'
};

export default MyExtension;
```

## Files to Update

After creating the extension, update:

### 1. packages/extensions/extensions.json

Add entry to `extensions` array:

```json
{
  "id": "my-extension",
  "name": "My Extension",
  "description": "Description of what it does",
  "file": "extensions/my-extension.ts",        // Single-file
  "type": "single",
  "capabilities": ["onLoad", "onAgentStarted"]
}
```

Or for folder:

```json
{
  "id": "my-extension",
  "name": "My Extension",
  "description": "Description",
  "folder": "extensions/my-extension",
  "type": "folder",
  "hasDependencies": true,
  "capabilities": ["onLoad", "getCommands", "onAgentStarted"]
}
```

### 2. docs-site/docs/extensions/examples.md

Add to the examples table:

```markdown
| [my-extension](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/my-extension/) | Description | `onLoad`, `onAgentStarted` | Folder |
```

## Capabilities List

| Capability | Method | Description |
|------------|--------|-------------|
| `events` | Various `on*` methods | Handle agent/task events |
| `commands` | `getCommands()` | Register slash commands |
| `tools` | `getTools()` | Register AI tools |
| `agents` | `getAgents()` | Register agent profiles |
| `modes` | `getModes()` | Register conversation modes |

### Event Capabilities

- `onLoad` - Extension loaded
- `onAgentStarted` - Agent execution started (modifying)
- `onAgentFinished` - Agent execution finished
- `onToolCalled` - Tool about to execute (blocking)
- `onToolFinished` - Tool finished executing (modifying)
- `onPromptSubmitted` - Prompt submitted (blocking/modifying)
- `onTaskCreated` - Task created

## Common Patterns

### Command with Config Storage

```typescript
// config.ts
export interface MyConfig { setting: number; }
export async function loadConfig(): Promise<MyConfig> { ... }
export async function saveConfig(config: MyConfig): Promise<void> { ... }

// index.ts - in command execute()
const config = await loadConfig();
config.setting = newValue;
await saveConfig(config);
```

### Event Modification

```typescript
async onAgentStarted(event, context): Promise<Partial<AgentStartedEvent>> {
  // Prepend messages
  const newMessage = { id: 'custom', role: 'user', content: '...' };
  return {
    contextMessages: [newMessage, ...event.contextMessages]
  };
}
```

### Prevent Default Behavior

```typescript
return {
  agentProfile: {
    ...event.agentProfile,
    includeRepoMap: false  // Prevent default repo map
  }
};
```

## Folder Extension Requirements

### package.json

```json
{
  "name": "my-extension",
  "version": "1.0.0",
  "main": "index.ts",
  "dependencies": {
    // Required packages
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true
  }
}
```

## Validation Checklist

- [ ] Extension implements `Extension` interface
- [ ] `metadata` export with all required fields
- [ ] `default` export is the class
- [ ] No `@/` imports (use local imports or npm packages)
- [ ] Config files stored in extension directory
- [ ] `extensions.json` updated
- [ ] `docs-site/docs/extensions/examples.md` updated
- [ ] Passes `code-checker` verification

## References

- [packages/extensions/extensions.d.ts]({projectDir}/packages/extensions/extensions.d.ts) - Full Extension interface and types
- [event-types.md](references/event-types.md) - All event types and payloads
- [command-definition.md](references/command-definition.md) - Command structure
- [examples-gallery.md](references/examples-gallery.md) - Real extension examples

## Assets

- [templates/single-file.ts.template](assets/templates/single-file.ts.template) - Single-file template
- [templates/folder-extension.template/](assets/templates/folder-extension.template/) - Folder template
