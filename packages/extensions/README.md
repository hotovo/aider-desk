# @aiderdesk/extensions

TypeScript type definitions and examples for building [AiderDesk](https://aiderdesk.hotovo.com) extensions.

## Installation

```bash
npm install @aiderdesk/extensions
# or
yarn add @aiderdesk/extensions
# or
pnpm add @aiderdesk/extensions
```

## Usage

Import both types and runtime values from a single entry point:

```typescript
import type { Extension, ExtensionContext, ToolDefinition } from '@aiderdesk/extensions';
import { ToolApprovalState } from '@aiderdesk/extensions';
import { z } from 'zod';

export default class MyExtension implements Extension {
  async onLoad(context: ExtensionContext) {
    context.log('Extension loaded!', 'info');
    
    // Runtime values are available too
    const approval = ToolApprovalState.Always;
  }
}
```

**Note**: The package provides both TypeScript type definitions and runtime JavaScript values (like enum values) from the same entry point. You can use `import type` for type-only imports, or regular imports for runtime values.

## Example Extensions

This directory contains example extensions demonstrating various capabilities of the AiderDesk extension system.

## Documentation

For comprehensive documentation on creating and using extensions, see the [Extensions documentation](https://aiderdesk.hotovo.com/docs/extensions/):

- [Extensions Overview](https://aiderdesk.hotovo.com/docs/extensions/) - What extensions can do
- [Creating Extensions](https://aiderdesk.hotovo.com/docs/extensions/creating-extensions) - How to build extensions
- [Installation Guide](https://aiderdesk.hotovo.com/docs/extensions/installation) - Install extensions globally or per-project
- [API Reference](https://aiderdesk.hotovo.com/docs/extensions/api-reference) - Complete API documentation
- [Events Reference](https://aiderdesk.hotovo.com/docs/extensions/events) - All available events
- [Examples Gallery](https://aiderdesk.hotovo.com/docs/extensions/examples) - Browse all examples

## Example Extensions

| Extension | Description | Capabilities |
|-----------|-------------|--------------|
| **[chunkhound-on-semantic-search-tool/](./extensions/chunkhound-on-semantic-search-tool/)** | Overrides `power---semantic_search` to use ChunkHound for better semantic understanding | `search` |
| **[chunkhound-search/](./extensions/chunkhound-search/)** | Provides `chunkhound-search` tool using ChunkHound for semantic code search | `search`, `tools` |
| **[context-autocompletion-words/](./extensions/context-autocompletion-words/)** | Automatically extracts symbols from context files and adds them to autocompletion | `context` |
| **[external-rules.ts](./extensions/external-rules.ts)** | Includes rule files from Cursor, Claude Code, and Roo Code configurations | `context` |
| **[generate-tests.ts](./extensions/generate-tests.ts)** | Adds `/generate-tests` command to generate unit tests for files | `commands` |
| **[lsp/](./extensions/lsp/)** | LSP integration for automatic error detection after file edits and code intelligence tools (find references) | `tools`, `code-intelligence` |
| **[permission-gate.ts](./extensions/permission-gate.ts)** | Prompts for confirmation before running dangerous bash commands (`rm -rf`, `sudo`, `chmod/chown 777`) | `security` |
| **[pirate.ts](./extensions/pirate.ts)** | Adds a Pirate agent that speaks like a swashbuckling sea dog | `agents`, `example` |
| **[plan-mode.ts](./extensions/plan-mode.ts)** | Adds a Plan mode that enforces planning before coding | `modes` |
| **[plannotator/](./extensions/plannotator/)** | Plan-based development workflow with planning mode and plan review utilizing plannotator.ai | `modes`, `tools`, `commands`, `workflow` |
| **[programmatic-tool-calls/](./extensions/programmatic-tool-calls/)** | Execute JavaScript code in a sandbox with access to all tools as async functions | `tools` |
| **[protected-paths.ts](./extensions/protected-paths.ts)** | Blocks file operations on protected paths (`.env`, `.git/`, `node_modules/`) | `security` |
| **[providers-quota-extension/](./extensions/providers-quota-extension/)** | Displays API quota information for Synthetic and Z.AI providers in the task status bar | `ui` |
| **[redact-secrets/](./extensions/redact-secrets/)** | Redacts secret values from `.env*` files in file read results | `security` |
| **[rtk/](./extensions/rtk/)** | Transparently rewrites shell commands to RTK equivalents, reducing LLM token consumption by 60-90% | `optimization`, `commands` |
| **[sandbox/](./extensions/sandbox/)** | OS-level sandboxing for bash commands using `@anthropic-ai/sandbox-runtime` | `security` |
| **[sound-notification.ts](./extensions/sound-notification.ts)** | Plays a "Jobs Done" sound when a prompt finishes | `notifications` |
| **[theme.ts](./extensions/theme.ts)** | Adds `/theme` command to switch AiderDesk themes | `commands` |
| **[tree-sitter-repo-map/](./extensions/tree-sitter-repo-map/)** | Enhanced repository map using tree-sitter parsing with PageRank-based symbol ranking | `context`, `commands` |
| **[ultrathink.ts](./extensions/ultrathink.ts)** | Detects prompts like "ultrathink" / "think hard" and increases OpenAI/OpenAI-compatible reasoning effort (`xhigh` for `-max` models, otherwise `high`) | `optimization` |
| **[wakatime.ts](./extensions/wakatime.ts)** | Tracks coding activity by sending heartbeats to WakaTime via wakatime-cli | `tracking` |
| **[ui-placement-demo.ts](./extensions/ui-placement-demo.ts)** | Demonstrates all available UI component placement locations for extension development | `ui`, `example` |
| **[multi-model-run/](./extensions/multi-model-run/)** | Run the same prompt across multiple models simultaneously with a UI selector | `ui` |

## Quick Start

### 1. Install an Extension

The easiest way to install extensions is using the CLI:

```bash
# Interactive selection - choose from all available extensions
npx @aiderdesk/extensions install

# Install a specific extension by ID
npx @aiderdesk/extensions install sound-notification

# Install to global extensions (available to all projects)
npx @aiderdesk/extensions install sound-notification --global

# Install from a URL (e.g., your own repository)
npx @aiderdesk/extensions install https://raw.githubusercontent.com/username/my-extension/main/my-extension.ts
```

Alternatively, manually copy extension files:

```bash
# Global extensions (available to all projects)
cp extensions/sound-notification.ts ~/.aider-desk/extensions/

# Project-specific extensions
cp extensions/sound-notification.ts .aider-desk/extensions/
```

### 2. Hot Reload

Extensions are automatically reloaded when files change. No restart needed!
