# MCP Servers in AiderDesk

MCP (Multi-Content Prompt) Servers is an advanced feature in AiderDesk that allows you to integrate external services or custom logic to dynamically generate and inject content into your prompts. This enables highly customized and context-aware interactions with the AI agent.

## What are MCP Servers?

MCP Servers are HTTP endpoints that AiderDesk can query before sending a prompt to the AI model. These servers receive information about the current context (e.g., current file, project details, user query) and can return additional content to be prepended or appended to the user's prompt.

This mechanism allows for:
-   **Dynamic Context Injection:** Automatically add relevant information from external databases, APIs, or knowledge bases.
-   **Real-time Data Integration:** Incorporate live data, such as stock prices, weather information, or system metrics.
-   **Custom Prompt Engineering:** Implement sophisticated prompt templating and augmentation logic.
-   **Workflow Automation:** Trigger actions or fetch data from other systems as part of the prompt generation process.

## How MCP Servers Work

1.  **Configuration:** You define MCP server endpoints in AiderDesk's settings. Each server configuration includes its URL, enabling/disabling status, and rules for when it should be triggered (e.g., specific file types, project names).
2.  **Triggering:** When you send a prompt in AiderDesk, it checks the configured MCP servers. If the conditions for a server are met, AiderDesk sends a request to that server's endpoint.
3.  **Request to MCP Server:** The request from AiderDesk to the MCP server typically includes a JSON payload containing:
    *   The current user prompt.
    *   Information about the active project and file.
    *   The current chat mode.
    *   Other relevant contextual data.
4.  **Response from MCP Server:** The MCP server processes the request and returns a JSON response. This response can include:
    *   Content to be prepended to the user's prompt.
    *   Content to be appended to the user's prompt.
    *   Instructions on whether to proceed with or halt the original prompt.
5.  **Prompt Augmentation:** AiderDesk modifies the original prompt based on the MCP server's response before sending it to the AI model.

## Configuring MCP Servers

MCP Servers are configured in the AiderDesk settings, usually under a section like "MCP Servers" or "Prompt Augmentation."

For each server, you'll typically need to provide:

-   **Name:** A descriptive name for the server.
-   **URL:** The HTTP(S) endpoint of your MCP server.
-   **Enabled:** A toggle to activate or deactivate the server.
-   **Timeout:** Maximum time (in milliseconds) AiderDesk should wait for a response.
-   **Authentication (Optional):** Details for any required authentication (e.g., API keys, tokens).
-   **Trigger Conditions (Optional):** Rules to specify when this MCP server should be invoked (e.g., based on file extension, project name, or specific keywords in the prompt).

## Developing an MCP Server

An MCP server is essentially an HTTP service that can receive a POST request with a JSON payload and return a JSON response.

**Example Request Payload (from AiderDesk to MCP Server):**

```json
{
  "prompt": "How do I implement a binary search tree in Python?",
  "currentFile": "src/utils/search.py",
  "projectPath": "/path/to/my/project",
  "chatMode": "code",
  "metadata": { ... } // Additional contextual information
}
```

**Example Response Payload (from MCP Server to AiderDesk):**

```json
{
  "prependContent": "Consider the following coding standards for Python:\n- Use 4 spaces for indentation.\n- Follow PEP 8 guidelines.\n",
  "appendContent": "\nEnsure your implementation includes methods for insertion, deletion, and searching.",
  "haltOriginalPrompt": false, // If true, AiderDesk might not send the original user prompt
  "metadata": { ... } // Additional information or logging
}
```

You can implement an MCP server using any web framework or language (e.g., Node.js with Express, Python with Flask/FastAPI, Java with Spring Boot).

## Use Cases

-   **Internal Knowledge Base Integration:** Automatically pull relevant documentation or code snippets from your company's internal wiki or knowledge base.
-   **API Integration:** Fetch data from third-party APIs (e.g., JIRA, GitHub, StackOverflow) to provide context for the AI.
-   **Dynamic Few-Shot Learning:** Inject relevant examples into the prompt based on the user's query to improve AI performance on specific tasks.
-   **Enforcing Coding Standards:** Prepend project-specific coding guidelines or style requirements to prompts that involve code generation.
-   **Pre-computation or Validation:** Perform preliminary analysis or validation of the user's query before it's sent to the main AI model.

## Benefits

-   **Enhanced Context:** Provides the AI with richer, more relevant information, leading to better responses.
-   **Automation:** Automates the process of gathering and including contextual data.
-   **Customization:** Allows for highly tailored AI interactions specific to your projects and workflows.
-   **Efficiency:** Reduces the need for users to manually copy-paste information into prompts.
-   **Integration:** Seamlessly connects AiderDesk with other tools and services in your development ecosystem.

MCP Servers are a powerful tool for users who want to deeply integrate AiderDesk into their existing workflows and augment its capabilities with custom data and logic. While they require some setup and potentially development of the server-side component, the benefits in terms of customized and context-aware AI assistance can be significant.
