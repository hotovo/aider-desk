# MCP Servers

AiderDesk's agent capabilities can be extended by connecting to Model Context Protocol (MCP) servers. MCP is a standard protocol that allows AI models to interact with external tools and services. By connecting AiderDesk to an MCP server, you can give the agent access to a wider range of tools, such as web browsers, documentation systems, or custom internal utilities.

## What is an MCP Server?

An MCP server is a service that exposes a set of tools that an AI agent can use. When AiderDesk connects to an MCP server, it fetches the list of available tools and makes them available to the agent.

When the agent decides to use one of these tools, AiderDesk sends a request to the MCP server, which then executes the tool and returns the result.

## Connecting to an MCP Server

You can add and manage MCP servers in **Settings > Agent > MCP Servers**. To add a new server, you will need to provide the following information:

-   **Server Name:** A unique name for the server.
-   **URL:** The URL of the MCP server.
-   **API Key:** An API key for authentication, if required by the server.

Once you have added an MCP server, AiderDesk will connect to it and fetch the list of available tools. These tools will then appear in the agent profile settings, where you can enable or disable them for each profile.

## Using Tools from MCP Servers

After connecting to an MCP server and enabling its tools in an agent profile, the agent will be able to use those tools to perform tasks.

For example, if you connect to an MCP server that provides a "web search" tool, you could ask the agent to "research the latest trends in AI development." The agent would then be able to use the web search tool to find relevant information and use it to answer your question.

By leveraging MCP servers, you can create a highly customized and powerful agent that is tailored to your specific needs and workflows. You can find a list of publicly available MCP servers or create your own by following the [MCP specification](https://github.com/model-context-protocol/mcp).
