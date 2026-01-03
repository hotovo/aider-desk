
# ✨ AiderDesk: The AI-Powered Development Platform

[![Documentation](https://img.shields.io/badge/Docs-blue?logo=ReadTheDocs&logoColor=white)](https://aiderdesk.hotovo.com/docs)
[![Discord](https://img.shields.io/badge/Discord-5865F2?logo=discord&logoColor=white)](https://discord.com/invite/dyM3G9nTe4)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/hotovo/aider-desk)
[![GitMCP](https://img.shields.io/endpoint?url=https://gitmcp.io/badge/hotovo/aider-desk)](https://gitmcp.io/hotovo/aider-desk)

**AiderDesk transforms how you write software** by combining an autonomous AI agent, powerful code generation, and a comprehensive toolset into a single desktop application. Whether you're building complex features, refactoring large codebases, or automating repetitive tasks, AiderDesk gives you an intelligent coding companion that works the way you do.

## 🎬 Overview

See AiderDesk's autonomous AI agent in action:

<div align="center">
  <a href="https://www.youtube.com/watch?v=KSWlhB-O2SE">
    <img src="https://img.youtube.com/vi/9oyIdntCh7g/0.jpg" alt="AiderDesk Overview Video" width=400>
  </a>
</div>

## ✨ Key Features

AiderDesk is packed with features designed for modern software development:

* **🤖 Autonomous Agent Mode**: An intelligent AI agent (powered by Vercel AI SDK) that autonomously plans and executes complex tasks—from implementing features to refactoring entire modules. Just describe what you need, and the agent breaks it down, explores your codebase, uses the right tools, and delivers results.
* **🧩 Extensible Tool Ecosystem**:
  * **Power Tools**: Direct file operations, semantic search, grep, shell commands, web fetching
  * **Aider Tools**: Deep integration with Aider's intelligent code generation and modification
  * **Memory Tools**: Vector-based persistent knowledge storage that learns project patterns and preferences
  * **Skills**: Progressive disclosure system to add domain expertise and custom workflows
  * **Task Tools**: Complete task management with cost tracking and todo lists
  * **Todo Tools**: Built-in checklist management that agents can use to track progress
* **👥 Specialized Subagents**: Create cost-optimized AI specialists for specific tasks (code review, testing, documentation). Automatic or on-demand invocation with configurable permissions and context memory.
* **🎛️ Customizable Agent Profiles**: Configure different agent behaviors with system prompts, custom instructions, tool approvals, and rule files. Pre-built profiles included for common workflows.
* **🧠 Persistent Memory**: The agent remembers project patterns, architectural decisions, and your preferences across tasks using local vector search (LanceDB).
* **📂 Advanced Task Management**: Organize work with tasks that include chat history, context files, cost tracking, todos, and optional Git worktree isolation for safe experimentation.
* **🌿 Git Worktrees**: Create isolated development environments for safe, parallel feature development. Multiple merge strategies with built-in revert support.
* **🔌 Effortless IDE Integration**: Automatically sync context files with your active editor in:
  * IntelliJ IDEA ([Plugin](https://plugins.jetbrains.com/plugin/26313-aiderdesk-connector) | [GitHub](https://github.com/hotovo/aider-desk-connector-intellij-plugin))
  * VSCode ([Extension](https://marketplace.visualstudio.com/items?itemName=hotovo-sk.aider-desk-connector) | [GitHub](https://github.com/hotovo/aider-desk-connector-vscode-extension))
* **🧩 MCP Server Support**: Connect to any Model Context Protocol (MCP) server to add external capabilities (web browsing, database access, custom tools).
* **⚙️ Hooks & Automation**: JavaScript hooks for workflow automation—respond to events, modify behavior, and integrate with external tools.
* **📊 Usage Dashboard**: Visualize token usage, costs, and model distribution with interactive charts and tables.
* **💰 Cost Tracking**: Monitor token usage and associated costs per task for both Aider and Agent.
* **🌐 REST API**: Integrate AiderDesk with external tools and workflows.
* **🌐 AiderDesk as MCP Server**: Expose AiderDesk's core functionality to other MCP-compatible clients (Claude Desktop, Cursor, etc.).


---

### 🤖 Agent Mode: Autonomous AI Assistant

AiderDesk's Agent Mode transforms the application into a powerful, autonomous coding companion. Instead of just generating code snippets, the agent can:

- **Plan Multi-Step Work**: Break down complex requests like "implement OAuth authentication" into actionable steps
- **Intelligently Explore**: Use semantic search and grep to understand your codebase structure
- **Execute Safely**: Operate files, run commands, and fetch documentation with your approval
- **Learn from Context**: Retrieve relevant memories about project patterns and your preferences
- **Delegate to Specialists**: Automatically invoke specialized subagents for code review, testing, or documentation

<div align="center">
  <a href="https://youtu.be/Lsd7QReXfy4">
    <img src="https://img.youtube.com/vi/Lsd7QReXfy4/0.jpg" alt="Agent Mode Demo Video" width=400>
  </a>
</div>

#### Key Capabilities:

- **Autonomous Planning**: The agent breaks down high-level requests into executable steps
- **Tool-Driven**: Functionality is defined by connected tools (Power Tools, Aider, MCP, Skills, Memory, etc.)
- **Seamless Integration**: Uses Aider for core coding tasks like generation and modification
- **Multi-Provider Support**: Works with various LLM providers (OpenAI, Anthropic, Gemini, Bedrock, Deepseek, OpenAI-compatible)
- **Transparent Operation**: See the agent's reasoning, plans, and tool usage in the chat
- **Cost Optimization**: Use different models for different tasks—premium for complex work, cost-effective for routine operations

#### Pre-Built Agent Profiles:

- **Power Tools**: Direct file manipulation and codebase analysis
- **Aider**: AI-powered code generation and refactoring
- **Aider with Power Search**: Hybrid approach combining code generation with advanced search

---

### 🌿 Git Worktrees: Isolated Development Environments

AiderDesk's Git Worktrees feature provides professional-grade isolation for your development work, enabling safe experimentation and parallel development without affecting your main project branch.

<div align="center">
  <img src="https://img.youtube.com/vi/placeholder-worktree-demo/0.jpg" alt="Git Worktrees Demo Video" width=400> <!-- TODO: Add actual video ID -->
</div>

#### Key Benefits:

- **🔒 Complete Isolation**: Work on features in separate environments without risking your main codebase
- **🔄 Flexible Integration**: Choose between standard merge, squash & merge, or uncommitted changes only
- **⚡ Parallel Development**: Work on multiple features simultaneously in isolated worktrees
- **🛡️ Safety Features**: Built-in conflict detection, merge revert, and state preservation
- **🤖 AI Integration**: AI assistance works seamlessly within isolated worktree environments

#### Workflow Overview:

1. **Create Worktree Task**: Start a new task in worktree mode for isolated development
2. **Work Safely**: All file edits, commits, and AI interactions happen in the isolated environment
3. **Integrate When Ready**: Choose your preferred merge strategy when work is complete
4. **Revert if Needed**: Built-in revert functionality to undo merges if issues arise

#### Merge Options:

- **Standard Merge**: Preserves commit history with fast-forward merge
- **Squash & Merge**: Creates a single clean commit with AI-generated message
- **Uncommitted Only**: Transfers work-in-progress changes without merging commits

[**Learn more about Git Worktrees →**](https://aiderdesk.hotovo.com/docs/features/git-worktrees)

---

### 🧠 Memory: AI That Learns Your Project

AiderDesk's Memory system enables the agent to **store and retrieve durable, project-scoped knowledge** across tasks. This helps the agent remember:

- **Your Preferences**: Formatting rules, frameworks you prefer, naming conventions
- **Architectural Decisions**: "We use Zod for validation", "REST client lives in src/renderer/src/api/"
- **Reusable Patterns**: Error handling conventions, logging standards, common abstractions

#### How It Works:

- **Local Vector Search**: Uses LanceDB with local embedding models—no data leaves your machine
- **Project-Scoped**: Memories are stored per project, keeping knowledge organized
- **Agent Integration**: Automatically retrieves relevant memories at task start and stores outcomes after completion
- **Manual Management**: Browse, filter, and delete memories from Settings

---

### 📋 Skills: Extend Agent with Expertise

Skills let you package **reusable, on-demand expertise** that the agent can load when relevant. Instead of pasting large guides into chat, use skills with progressive disclosure:

- **On Startup**: Only loads skill metadata (name + description)—token-efficient
- **When Relevant**: Agent loads skill's `SKILL.md` and follows its instructions
- **With Helpers**: Skills can include executable scripts and reference materials

#### Use Skills For:

- **Repeatable Workflows**: "How we do releases", "how we write PR descriptions"
- **Domain-Specific Playbooks**: Internal processes, project conventions, brand guidelines
- **Project-Specific Knowledge**: Keep `.aider-desk/skills/` in your repo for team sharing
- **Global Skills**: Personal skills in `~/.aider-desk/skills/` for all your projects

---

### 🎛️ Hooks: Automate Workflows

Hooks allow you to **extend AiderDesk's behavior** by executing custom JavaScript code in response to system events. Automate workflows, enforce rules, or integrate with external tools.

#### Hook Events:

- **Task Events**: `onTaskCreated`, `onTaskClosed`, `onPromptSubmitted`
- **Agent Events**: `onAgentStarted`, `onAgentFinished`, `onAgentStepFinished`
- **Tool Events**: `onToolCalled`, `onToolFinished`
- **File Events**: `onFileAdded`, `onFileDropped`
- **Approval Events**: `onQuestionAsked`, `onHandleApproval` (auto-answer questions)
- **Modification Events**: Marked with (M)—return modified data to change behavior

#### Locations:

- **Global Hooks**: `~/.aider-desk/hooks/` (all projects)
- **Project Hooks**: `.aider-desk/hooks/` (project-specific)

---

### 📂 Task System: Organize Your Work

AiderDesk's task management system provides a comprehensive way to organize work with:

- **Complete State**: Chat history, context files, todos, costs, and metadata
- **Working Modes**: Local development or isolated Git worktree
- **Cost Tracking**: Per-task costs for both Aider and Agent usage
- **Todo System**: Built-in checklists that agents can manage automatically
- **Task Operations**: Create, rename, duplicate, delete, export (Markdown/Image)

Tasks are stored per project in `.aider-desk/tasks/` with full state persistence.

---

### 📄 Comprehensive Context File Management

Keep the AI focused on the relevant code with flexible context management options.

<div align="center">
  <a href="https://youtu.be/_hA1_NJDK3s">
    <img src="https://img.youtube.com/vi/_hA1_NJDK3s/0.jpg" alt="Context Files Demo Video" width=400>
  </a>
</div>

1. **Automatic IDE Sync**: Use the IntelliJ IDEA or VSCode plugins to automatically add/remove the currently active file(s) in your editor to/from the AiderDesk context.
2. **Manual Control**: Utilize the "Context Files" sidebar in AiderDesk, which displays your project's file tree. Click files to manually add or remove them from the context, giving you precise control.

---

### 💰 Cost Optimization

AiderDesk provides multiple ways to optimize your AI spending:

- **Per-Task Cost Tracking**: Separate tracking for Aider and Agent operations
- **Usage Dashboard**: Visualize token usage, costs, and model distribution
- **Subagent Cost Management**: Use different models per task type:
  - **Claude Opus**: High-level planning and architecture
  - **Claude 3.5 Sonnet / GPT-4**: Complex development and debugging
  - **Gemini Flash / Claude Haiku**: Routine code reviews and testing
- **Context Optimization**: Agent only loads what's needed (skills, memories)
- **Tool Approval Control**: Set tools to "Always", "Ask", or "Never" to prevent unnecessary operations

---

### 📄 Comprehensive Context File Management

Organize your work with a comprehensive task management system that goes beyond simple session saving. Tasks include chat history, context files, cost tracking, todo lists, and optional Git worktree isolation.

- **Complete Work Organization**: Each task captures the full state including messages, files, costs, and todos.
- **Flexible Working Modes**: Choose between local development or isolated Git worktrees for safe experimentation.
- **Smart Cost Tracking**: Monitor Aider and Agent costs per-task for better budget management.
- **Built-in Todo System**: Break down complex work with integrated todo lists that agents can manage automatically.
- **Seamless Migration**: Automatically converts previous sessions to the new task format without data loss.

---

### 🤖 Agent Mode & MCP Support

Unlock advanced AI capabilities with AiderDesk's Agent mode. Built on the Vercel AI SDK, the agent can autonomously plan and execute complex tasks by leveraging a customizable set of tools.

<div align="center">
  <a href="https://youtu.be/Lsd7QReXfy4">
    <img src="https://img.youtube.com/vi/Lsd7QReXfy4/0.jpg" alt="Agent Mode & MCP Demo Video" width=400>
  </a>
</div>

#### Agent Capabilities:

- **Tool-Driven**: Functionality is defined by connected tools (MCP servers + built-in Aider interaction).
- **Autonomous Planning**: Breaks down complex requests into executable steps using available tools.
- **Seamless Aider Integration**: Uses Aider for core coding tasks like generation and modification.
- **Multi-Provider LLMs**: Supports various LLM providers (OpenAI, Anthropic, Gemini, Bedrock, Deepseek, OpenAI-compatible).
- **Transparent Operation**: Observe the agent's reasoning, plans, and tool usage in the chat.

#### 🛠️ Extending Capabilities with MCP

Connect AiderDesk to [Model Context Protocol](https://modelcontextprotocol.io/docs/getting-started/intro) (MCP) servers to significantly enhance the Agent's abilities. MCP allows AI models to interact with external tools (web browsers, documentation systems, custom utilities).

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
    "editFormat": "code" // Optional: "code", "ask", or "architect"
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
2. Run of executable.

### Recommended First Steps

1. **Try Agent Mode**: Switch to Agent mode (`/agent`) and ask to agent to explore your codebase or implement a feature
2. **Create a Skill**: Add a skill to `.aider-desk/skills/` to encode your team's conventions
3. **Set Up Memory**: Enable Memory tools in Agent Settings to let to agent learn your project patterns

### the executable.

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

This variable will be used during the initial setup and when AiderDesk checks for updates. For more detailed information, please refer to [our docs](https://aiderdesk.hotovo.com/docs/customization/custom-aider-version).

## Installation with Package Managers

### Homebrew (MacOS)

If you’re on a Mac and prefer using [Homebrew](https://brew.sh/) for managing applications, you can install AiderDesk directly:

```bash
brew update
brew install hotovo-aider-desk
```

Then open the app from your Applications folder.

Updates are handled from within the AiderDesk application itself. The `brew upgrade` command will not update your installation.

Uninstall using standard `brew uninstall` tool. To completely remove the app, use:

```bash
brew uninstall hotovo-aider-desk
# optionally also remove all user-data:
# brew uninstall --zap hotovo-aider-desk
```

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
