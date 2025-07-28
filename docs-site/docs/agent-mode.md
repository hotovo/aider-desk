---
sidebar_position: 9
title: "Agent Mode"
sidebar_label: "Agent Mode"
---

# Agent Mode

Agent Mode in AiderDesk transforms the application into a powerful, autonomous assistant capable of handling complex software engineering tasks. Powered by the Vercel AI SDK, the agent can plan, reason, and utilize a suite of tools to achieve its goals with minimal human intervention.

## Key Capabilities

- **Autonomous Task Execution**: The agent can break down a high-level request (e.g., "refactor the authentication logic") into a series of concrete steps.
- **Tool Utilization**: It can use a wide range of tools, including built-in Power Tools for file system operations, Aider Tools for code manipulation, and external tools via MCP Servers.
- **Configurable Profiles**: Tailor the agent's behavior, capabilities, and LLM settings for different tasks using Agent Profiles.
- **Transparent Operation**: Observe the agent's thought process, the tools it chooses, and the results of its actions directly in the chat interface.

## How to Use Agent Mode

You can switch to Agent Mode in two ways:
1.  **UI Selector**: Click on the mode selector in the prompt field area and choose "Agent".
2.  **Command**: Type `/agent` in the prompt field. Any text following the command will be used as the initial prompt for the agent.

Once in Agent Mode, simply provide a high-level prompt describing the task you want the agent to accomplish.

## Agent Profiles

Agent Profiles are the core of configuring the agent's behavior. You can create multiple profiles for different workflows (e.g., a "Code Analysis" profile that only reads files, or a "Refactoring" profile with full file write access).

You can manage profiles in **Settings > Agent**.

### Profile Settings

Each profile contains the following settings:

- **Name**: A descriptive name for the profile.
- **Provider & Model**: The LLM provider and specific model the agent will use.
- **Parameters**:
    - **Temperature**: Controls the randomness of the AI's responses (0.0 for deterministic, 1.0 for creative).
    - **Max Iterations**: The maximum number of thinking/acting cycles the agent can perform for a single prompt. This prevents infinite loops and controls costs.
    - **Max Tokens**: The maximum number of tokens the agent can use per response.
    - **Min Time Between Tool Calls**: A delay (in milliseconds) to prevent rate-limiting issues with external APIs.
- **Context**:
    - **Include Context Files**: If checked, the content of all files in Aider's context will be included in the agent's system prompt.
    - **Include Repository Map**: If checked, the Aider-generated repository map will be included, giving the agent a high-level understanding of the project structure.
- **Tools**:
    - **Use Power Tools**: Enables built-in tools for file system access, shell commands, and sub-agent delegation.
    - **Use Aider Tools**: Allows the agent to interact with the underlying Aider instance (e.g., add/drop files, run prompts).
    - **Use Todo Tools**: Enables the agent to manage a persistent to-do list for the project.
- **Rules**:
    - **Custom Instructions**: A free-text area to provide specific, persistent instructions to the agent for this profile.
- **MCP Servers**:
    - A list of all configured MCP servers. You can enable or disable access to each server on a per-profile basis.
- **Auto Approve**:
    - If checked, the agent will bypass all user confirmation prompts for tool usage. **Use with caution**, as this allows the agent to modify files and execute commands without your intervention.
