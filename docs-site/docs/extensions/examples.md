# Examples

This page provides an overview of all available extension examples in the AiderDesk repository. Each example demonstrates different capabilities and patterns you can use in your own extensions.

## All Examples

| Extension | Description | Capabilities | Structure |
|-----------|-------------|--------------|-----------|
| [wakatime.ts](https://github.com/hotovo/aider-desk/blob/main/packages/extensions/extensions/wakatime.ts) | Tracks coding activity by sending heartbeats to WakaTime | `tracking` | Single file |
| [pirate.ts](https://github.com/hotovo/aider-desk/blob/main/packages/extensions/extensions/pirate.ts) | Adds a Pirate agent that speaks like a swashbuckling sea dog | `agents`, `example` | Single file |
| [generate-tests.ts](https://github.com/hotovo/aider-desk/blob/main/packages/extensions/extensions/generate-tests.ts) | Adds `/generate-tests` command to generate unit tests for files | `commands` | Single file |
| [theme.ts](https://github.com/hotovo/aider-desk/blob/main/packages/extensions/extensions/theme.ts) | Adds `/theme` command to switch AiderDesk themes | `commands` | Single file |
| [plan-mode.ts](https://github.com/hotovo/aider-desk/blob/main/packages/extensions/extensions/plan-mode.ts) | Adds a Plan mode that enforces planning before coding | `modes` | Single file |
| [protected-paths.ts](https://github.com/hotovo/aider-desk/blob/main/packages/extensions/extensions/protected-paths.ts) | Blocks file operations on protected paths (`.env`, `.git/`, `node_modules/`) | `security` | Single file |
| [permission-gate.ts](https://github.com/hotovo/aider-desk/blob/main/packages/extensions/extensions/permission-gate.ts) | Prompts for confirmation before running dangerous bash commands | `security` | Single file |
| [ultrathink.ts](https://github.com/hotovo/aider-desk/blob/main/packages/extensions/extensions/ultrathink.ts) | Detects "ultrathink" / "think hard" and increases reasoning effort | `optimization` | Single file |
| [external-rules.ts](https://github.com/hotovo/aider-desk/blob/main/packages/extensions/extensions/external-rules.ts) | Includes rule files from Cursor, Claude Code, and Roo Code | `context` | Single file |
| [sound-notification.ts](https://github.com/hotovo/aider-desk/blob/main/packages/extensions/extensions/sound-notification.ts) | Plays a "Jobs Done" sound when a prompt finishes | `notifications` | Single file |
| [sandbox](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/sandbox/) | OS-level sandboxing for bash commands using `@anthropic-ai/sandbox-runtime` | `security` | Folder |
| [rtk](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/rtk/) | Rewrites shell commands to RTK equivalents, reducing token usage by 60-90% | `optimization`, `commands` | Folder |
| [redact-secrets](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/redact-secrets/) | Redacts secret values from `.env*` files in file read results | `security` | Folder |
| [chunkhound-search](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/chunkhound-search/) | Provides `chunkhound-search` tool for semantic code search | `search`, `tools` | Folder |
| [chunkhound-on-semantic-search-tool](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/chunkhound-on-semantic-search-tool/) | Overrides `power---semantic_search` to use ChunkHound | `search` | Folder |
| [tree-sitter-repo-map](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/tree-sitter-repo-map/) | Enhanced repository map using tree-sitter parsing with PageRank-based symbol ranking | `context`, `commands` | Folder |
| [tps-counter](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/tps-counter/) | Displays tokens per second for agent responses with UI components in usage info and message bar | `metrics`, `ui` | Folder |
| [programmatic-tool-calls](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/programmatic-tool-calls/) | Execute JavaScript code in a sandbox with access to all tools as async functions | `tools` | Folder |
| [lsp](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/lsp/) | Language Server Protocol integration for code intelligence | `tools`, `code-intelligence` | Folder |
| [context-autocompletion-words](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/context-autocompletion-words/) | Adds custom words to context file autocompletion | `context` | Folder |
| [plannotator](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/plannotator/) | Comprehensive planning assistant with structured plan files | `modes`, `tools`, `commands`, `workflow` | Folder |
| [ui-placement-demo.ts](https://github.com/hotovo/aider-desk/blob/main/packages/extensions/extensions/ui-placement-demo.ts) | Demonstrates all available UI component placement locations | `ui`, `example` | Single file |
| [active-files-counter.ts](https://github.com/hotovo/aider-desk/blob/main/packages/extensions/extensions/active-files-counter.ts) | Displays context file count in status bar with tooltip | `ui`, `events` | Single file |
| [multi-model-run](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/multi-model-run/) | Run the same prompt across multiple models simultaneously | `ui` | Folder |

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

- **ui-placement-demo.ts** - Simple demo showing all placements with static chips
- **active-files-counter.ts** - Simple UI component with data loading and tooltip
- **multi-model-run** - Complex example with state management, data loading, and action handling

---

## Using Examples

### Install via CLI (Recommended)

The easiest way to install example extensions is using the CLI tool:

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

Alternatively, you can manually download examples:

#### Single-File Example

```bash
# Download to global extensions
curl -o ~/.aider-desk/extensions/sound-notification.ts \
  https://raw.githubusercontent.com/hotovo/aider-desk/main/packages/extensions/extensions/sound-notification.ts
```

#### Folder-Based Example

```bash
# Clone and copy
git clone --depth 1 https://github.com/hotovo/aider-desk temp-aider
cp -r temp-aider/packages/extensions/extensions/sandbox ~/.aider-desk/extensions/
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
