# Agent Mode

Agent Mode is one of the most powerful features of AiderDesk. It allows you to use an autonomous AI agent that can perform complex tasks by planning and executing a series of actions.

## What is an Agent?

In AiderDesk, an agent is an AI that has been given a set of tools and the ability to decide which tools to use to achieve a goal. When you give the agent a prompt, it will:

1.  **Think:** The agent first thinks about how to approach the task. It will break down the problem into smaller steps.
2.  **Plan:** Based on its thinking, the agent creates a plan of action. This plan consists of a sequence of tool calls.
3.  **Execute:** The agent then executes the plan by calling the necessary tools in order. For example, it might use a tool to read a file, then use another tool to modify it, and finally use a tool to run a test.

You can observe the agent's thinking and planning process directly in the chat interface, which gives you transparency into how the agent is working.

## Tools

The capabilities of the agent are defined by the tools it has access to. AiderDesk comes with a set of built-in tools, and you can extend the agent's capabilities by connecting to external [MCP servers](./../advanced-topics/mcp-servers.md).

Some of the built-in tool categories include:

-   **Aider Tools:** Tools for interacting with the `aider` backend, such as adding files to the context or applying changes.
-   **Power Tools:** Tools for interacting with the file system, running commands, and more.
-   **To-Do Tools:** Tools for managing a to-do list for the current task.

## Agent Profiles

You can configure the agent's behavior by creating and customizing agent profiles in the settings. An agent profile allows you to specify:

-   The AI model to use.
-   The system prompt that guides the agent's behavior.
-   The set of tools that the agent has access to.
-   Other parameters, such as the maximum number of iterations the agent can perform.

By creating different profiles, you can tailor the agent's capabilities to different types of tasks. You can learn more about configuring agent profiles in the [Agent Profiles](./profiles.md) page.
