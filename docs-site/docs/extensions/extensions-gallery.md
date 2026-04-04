# Extensions Gallery

This page provides an overview of all available extensions in the AiderDesk repository. Each extension demonstrates different capabilities and patterns you can use as reference when building your own extensions.

## Production Extensions

Ready-to-use extensions that add functionality to AiderDesk.

| Extension | Description | API Usage |
|-----------|-------------|-----------|
| [bmad](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/bmad/) | BMAD Method workflows for planning, designing, and implementing software projects | `onLoad`, `getModes`, `getUIComponents`, `onTaskUpdated`, `onAgentStarted`, `onToolApproval`, `triggerUIComponentsReload` |
| [questions](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/questions/) | Extracts questions from messages and displays as interactive questionnaire | `onLoad`, `onUnload`, `getCommands`, `getUIComponents`, `getUIExtensionData`, `TaskContext.getContextMessages`, `TaskContext.generateText` |
| [wakatime.ts](https://github.com/hotovo/aider-desk/blob/main/packages/extensions/extensions/wakatime.ts) | Tracks coding activity by sending heartbeats to WakaTime | `onLoad`, `onPromptStarted`, `onPromptFinished`, `onToolFinished`, `onFilesAdded` |
| [protected-paths.ts](https://github.com/hotovo/aider-desk/blob/main/packages/extensions/extensions/protected-paths.ts) | Blocks file operations on protected paths (`.env`, `.git/`, `node_modules/`) | `onLoad`, `onToolCalled` |
| [permission-gate.ts](https://github.com/hotovo/aider-desk/blob/main/packages/extensions/extensions/permission-gate.ts) | Prompts for confirmation before running dangerous bash commands | `onLoad`, `onToolCalled`, `TaskContext.askQuestion` |
| [ultrathink.ts](https://github.com/hotovo/aider-desk/blob/main/packages/extensions/extensions/ultrathink.ts) | Detects "ultrathink" / "think hard" and increases reasoning effort | `onLoad`, `onAgentStarted` |
| [external-rules.ts](https://github.com/hotovo/aider-desk/blob/main/packages/extensions/extensions/external-rules.ts) | Includes rule files from Cursor, Claude Code, and Roo Code | `onLoad`, `onRuleFilesRetrieved` |
| [sound-notification.ts](https://github.com/hotovo/aider-desk/blob/main/packages/extensions/extensions/sound-notification.ts) | Plays a "Jobs Done" sound when a prompt finishes | `onLoad`, `onPromptFinished` |
| [sandbox](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/sandbox/) | OS-level sandboxing for bash commands using `@anthropic-ai/sandbox-runtime` | `onLoad`, `onToolCalled` |
| [rtk](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/rtk/) | Rewrites shell commands to RTK equivalents, reducing token usage by 60-90% | `onLoad`, `getCommands`, `onToolCalled` |
| [redact-secrets](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/redact-secrets/) | Redacts secret values from `.env*` files in file read results | `onToolFinished` |
| [chunkhound-search](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/chunkhound-search/) | Provides `chunkhound-search` tool for semantic code search | `getTools`, `onProjectStarted`, `onToolFinished` |
| [fff](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/fff/) | Fast file content search using FFF (Freakin Fast File Finder) — replaces the internal grep tool | `onLoad`, `onUnload`, `onProjectStarted`, `getTools` |
| [seek](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/seek/) | Fast ranked code search using seek (zoekt) — replaces the internal grep tool | `onLoad`, `onUnload`, `getTools`, `onProjectStarted` |
| [tree-sitter-repo-map](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/tree-sitter-repo-map/) | Enhanced repository map using tree-sitter parsing with PageRank-based symbol ranking | `onLoad`, `getCommands`, `onAgentStarted` |
| [tps-counter](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/tps-counter/) | Displays tokens per second for agent responses with UI components in usage info and message bar | `onLoad`, `onUnload`, `onResponseChunk`, `onResponseCompleted`, `getUIComponents`, `getUIExtensionData`, `getCommands`, `triggerUIDataRefresh` |
| [programmatic-tool-calls](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/programmatic-tool-calls/) | Execute JavaScript code in a sandbox with access to all tools as async functions | `getTools` |
| [lsp](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/lsp/) | Language Server Protocol integration for code intelligence | `onLoad`, `onUnload`, `getTools`, `onToolFinished`, `onProjectStarted`, `onProjectStopped` |
| [context-autocompletion-words](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/context-autocompletion-words/) | Adds custom words to context file autocompletion | `onLoad`, `onFilesAdded`, `onFilesDropped`, `TaskContext.getContextFiles`, `TaskContext.updateAutocompletionWords` |
| [plannotator](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/plannotator/) | Comprehensive planning assistant with structured plan files | `onLoad`, `onUnload`, `getModes`, `getTools`, `getCommands`, `onToolCalled`, `onToolApproval`, `onAgentStarted`, `onAgentFinished`, `onTaskInitialized`, `onTaskClosed`, `onImportantReminders` |
| [multi-model-run](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/multi-model-run/) | Run the same prompt across multiple models simultaneously | `onLoad`, `getUIComponents`, `getUIExtensionData`, `executeUIExtensionAction`, `onPromptStarted`, `ProjectContext.duplicateTask`, `ProjectContext.getTask`, `TaskContext.runPrompt` |

---

## Learning Examples

Simple extensions designed for learning the extension API patterns.

| Extension | Description | API Usage |
|-----------|-------------|-----------|
| [pirate.ts](https://github.com/hotovo/aider-desk/blob/main/packages/extensions/extensions/pirate.ts) | Adds a Pirate agent that speaks like a swashbuckling sea dog | `onLoad`, `getAgents`, `onAgentProfileUpdated` |
| [ui-placement-demo.ts](https://github.com/hotovo/aider-desk/blob/main/packages/extensions/extensions/ui-placement-demo.ts) | Demonstrates all available UI component placement locations | `onLoad`, `getUIComponents` |
| [chunkhound-on-semantic-search-tool](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/chunkhound-on-semantic-search-tool/) | Overrides `power---semantic_search` to use ChunkHound | `onToolCalled`, `onToolFinished`, `onProjectStarted` |
| [theme.ts](https://github.com/hotovo/aider-desk/blob/main/packages/extensions/extensions/theme.ts) | Adds `/theme` command to switch AiderDesk themes | `onLoad`, `getCommands`, `ExtensionContext.updateSettings` |
| [generate-tests.ts](https://github.com/hotovo/aider-desk/blob/main/packages/extensions/extensions/generate-tests.ts) | Adds `/generate-tests` command to generate unit tests for files | `onLoad`, `getCommands`, `TaskContext.runPrompt` |
| [plan-mode.ts](https://github.com/hotovo/aider-desk/blob/main/packages/extensions/extensions/plan-mode.ts) | Adds a Plan mode that enforces planning before coding | `onLoad`, `getModes`, `onAgentStarted` |
---

## UI Components

Extensions can render custom React components in various locations throughout the AiderDesk interface.

### Finding the Right Placement

To determine the best placement for your UI component:

1. Install the **ui-placement-demo** extension to see all available placements in action
2. Each placement is shown with a chip indicating its location name
3. Choose the placement that best fits your component's purpose

<img src="./images/ui-placements-demo.png" alt="UI Placement Demo Extension" width="800" />

```bash
# Install the placement demo extension
npx @aiderdesk/extensions install ui-placement-demo
```

### UI Component Examples

- **ui-placement-demo.ts** - Simple demo showing all placements with static chips (`getUIComponents`)
- **active-files-counter.ts** - Simple UI component with data loading and tooltip (`getUIComponents`, `getUIExtensionData`)
- **tps-counter** - UI with event tracking and data refresh (`getUIComponents`, `getUIExtensionData`, `onResponseChunk`, `onResponseCompleted`, `triggerUIDataRefresh`)
- **multi-model-run** - Complex example with state management, data loading, and action handling (`getUIComponents`, `getUIExtensionData`, `executeUIExtensionAction`)

---

## Installing Extensions

### Install via CLI (Recommended)

The easiest way to install extensions is using the CLI tool:

```bash
# Interactive selection - choose from all available extensions
npx @aiderdesk/extensions install

# Install a specific extension by ID
npx @aiderdesk/extensions install sound-notification
npx @aiderdesk/extensions install pirate --global

# Install to global extensions (available to all projects)
npx @aiderdesk/extensions install --global

# List all available extensions
npx @aiderdesk/extensions list
```

The CLI automatically handles:
- Downloading single-file extensions
- Cloning and setting up folder-based extensions
- Installing dependencies for folder extensions
- Both global and project-level installation

### Manual Download

Alternatively, you can manually download extensions:

#### Single-File Extension

```bash
# Download to global extensions
curl -o ~/.aider-desk/extensions/sound-notification.ts \
  https://raw.githubusercontent.com/hotovo/aider-desk/main/packages/extensions/extensions/sound-notification.ts
```

#### Folder-Based Extension

```bash
# Clone and copy
git clone --depth 1 https://github.com/hotovo/aider-desk temp-aider
cp -r temp-aider/packages/extensions/extensions/sandbox ~/.aider-desk/extensions/
cd ~/.aider-desk/extensions/sandbox
npm install
rm -rf temp-aider
```

### Use as Template

Copy an extension that matches your needs and modify it:

1. Choose an extension with similar capabilities
2. Copy it to your extensions directory
3. Modify the class name and implementation
4. Update the metadata
5. Save and test (hot reload applies changes automatically)
