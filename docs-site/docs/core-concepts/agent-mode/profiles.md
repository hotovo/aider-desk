# Agent Profiles

Agent profiles are a powerful feature that allows you to create and manage different configurations for the autonomous agent. An agent profile is a named set of settings that defines how the agent will behave.

You can create and manage agent profiles in the **Settings > Agent** section. For each profile, you can configure:

-   **Provider and Model:** The AI provider and model that the agent will use.
-   **System Prompt:** A custom system prompt to guide the agent's behavior, personality, and goals.
-   **Enabled Tools:** The set of tools that the agent is allowed to use. You can enable or disable built-in tools (like Power Tools and To-Do Tools) as well as tools from connected [MCP servers](./../../advanced-topics/mcp-servers.md).
-   **Tool Approval Settings:** You can configure whether the agent needs to ask for your approval before using a specific tool. The options are:
    -   **Always Ask:** The agent will always prompt for approval before using the tool.
    -   **Remember per Session:** The agent will ask for approval the first time it uses the tool in a session and will remember your choice for the rest of the session.
    -   **Never Ask:** The agent will use the tool without asking for approval.

By creating multiple agent profiles, you can easily switch between different agent configurations depending on the task at hand. For example, you could have a "developer" profile with access to file system tools and a "writer" profile with access to web search tools. You can select the active agent profile using the agent selector next to the model selector in the main interface.
