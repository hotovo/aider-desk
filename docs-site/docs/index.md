---
sidebar_position: 1
title: Introduction
slug: /
sidebar_label: 'Getting Started'
---

# ✨ AiderDesk: AI-Powered Coding

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/hotovo/aider-desk)
[![GitMCP](https://img.shields.io/endpoint?url=https://gitmcp.io/badge/hotovo/aider-desk)](https://gitmcp.io/hotovo/aider-desk)

**Elevate your development workflow with AiderDesk**, a sophisticated desktop application bringing all the power of [aider](https://aider.chat) into a user-friendly graphical interface. Whether you're managing multiple projects, integrating with your favorite IDE, or tracking costs, AiderDesk elevates your productivity to new heights.

## 🎬 Overview

See AiderDesk in action:

<div align="center">
  <a href="https://www.youtube.com/watch?v=9oyIdntCh7g">
    <img src="https://img.youtube.com/vi/9oyIdntCh7g/0.jpg" alt="AiderDesk Overview Video" width="400"></img>
  </a>
</div>

## ✨ Key Features

AiderDesk is packed with features designed for modern software development:

*   **🖥️ Intuitive GUI**: A clean, visual interface replacing command-line interactions.
*   **📂 Multi-Project Management**: Seamlessly organize, switch between, and manage multiple codebases.
*   **🔌 Effortless IDE Integration**: Automatically sync context files with your active editor in:
  *   IntelliJ IDEA ([Plugin](https://plugins.jetbrains.com/plugin/26313-aiderdesk-connector) | [GitHub](https://github.com/hotovo/aider-desk-connector-intellij-plugin))
  *   VSCode ([Extension](https://marketplace.visualstudio.com/items?itemName=hotovo-sk.aider-desk-connector) | [GitHub](https://github.com/hotovo/aider-desk-connector-vscode-extension))
*   **🤖 Powerful Agent Mode**: Utilize an autonomous AI agent (powered by Vercel AI SDK) capable of complex task planning and execution using various tools.
*   **🧩 Extensible via MCP**: Connect to Model Context Protocol (MCP) servers to grant the Agent access to external tools like web search, documentation lookups, and more.
*   **✍️ Custom Commands**: Define and execute your own commands to automate tasks and extend AiderDesk's capabilities. [Learn more](docs/custom-commands.md)
*   **📄 Smart Context Management**: Automatically manage context via IDE plugins or manually control context using the integrated project file browser.
*   **💾 Robust Session Management**: Save and load entire work sessions (chat history, context files) to easily switch between tasks or resume later.
*   **🔄 Flexible Model Switching**: Change AI models on the fly while retaining your conversation and context.
*   **💬 Multiple Chat Modes**: Tailor the AI interaction for different needs (e.g., coding, asking questions).
*   **🔍 Integrated Diff Viewer**: Review AI-generated code changes with a clear side-by-side comparison.
*   **⏪ One-Click Reverts**: Easily undo specific AI modifications while keeping others.
*   **💰 Cost Tracking**: Monitor token usage and associated costs per project session for both Aider and the Agent.
*   **📊 Usage Dashboard**: Visualize token usage, costs, and model distribution with interactive charts and tables.
*   **⚙️ Centralized Settings**: Manage API keys, environment variables, and configurations conveniently.
*   **🌐 Versatile REST API**: Integrate AiderDesk with external tools and workflows.
*   **📨 Structured Communication**: View prompts, AI responses, agent thoughts, and tool outputs in an organized format.
*   **📋 Easy Sharing**: Copy code snippets or entire conversations effortlessly.

---
### 📄 Comprehensive Context File Management

Keep the AI focused on the relevant code with flexible context management options.

<div align="center">
  <a href="https://youtu.be/_hA1_NJDK3s">
    <img src="https://img.youtube.com/vi/_hA1_NJDK3s/0.jpg" alt="Context Files Demo Video" width="400"></img>
  </a>
</div>

1.  **Automatic IDE Sync**: Use the IntelliJ IDEA or VSCode plugins to automatically add/remove the currently active file(s) in your editor to/from the AiderDesk context.
2.  **Manual Control**: Utilize the "Context Files" sidebar in AiderDesk, which displays your project's file tree. Click files to manually add or remove them from the context, giving you precise control.

---
### 💾 Session Management

Never lose your work. Save and load complete sessions, including chat history and context files, per project.

<div align="center">
  <a href="https://youtu.be/eFCod0fOhjI">
    <img src="https://img.youtube.com/vi/eFCod0fOhjI/0.jpg" alt="Sessions Demo Video" width="400"></img>
  </a>
</div>

- **Preserve State**: Save messages and context files as a named session.
- **Resume Seamlessly**: Load a session to restore your exact workspace.
- **Manage Multiple Tasks**: Easily switch between different features, bug fixes, or experiments within the same project.

---
### 🤖 Agent Mode & MCP Support

Unlock advanced AI capabilities with AiderDesk's Agent mode. Built on the Vercel AI SDK, the agent can autonomously plan and execute complex tasks by leveraging a customizable set of tools.

<div align="center">
  <a href="https://youtu.be/Lsd7QReXfy4">
    <img src="https://img.youtube.com/vi/Lsd7QReXfy4/0.jpg" alt="Agent Mode & MCP Demo Video" width="400"></img>
  </a>
</div>

#### Agent Capabilities:
- **Tool-Driven**: Functionality is defined by connected tools (MCP servers + built-in Aider interaction).
- **Autonomous Planning**: Breaks down complex requests into executable steps using available tools.
- **Seamless Aider Integration**: Uses Aider for core coding tasks like generation and modification.
- **Multi-Provider LLMs**: Supports various LLM providers (OpenAI, Anthropic, Gemini, Bedrock, Deepseek, OpenAI-compatible).
- **Transparent Operation**: Observe the agent's reasoning, plans, and tool usage in the chat.

#### 🛠️ Extending Capabilities with MCP

Connect AiderDesk to [Model Context Protocol](https://github.com/model-context-protocol/mcp) (MCP) servers to significantly enhance the Agent's abilities. MCP allows AI models to interact with external tools (web browsers, documentation systems, custom utilities).

- **Access External Tools**: Grant the agent capabilities beyond built-in functions.
- **Gather Richer Context**: Enable the agent to fetch external information before instructing Aider.
- **Flexible Configuration**: Manage MCP servers and individual tools within Agent settings.

AiderDesk is compatible with any MCP server, allowing you to tailor the agent's toolset precisely to your needs.

---
### 🌐 REST API

AiderDesk provides a REST API for external tools to interact with the application. The API is running on the same port as the main application (default 24337, configurable by `AIDER_DESK_PORT` environment variable).

#### Add Context File

<details>
  <summary><code>/api/add-context-file</code></summary>

- **Method:** POST
- **Request Body:**
  ```json
  {
    "projectDir": "path/to/your/project",
    "path": "path/to/the/file",
    "readOnly": false
  }
  ```
- **Response:**
  ```json
  [
    {
      "path": "path/to/the/file",
      "readOnly": false
    }
  ]
  ```
  Returns the list of context files in the project.
</details>

#### Drop Context File

<details>
  <summary><code>/api/drop-context-file</code></summary>

- **Method:** POST
- **Request Body:**
  ```json
  {
    "projectDir": "path/to/your/project",
    "path": "path/to/the/file"
  }
  ```
- **Response:**
  ```json
  []
  ```
  Returns the list of context files in the project.
</details>

#### Get Context Files

<details>
  <summary><code>/api/get-context-files</code></summary>

- **Method:** POST
- **Request Body:**
  ```json
  {
    "projectDir": "path/to/your/project"
  }
  ```
- **Response:**
  ```json
  [
    {
      "path": "path/to/the/file",
      "readOnly": false
    }
  ]
  ```
  Returns the list of context files in the project.
</details>

#### Get Addable Files

<details>
  <summary><code>/api/get-addable-files</code></summary>

- **Method:** POST
- **Request Body:**
  ```json
  {
    "projectDir": "path/to/your/project",
    "searchRegex": "optional/regex/filter"
  }
  ```
- **Response:**
  ```json
  [
    {
      "path": "path/to/the/file"
    }
  ]
  ```
  Returns the list of files that can be added to the project.
</details>

#### Run Prompt

<details>
  <summary><code>/api/run-prompt</code></summary>

- **Endpoint:** `/api/run-prompt`
- **Method:** POST
- **Request Body:**
  ```json
  {
    "projectDir": "path/to/your/project",
    "prompt": "Your prompt here",
    "editFormat": "code"
  }
  ```
- **Response:**
  ```json
  [
    {
      "messageId": "unique-message-id",
      "baseDir": "path/to/your/project",
      "content": "The AI generated response",
      "reflectedMessage": "Optional reflected message",
      "editedFiles": ["file1.txt", "file2.py"],
      "commitHash": "a1b2c3d4e5f6",
      "commitMessage": "Optional commit message",
      "diff": "Optional diff content",
      "usageReport": {
        "sentTokens": 100,
        "receivedTokens": 200,
        "messageCost": 0.5,
        "totalCost": 1.0,
        "mcpToolsCost": 0.2
      }
    }
  ]
  ```
</details>

---
### 🔌 AiderDesk as an MCP Server

AiderDesk includes a built-in MCP server, allowing other MCP-compatible clients (like Claude Desktop, Cursor, etc.) to interact with AiderDesk's core functionalities.

#### Configuration

Add the following configuration to your MCP client settings, adjusting paths as needed:

<details>
  <summary>Windows</summary>

```json
{
  "mcpServers": {
    "aider-desk": {
      "command": "node",
      "args": ["path-to-appdata/aider-desk/mcp-server/aider-desk-mcp-server.js", "/path/to/project"],
      "env": {
        "AIDER_DESK_API_BASE_URL": "http://localhost:24337/api"
      }
    }
  }
}
```

**Note:** Replace `path-to-appdata` with the absolute path to your AppData directory. You can find this value by running `echo %APPDATA%` in your command prompt.
</details>

<details>
  <summary>macOS</summary>

```json
{
  "mcpServers": {
    "aider-desk": {
      "command": "node",
      "args": ["/path/to/home/Library/Application Support/aider-desk/mcp-server/aider-desk-mcp-server.js", "/path/to/project"],
      "env": {
        "AIDER_DESK_API_BASE_URL": "http://localhost:24337/api"
      }
    }
  }
}
```

**Note:** Replace `/path/to/home` with the absolute path to your home directory. You can find this value by running `echo $HOME` in your terminal.
</details>

<details>
  <summary>Linux</summary>

```json
{
  "mcpServers": {
    "aider-desk": {
      "command": "node",
      "args": ["/path/to/home/.config/aider-desk/mcp-server/aider-desk-mcp-server.js", "/path/to/project"],
      "env": {
        "AIDER_DESK_API_BASE_URL": "http://localhost:24337/api"
      }
    }
  }
}
```

**Note:** Replace `/path/to/home` with the absolute path to your home directory. You can find this value by running `echo $HOME` in your terminal.
</details>

**Arguments & Environment:**
- **Command Argument 1:** Project directory path (required).
- **`AIDER_DESK_API_BASE_URL`:** Base URL of the running AiderDesk API (default: `http://localhost:24337/api`).

#### Available Tools via MCP

The built-in server exposes these tools to MCP clients:
- `add_context_file`: Add a file to AiderDesk's context.
- `drop_context_file`: Remove a file from AiderDesk's context.
- `get_context_files`: List files currently in AiderDesk's context.
- `get_addable_files`: List project files available to be added to the context.
- `run_prompt`: Execute a prompt within AiderDesk.

**Note:** AiderDesk must be running for its MCP server to be accessible.

---

## 📥 Installation

### Quick Start
1. Download the latest release for your OS from [Releases](https://github.com/hotovo/aider-desk/releases).
2. Run the executable.

### Troubleshooting

#### Disabling Auto Updates
To prevent automatic updates, set the `AIDER_DESK_NO_AUTO_UPDATE` environment variable:
- **macOS/Linux:** `export AIDER_DESK_NO_AUTO_UPDATE=true`
- **Windows:** `$env:AIDER_DESK_NO_AUTO_UPDATE = "true"`

### Custom Aider Version
By default, AiderDesk installs the latest version of the `aider-chat` Python package. If you need to use a specific version of Aider, you can set the `AIDER_DESK_AIDER_VERSION` environment variable.

For example, to use Aider version 0.83.1:
```bash
# macOS/Linux
export AIDER_DESK_AIDER_VERSION=0.83.1

# Windows (PowerShell)
$env:AIDER_DESK_AIDER_VERSION = "0.83.1"
```
You can also specify a git URL for installing a development version of Aider:
```bash
# macOS/Linux
export AIDER_DESK_AIDER_VERSION=git+https://github.com/user/aider.git@branch-name
```

This variable will be used during the initial setup and when AiderDesk checks for updates. For more detailed information, please refer to [docs/custom-aider-version.md](https://github.com/hotovo/aider-desk/blob/main/docs/custom-aider-version.md).

## 👨‍💻 Development Setup
If you want to run from source, you can follow these steps:

```bash
# Clone the repository
$ git clone https://github.com/hotovo/aider-desk.git
$ cd aider-desk

# Install dependencies
$ npm install

# Run in development mode
$ npm run dev

# Build executables
# For Windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

## 🤝 Contributing

We welcome contributions from the community! Here's how you can help improve aider-desk:

1. **Fork the repository** on GitHub
2. **Create a new branch** for your feature or bugfix:
   ```bash
   git checkout -b my-feature-branch
   ```
3. **Commit your changes** with clear, descriptive messages
4. **Push your branch** to your fork
5. **Create a Pull Request** against the main branch of the original repository

Please follow these guidelines:
- Keep PRs focused on a single feature or bugfix
- Update documentation when adding new features
- Follow the existing code style and conventions
- Write clear commit messages and PR descriptions

For major changes, please open an issue first to discuss what you would like to change.

## ⭐ Star History

[![Star History
Chart](https://api.star-history.com/svg?repos=hotovo/aider-desk&type=Date)](https://star-history.com/#hotovo/aider-desk&Date)

Thank you ❤️
