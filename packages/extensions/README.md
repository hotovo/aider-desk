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

```typescript
import type { Extension, ExtensionContext, ToolDefinition } from '@aiderdesk/extensions';
import { z } from 'zod';

export default class MyExtension implements Extension {
  async onLoad(context: ExtensionContext) {
    context.log('Extension loaded!', 'info');
  }
}
```

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

| Extension | Description | Extension Functions |
|-----------|-------------|---------------------|
| **[theme.ts](./theme.ts)** | Adds `/theme` command to switch AiderDesk themes | `onLoad`, `getCommands` |
| **[sound-notification.ts](./sound-notification.ts)** | Plays a "Jobs Done" sound when a prompt finishes | `onLoad`, `onPromptFinished` |
| **[protected-paths.ts](./protected-paths.ts)** | Blocks file operations on protected paths (`.env`, `.git/`, `node_modules/`) | `onLoad`, `onToolCalled` |
| **[plan-mode.ts](./plan-mode.ts)** | Adds a Plan mode that enforces planning before coding | `onLoad`, `getModes`, `onAgentStarted` |
| **[pirate.ts](./pirate.ts)** | Adds a Pirate agent that speaks like a swashbuckling sea dog | `onLoad`, `getAgents`, `onAgentProfileUpdated` |
| **[permission-gate.ts](./permission-gate.ts)** | Prompts for confirmation before running dangerous bash commands (`rm -rf`, `sudo`, `chmod/chown 777`) | `onLoad`, `onToolCalled` |
| **[generate-tests.ts](./generate-tests.ts)** | Adds `/generate-tests` command to generate unit tests for files | `onLoad`, `getCommands` |
| **[sandbox/](./sandbox/)** | OS-level sandboxing for bash commands using `@anthropic-ai/sandbox-runtime` | `onLoad`, `onUnload`, `onTaskInitialized`, `onTaskClosed`, `onToolCalled` |
| **[rtk/](./rtk/)** | Transparently rewrites shell commands to RTK equivalents, reducing LLM token consumption by 60-90% | `onLoad`, `getCommands`, `onToolCalled` |
| **[chunkhound-search/](./chunkhound-search/)** | Provides `chunkhound-search` tool using ChunkHound for semantic code search | `onLoad`, `onUnload`, `onProjectOpen`, `onToolFinished`, `getTools` |
| **[chunkhound-on-semantic-search-tool/](./chunkhound-on-semantic-search-tool/)** | Overrides `power---semantic_search` to use ChunkHound for better semantic understanding | `onLoad`, `onUnload`, `onProjectOpen`, `onToolCalled`, `onToolFinished` |
| **[wakatime.ts](./wakatime.ts)** | Tracks coding activity by sending heartbeats to WakaTime via wakatime-cli | `onLoad`, `onPromptStarted`, `onPromptFinished`, `onToolFinished`, `onFilesAdded` |
| **[redact-secrets/](./redact-secrets/)** | Redacts secret values from `.env*` files in file read results | `onLoad`, `onProjectOpen`, `onToolFinished` |
| **[external-rules.ts](./external-rules.ts)** | Includes rule files from Cursor, Claude Code, and Roo Code configurations | `onLoad`, `onRuleFilesRetrieved` |
| **[ultrathink.ts](./ultrathink.ts)** | Detects prompts like "ultrathink" / "think hard" and increases OpenAI/OpenAI-compatible reasoning effort (`xhigh` for `-max` models, otherwise `high`) | `onLoad`, `onAgentStarted` |

## Quick Start

### 1. Download Type Definitions

For TypeScript support and autocompletion, download the extension type definitions:

```bash
# Download to your project
curl -o extension-types.d.ts https://raw.githubusercontent.com/hotovo/aider-desk/main/packages/extensions/extensions.d.ts
```

### 2. Install an Extension

Copy the extension file(s) to your AiderDesk extensions directory:

```bash
# Global extensions (available to all projects)
cp sound-notification.ts ~/.aider-desk/extensions/

# Project-specific extensions
cp sound-notification.ts .aider-desk/extensions/
```

### 3. Hot Reload

Extensions are automatically reloaded when files change. No restart needed!
