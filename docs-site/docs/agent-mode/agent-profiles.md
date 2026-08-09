---
sidebar_label: "Agent Profiles"
---

# Agent Profiles

Agent Profiles are the core of configuring the agent's behavior. You can create multiple profiles for different workflows (e.g., a "Code Analysis" profile that only reads files, or a "Refactoring" profile with full file write access).

## File-Based Storage

Agent profiles are now stored as files, making them easy to share, backup, and version control. There are two levels of profile storage:

### Global Profiles
Stored in `~/.aider-desk/agents/`, these profiles are available across all projects.

### Project-Level Profiles
Stored in `$projectDir/.aider-desk/agents/`, these profiles are specific to individual projects and override global profiles when working within that project.

### Profile Directory Structure

Each agent profile is stored as a directory with the following structure:

```
profile-name/
├── config.json          # Profile configuration
└── rules/               # Additional rule files (optional)
    ├── coding-standards.md
    ├── architecture.md
    └── custom-instructions.md
```

- **config.json**: Contains the profile settings (parameters, tool approvals, etc.)
- **rules/**: Optional directory containing markdown files with additional rules and instructions for this specific agent

You can manage profiles in **Settings > Agent**, or directly edit the files for advanced customization.

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

Agent profiles can include custom rules and instructions from multiple sources:

- **Custom Instructions**: A free-text area to provide specific, persistent instructions to the agent for this profile.
- **Agent-Specific Rule Files**: Markdown files placed in the agent's `rules/` directory are automatically included as additional instructions. This allows you to create detailed, structured rules for specific agent behaviors.
- **Project-Level Rules**: When using project-level profiles, rules from both the project's `.aider-desk/rules/` directory and the agent's own `rules/` directory are included.
- **Global Rule Inheritance**: Project-level profiles automatically inherit rules from global profiles with the same ID, allowing you to extend base profiles with project-specific customizations.

#### Rule File Best Practices

- Use descriptive filenames (e.g., `coding-standards.md`, `api-patterns.md`)
- Structure rules with clear headings and bullet points
- Include both "do's" and "don'ts" for clarity
- Keep rules focused and specific to the agent's intended purpose
- Use markdown formatting for better readability

### MCP Servers

You can extend the agent's capabilities by connecting to external tools via the Model Context Protocol (MCP). By adding an MCP server, you can grant your agent entirely new skills like web browsing, database access, or integration with custom services.

Configure your MCP servers in **Settings > MCP Servers** and then enable them for each profile below. Learn more about configuring MCP servers in the [MCP Servers](./mcp-servers.md) section.

### Tool Control & Approvals

You are always in the driver's seat. For every tool, you can decide if the agent can use it automatically, never use it, or must ask for your permission every single time. This ensures the agent works with you, maintaining a perfect balance of automation and control.

- **Individual Tool Approvals**: Set approval levels for each tool and MCP server tool:
  - **Ask**: Prompt for approval each time (default)
  - **Always**: Auto-approve without prompting
  - **Never**: Disable the tool completely

### Subagent Configuration

Any agent profile can be configured to act as a subagent—a specialized AI assistant that can be delegated specific tasks by other agents. This enables you to create specialized experts for particular types of work.

When editing an agent profile, you can enable the **"Enable as Subagent"** option, which reveals additional subagent-specific settings:

- **System Prompt**: Define the specialized behavior and expertise of this subagent
- **Invocation Mode**: Choose whether the subagent runs automatically or only when explicitly requested
- **Color**: Select a visual identifier for the subagent in the interface
- **Description**: For automatic subagents, describe when this subagent should be used

Subagents can be used by any agent profile that has **"Use Subagents"** enabled in their tool groups. This allows for flexible delegation of tasks to specialized AI assistants.

Learn more about creating, configuring, and using subagents in the [Subagents](./subagents.md) documentation.

### File Management

#### Profile Sharing
Since profiles are stored as files, you can easily:
- **Share profiles** by copying the profile directory between machines or users
- **Version control** profiles by committing them to your repository (especially project-level profiles)
- **Backup profiles** by copying the `~/.aider-desk/agents/` directory

#### Profile Ordering
Profile order is maintained via `order.json` files in both global and project agent directories. The Settings interface automatically updates these files when you reorder profiles.

#### Real-time Updates
AiderDesk automatically watches for changes to profile files and reloads them in real-time. You can:
- Edit `config.json` directly to modify profile settings
- Add/remove rule files in the `rules/` directory
- Changes are applied immediately without restarting the application

### Best Practices

1. **Create specialized profiles** for different types of tasks:
   - Analysis-only profiles for code review
   - Full-access profiles for development work
   - Limited-access profiles for safety-critical projects

2. **Use descriptive names** to quickly identify the right profile for your task.

3. **Start with conservative approval settings** and adjust as you gain trust in the agent's behavior.

4. **Regularly review and update** your profiles as your project needs evolve.

5. **Test new profiles** on non-critical tasks before using them for important work.

6. **Leverage file-based storage** for team collaboration:
   - Commit project-level profiles to version control
   - Share global profiles with team members
   - Create profile templates for common workflows

7. **Organize rule files effectively**:
   - Use separate markdown files for different aspects (coding standards, architecture, etc.)
   - Keep rule files focused and maintainable
   - Use consistent naming conventions across profiles
