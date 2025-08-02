# Agent Tools

The capabilities of the agent are defined by the tools it has access to. AiderDesk comes with a set of built-in tools, and you can extend the agent's capabilities by connecting to external [MCP servers](./../../advanced-topics/mcp-servers.md).

You can configure which tools an agent profile has access to in **Settings > Agent**.

## Built-in Tools

AiderDesk provides several categories of built-in tools:

-   **Aider Tools:** These tools allow the agent to interact with the core `aider` functionality. This includes actions like adding or removing files from the context, listing the current context, and applying or rejecting code changes. These tools form the foundation of the agent's ability to modify code.

-   **Power Tools:** This is a set of more advanced tools that give the agent capabilities beyond simple code editing. The power tools include:
    -   Reading and writing files to the file system.
    -   Executing shell commands.
    -   Listing files in a directory.
    -   Searching for files based on a pattern.

-   **To-Do Tools:** These tools allow the agent to manage a to-do list for the current task. The agent can add items to the list, mark them as complete, and view the current list. This is very useful for tracking the agent's plan and progress on complex tasks.

## External Tools (MCP)

In addition to the built-in tools, you can significantly extend the agent's capabilities by connecting AiderDesk to Model Context Protocol (MCP) servers. These servers can provide tools for a wide range of tasks, such as:

-   **Web Search:** Allowing the agent to search the web for information.
-   **Documentation Lookup:** Giving the agent the ability to look up information in technical documentation.
-   **Interacting with APIs:** Enabling the agent to interact with external APIs, such as a project management tool or a CI/CD system.

By combining built-in and external tools, you can create a highly capable agent that is tailored to your specific development workflow.
