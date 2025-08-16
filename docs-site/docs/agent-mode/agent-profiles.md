---
sidebar_label: "Agent Profiles"
---

# Agent Profiles

Agent Profiles are the core of configuring the agent's behavior. You can create multiple profiles for different workflows (e.g., a "Code Analysis" profile that only reads files, or a "Refactoring" profile with full file write access).

You can manage profiles in **Settings > Agent**.

## Pre-defined Profiles

AiderDesk comes with three pre-configured profiles that showcase different capabilities:

### Power Tools

This profile gives the agent direct file system access for analysis and modification—tools you might know from other AI agentic applications. It's ideal for:

- Quick file operations and modifications
- Code analysis and search
- System commands and automation
- Tasks that don't require full codebase context management

### Aider

This profile leverages Aider's powerful code generation and modification capabilities as a tool for the agent. It's perfect for:

- Complex refactoring tasks
- Multi-file code changes
- Maintaining code consistency across large codebases
- Tasks that benefit from Aider's deep understanding of project context

### Aider with Power Search

This profile combines the best of both worlds—it offers the search capabilities of Power Tools and uses Aider for the heavy lifting of code generation. It's excellent for:

- Finding and understanding existing code patterns
- Making targeted changes to specific parts of the codebase
- Tasks that require both discovery and modification
- Working with large, unfamiliar codebases

## Profile Configuration

Each agent profile is fully configurable to your needs. You can customize:

### Parameters

- **Temperature**: Controls the randomness of the AI's responses (0.0 for deterministic, 1.0 for creative)
- **Max Iterations**: The maximum number of thinking/acting cycles the agent can perform for a single prompt. This prevents infinite loops and controls costs.
- **Max Tokens**: The maximum number of tokens the agent can use per response.
- **Min Time Between Tool Calls**: A delay (in milliseconds) to prevent rate-limiting issues with external APIs.

### Context Settings

- **Include Context Files**: If checked, the content of all files in Aider's context will be included in the agent's system prompt.
- **Include Repository Map**: If checked, the Aider-generated repository map will be included, giving the agent a high-level understanding of the project structure.

### Tool Groups

- **Use Power Tools**: Enables built-in tools for file system access, shell commands, and sub-agent delegation.
- **Use Aider Tools**: Allows the agent to interact with the underlying Aider instance (e.g., add/drop files, run prompts).
- **Use Todo Tools**: Enables the agent to manage a persistent to-do list for the project.

### Rules & Instructions

- **Custom Instructions**: A free-text area to provide specific, persistent instructions to the agent for this profile.

### MCP Servers

You can extend the agent's capabilities by connecting to external tools via the Model Context Protocol (MCP). By adding an MCP server, you can grant your agent entirely new skills like web browsing, database access, or integration with custom services.

Learn more about configuring MCP servers in the [MCP Servers](./mcp-servers.md) section.

### Tool Control & Approvals

You are always in the driver's seat. For every tool, you can decide if the agent can use it automatically, never use it, or must ask for your permission every single time. This ensures the agent works with you, maintaining a perfect balance of automation and control.

- **Individual Tool Approvals**: Set approval levels for each tool and MCP server tool:
  - **Ask**: Prompt for approval each time (default)
  - **Always**: Auto-approve without prompting
  - **Never**: Disable the tool completely

### Best Practices

1. **Create specialized profiles** for different types of tasks:
   - Analysis-only profiles for code review
   - Full-access profiles for development work
   - Limited-access profiles for safety-critical projects

2. **Use descriptive names** to quickly identify the right profile for your task.

3. **Start with conservative approval settings** and adjust as you gain trust in the agent's behavior.

4. **Regularly review and update** your profiles as your project needs evolve.

5. **Test new profiles** on non-critical tasks before using them for important work.
