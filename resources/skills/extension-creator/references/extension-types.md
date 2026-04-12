# Extension Types

AiderDesk supports two types of extensions: single-file and folder extensions.

## Single-File Extensions

**When to use:** Simple extensions with no npm dependencies

**Location:** `packages/extensions/extensions/my-extension.ts`

**Structure:**
```typescript
import type { Extension, ExtensionContext } from '@aiderdesk/extensions';

export default class MyExtension implements Extension {
  static metadata = {
    name: 'My Extension',
    version: '1.0.0',
    description: 'What this extension does',
    author: 'Author Name',
    capabilities: ['events', 'commands'],
  };

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('Extension loaded', 'info');
  }
}
```

**Advantages:**
- Simple structure
- Easy to maintain
- No build step required

**Limitations:**
- Cannot use npm dependencies
- All code in one file
- No separate config or logger files

## Folder Extensions

**When to use:** Complex extensions with npm dependencies or multiple files

**Location:** `packages/extensions/extensions/my-extension/`

**Structure:**
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

**package.json:**
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

**tsconfig.json:**
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

**Advantages:**
- Can use npm dependencies
- Modular structure
- Separate config and logger files
- Can include resources (WASM, queries, assets)

**Requirements:**
- Must have package.json
- Must have tsconfig.json with ES2020+ module
- Must set `hasDependencies: true` in extensions.json

## Choosing Extension Type

**When:** Extension needs npm packages

**Then:** Use folder extension

**When:** Extension is simple with no dependencies

**Then:** Use single-file extension

**When:** Extension needs multiple files

**Then:** Use folder extension

**When:** Extension needs resources (WASM, queries)

**Then:** Use folder extension

## Common Patterns by Type

### Single-File: Simple Event Handler

```typescript
import type { Extension, ExtensionContext, AgentStartedEvent } from '@aiderdesk/extensions';

export default class SimpleExtension implements Extension {
  static metadata = {
    name: 'Simple Extension',
    version: '1.0.0',
    description: 'Simple event handler',
    author: 'Author Name',
    capabilities: ['events'],
  };

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('Simple extension loaded', 'info');
  }

  async onAgentStarted(
    event: AgentStartedEvent,
    context: ExtensionContext
  ): Promise<void | Partial<AgentStartedEvent>> {
    context.log('Agent started', 'info');
    return { contextMessages: [...event.contextMessages] };
  }
}
```

### Folder: Extension with Config and Dependencies

```
tree-sitter-repo-map/
├── index.ts           # Main extension with getTools()
├── package.json       # tree-sitter dependencies
├── tsconfig.json      # ES2020 module
├── config.ts          # Config storage
├── logger.ts          # Extension logger
├── constants.ts       # Extension constants
└── resources/
    └── queries/       # Language queries
```

## Updating extensions.json

### Single-File Entry

```json
{
  "id": "my-extension",
  "name": "My Extension",
  "description": "Description of what it does",
  "file": "extensions/my-extension.ts",
  "type": "single",
  "capabilities": ["onLoad", "onAgentStarted"]
}
```

### Folder Entry

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

**Note:** Always set `hasDependencies: true` for folder extensions, even if they don't have dependencies yet. This ensures proper loading.
