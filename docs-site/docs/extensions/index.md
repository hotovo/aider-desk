# Extensions

Extensions allow you to extend and customize AiderDesk's functionality. They can add new tools, commands, modes, agent profiles, and react to various events in the application lifecycle.

## What Extensions Can Do

### Register New Capabilities

- **Tools** - Add custom tools that the AI can use (e.g., run linters, execute scripts, query databases)
- **Commands** - Create slash commands like `/generate-tests` or `/deploy`
- **Modes** - Define custom chat modes with specific behaviors
- **Agent Profiles** - Create specialized agents with custom instructions and settings
- **UI Components** - Render custom React components in various locations throughout the interface


### Hook into Events

Extensions can listen to and modify events throughout AiderDesk:

- **Task Events** - Task creation, initialization, updates, and closure
- **Agent Events** - Agent execution start, finish, and step completion
- **Tool Events** - Tool approval, execution, and completion
- **File Events** - Files added to or dropped from context
- **Prompt Events** - Prompt submission and processing
- **Prompt Template Events** - Customize prompt templates before rendering
- **Response Events** - Response chunks and completion
- **And more...**

### Modify Behavior

Many events allow extensions to modify data before it's processed:

- Block dangerous operations (e.g., prevent `rm -rf` commands)
- Transform prompts before sending to the AI
- Filter files being added to context
- Auto-answer approval requests
- Modify AI responses

## Extension Locations

Extensions can be installed at two levels:

| Level | Path | Scope |
|-------|------|-------|
| **Global** | `~/.aider-desk/extensions/` | Available to all projects |
| **Project** | `./.aider-desk/extensions/` | Only for the current project |

Project-level extensions can override global extensions with the same name.

## Hot Reload

Extensions are **automatically reloaded** when changes are detected. There's no need to restart AiderDesk when developing or modifying extensions. Just save your file and the changes take effect within seconds.

## Getting Started

1. [Create an Extension](./creating-extensions.md) - Learn how to build your first extension
2. [Installation Guide](./installation.md) - Install extensions via CLI or manually
3. [API Reference](./api-reference.md) - Complete API documentation
4. [Events Reference](./events.md) - All available events and their properties
5. [Extension Gallery](./extensions-gallery.md) - Browse example extensions for inspiration and check out production-ready extensions

## Quick Install

The fastest way to install extensions is using the CLI:

```bash
# Interactive installation
npx @aiderdesk/extensions install

# Install specific extension
npx @aiderdesk/extensions install sound-notification --global
```
