---
sidebar_position: 4
title: "Chat Modes" 
sidebar_label: "Chat Modes"
---

# Chat Modes

AiderDesk offers several chat modes to tailor the AI's behavior to your specific needs. You can switch between modes at any time using the mode selector in the prompt area or by typing the corresponding command (e.g., `/code`).

## Available Modes

### Code
- **Command**: `/code`
- **Purpose**: This is the default mode for direct interaction with Aider to request code changes. It's best for specific, well-defined tasks like "add a new function" or "fix this bug."

### Agent
- **Command**: `/agent`
- **Purpose**: Activates the autonomous agent. Use this mode for high-level, complex tasks that may require multiple steps, reasoning, and the use of various tools (e.g., "implement a new API endpoint" or "refactor the user authentication flow").
- **See Also**: [Agent Mode](./agent-mode.md)

### Ask
- **Command**: `/ask`
- **Purpose**: Allows you to ask questions about your codebase without the AI attempting to make any changes. It's perfect for understanding code, getting explanations, or exploring the project structure.

### Architect
- **Command**: `/architect`
- **Purpose**: A specialized mode designed for planning and executing large-scale changes that affect multiple files. The AI will first create a plan and then use an "editor" model to apply the changes, which can be more efficient for widespread modifications.

### Context
- **Command**: `/context`
- **Purpose**: In this mode, Aider will automatically analyze your prompt and try to identify and add the most relevant files to the context before proceeding. This is useful when you're not sure which files are needed for a task.
