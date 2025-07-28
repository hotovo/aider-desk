---
sidebar_position: 1
title: Introduction
slug: /
sidebar_label: 'Introduction'
---

# Introduction

AiderDesk supercharges your coding workflow by combining the power of [aider](https://aider.chat) with an intuitive desktop interface, enabling seamless AI-assisted code generation, modification, and project management.

## Getting Started

### Installation

1. **Download** the latest version for your operating system from our [Releases page](https://github.com/hotovo/aider-desk/releases)
2. **Install** the application:
   - **Windows**: Run the `.exe` installer
   - **macOS**: Open the `.dmg` and drag AiderDesk to Applications
   - **Linux**: Extract the `.AppImage` and make it executable (`chmod +x`)

### First Launch Experience

When you first open AiderDesk:
- The app will automatically:
  - Set up required Python dependencies
  - Create default configuration files in `~/.aider-desk`
  - Open the main interface with a welcome screen
- You'll see:
  - Left sidebar with project navigation
  - Central chat interface
  - Right panel for context files and settings

### Quick Start Guide

#### 1. Open Your First Project
- Click "Open Project" in the top toolbar
- Navigate to and select your project directory
- AiderDesk will index your project files

#### 2. Add Files to Context
**Manual Method:**
- Use the file browser in the right sidebar
- Click files to add/remove them from context
- Toggle read-only mode with the lock icon

**IDE Integration (Recommended):**
- Install the plugin for your IDE:
  - [VSCode Extension](https://marketplace.visualstudio.com/items?itemName=hotovo-sk.aider-desk-connector)
  - [IntelliJ Plugin](https://plugins.jetbrains.com/plugin/26313-aiderdesk-connector)
- The plugin will automatically sync your active files to AiderDesk's context

#### 3. Send Your First Prompt
- Type your request in the chat input at bottom
- Example prompts:
  - "Add error handling to the main() function"
  - "Explain how this authentication module works"
  - "Refactor this component to use TypeScript"
- Press Enter or click Send

#### 4. Review and Apply Changes
- View AI-generated diffs in the central panel
- Side-by-side comparison shows:
  - Original code (left)
  - Proposed changes (right)
- Use the checkmark to accept or X to reject changes
- Accepted changes are automatically saved to disk

### Essential Configuration

Before getting started, configure these key settings:

1. **API Keys** (Settings → AI Providers):
   - Add keys for your preferred providers (OpenAI, Anthropic, etc.)
   - Test connection for each provider

2. **Model Selection**:
   - Choose default model for coding tasks
   - Set temperature (creativity vs precision)

3. **Context Preferences**:
   - Set default context file limit
   - Configure auto-exclude patterns (e.g., `node_modules/`)

4. **Editor Integration**:
   - Enable/disable automatic context sync
   - Set preferred diff view style

## Key Features

- **AI-Powered Coding**:
  - Generate new code from natural language
  - Modify existing code with precise edits
  - Get explanations for complex code

- **Project Context Management**:
  - Manual or automatic file inclusion
  - IDE plugins for VSCode and IntelliJ
  - Read-only mode for reference files

- **Workflow Tools**:
  - Session persistence
  - Cost tracking per project
  - Multiple AI provider support
  - Built-in diff viewer with side-by-side comparison

## Development Setup
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

## Contributing

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

See our [Contributing Guidelines](CONTRIBUTING.md) for details.
