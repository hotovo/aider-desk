---
title: "Aider Tools"
sidebar_label: "Aider Tools"
---

# Aider Tools

When **Agent Mode** is active, the agent can interact with the underlying Aider instance using a dedicated set of tools. This allows the agent to leverage Aider's powerful code generation and modification capabilities as part of a larger, autonomous task.

These tools can be enabled or disabled for each Agent Profile in **Settings > Agent**.

## Available Aider Tools

#### `get_context_files`
**Description**: Allows the agent to see a list of all files currently included in Aider's context. This helps the agent understand what information Aider will use before running a prompt.

#### `add_context_files`
**Description**: Adds one or more files to Aider's context. The agent should use this tool to provide Aider with all relevant files before requesting code changes. It can add files for editing (relative paths) or for reference only (absolute paths).

#### `drop_context_files`
**Description**: Removes one or more files from Aider's context. This is useful for cleaning up the context after a specific sub-task is complete, helping to manage token usage.

#### `run_prompt`
**Description**: This is the primary tool for delegating a coding task to Aider. The agent can provide a natural language prompt describing what needs to be done (e.g., "Refactor this function to be more efficient," "Add a new method to this class"). Aider will then execute the task on the files currently in its context.
