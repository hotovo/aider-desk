# Examples

This page provides an overview of all available extension examples in the AiderDesk repository. Each example demonstrates different capabilities and patterns you can use in your own extensions.

## All Examples

| Extension | Description | Capabilities | Structure |
|-----------|-------------|--------------|-----------|
| [wakatime.ts](https://github.com/hotovo/aider-desk/blob/main/packages/extensions/wakatime.ts) | Tracks coding activity by sending heartbeats to WakaTime | `onLoad`, `onPromptStarted`, `onPromptFinished`, `onToolFinished`, `onFilesAdded` | Single file |
| [pirate.ts](https://github.com/hotovo/aider-desk/blob/main/packages/extensions/pirate.ts) | Adds a Pirate agent that speaks like a swashbuckling sea dog | `onLoad`, `getAgents`, `onAgentProfileUpdated` | Single file |
| [generate-tests.ts](https://github.com/hotovo/aider-desk/blob/main/packages/extensions/generate-tests.ts) | Adds `/generate-tests` command to generate unit tests for files | `onLoad`, `getCommands` | Single file |
| [theme.ts](https://github.com/hotovo/aider-desk/blob/main/packages/extensions/theme.ts) | Adds `/theme` command to switch AiderDesk themes | `onLoad`, `getCommands` | Single file |
| [plan-mode.ts](https://github.com/hotovo/aider-desk/blob/main/packages/extensions/plan-mode.ts) | Adds a Plan mode that enforces planning before coding | `onLoad`, `getModes`, `onAgentStarted` | Single file |
| [protected-paths.ts](https://github.com/hotovo/aider-desk/blob/main/packages/extensions/protected-paths.ts) | Blocks file operations on protected paths (`.env`, `.git/`, `node_modules/`) | `onLoad`, `onToolCalled` | Single file |
| [permission-gate.ts](https://github.com/hotovo/aider-desk/blob/main/packages/extensions/permission-gate.ts) | Prompts for confirmation before running dangerous bash commands | `onLoad`, `onToolCalled` | Single file |
| [ultrathink.ts](https://github.com/hotovo/aider-desk/blob/main/packages/extensions/ultrathink.ts) | Detects "ultrathink" / "think hard" and increases reasoning effort | `onLoad`, `onAgentStarted` | Single file |
| [external-rules.ts](https://github.com/hotovo/aider-desk/blob/main/packages/extensions/external-rules.ts) | Includes rule files from Cursor, Claude Code, and Roo Code | `onLoad`, `onRuleFilesRetrieved` | Single file |
| [sound-notification.ts](https://github.com/hotovo/aider-desk/blob/main/packages/extensions/sound-notification.ts) | Plays a "Jobs Done" sound when a prompt finishes | `onLoad`, `onPromptFinished` | Single file |
| [sandbox](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/sandbox/) | OS-level sandboxing for bash commands using `@anthropic-ai/sandbox-runtime` | `onLoad`, `onUnload`, `onTaskInitialized`, `onTaskClosed`, `onToolCalled` | Folder |
| [rtk](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/rtk/) | Rewrites shell commands to RTK equivalents, reducing token usage by 60-90% | `onLoad`, `getCommands`, `onToolCalled` | Folder |
| [redact-secrets](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/redact-secrets/) | Redacts secret values from `.env*` files in file read results | `onLoad`, `onProjectOpen`, `onToolFinished` | Folder |
| [chunkhound-search](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/chunkhound-search/) | Provides `chunkhound-search` tool for semantic code search | `onLoad`, `onUnload`, `onProjectOpen`, `onToolFinished`, `getTools` | Folder |
| [chunkhound-on-semantic-search-tool](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/chunkhound-on-semantic-search-tool/) | Overrides `power---semantic_search` to use ChunkHound | `onLoad`, `onUnload`, `onProjectOpen`, `onToolCalled`, `onToolFinished` | Folder |

---

## Using Examples

### Download a Single-File Example

```bash
# Download to global extensions
curl -o ~/.aider-desk/extensions/sound-notification.ts \
  https://raw.githubusercontent.com/hotovo/aider-desk/main/packages/extensions/sound-notification.ts
```

### Clone a Folder Example

```bash
# Clone and copy
git clone --depth 1 https://github.com/hotovo/aider-desk temp-aider
cp -r temp-aider/packages/extensions/sandbox ~/.aider-desk/extensions/
cd ~/.aider-desk/extensions/sandbox
npm install
rm -rf temp-aider
```

### Use as Template

Copy an example that matches your needs and modify it:

1. Choose an example with similar capabilities
2. Copy it to your extensions directory
3. Modify the class name and implementation
4. Update the metadata
5. Save and test (hot reload applies changes automatically)
