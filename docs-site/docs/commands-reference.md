---
sidebar_position: 5
title: "Built-in Commands" 
sidebar_label: "Commands"
---

# Built-in Commands Reference

AiderDesk provides a set of built-in commands that you can use in the prompt field to perform various actions quickly. To use a command, simply type `/` followed by the command name.

## Core Commands

- **/add**: Adds one or more files to the chat context. You can specify file paths separated by spaces.
  - *Example*: `/add src/main.js src/utils.js`
- **/drop**: Removes one or more files from the chat context.
  - *Example*: `/drop src/main.js`
- **/read-only**: Adds files to the context in read-only mode. Aider will use these files for reference but will not attempt to edit them.
  - *Example*: `/read-only docs/api.md`
- **/run**: Executes a shell command and optionally adds the output to the chat.
  - *Example*: `/run ls -l`
- **/test**: Runs the predefined test command for your project.
  - *Example*: `/test`

## Chat & Context Management

- **/clear**: Clears the entire chat history and drops all files from the context.
- **/clear-logs**: Removes only log messages (info, warnings, errors) from the chat, keeping the user/AI conversation intact.
- **/compact**: Summarizes the current conversation to reduce token usage while preserving context.
- **/copy-context**: Copies the current chat context to your clipboard in a markdown format suitable for pasting into web UIs like ChatGPT or Claude.
- **/tokens**: Reports the number of tokens currently being used by the chat context, broken down by files, messages, and repo map.

## Mode Switching

- **/code**: Switches to **Code Mode** for direct coding requests.
- **/agent**: Switches to **Agent Mode** for autonomous task execution.
- **/ask**: Switches to **Ask Mode** to ask questions about the code without making changes.
- **/architect**: Switches to **Architect Mode** for planning and executing large-scale changes.
- **/context**: Switches to **Context Mode**, where Aider will automatically add relevant files based on your prompt.

## Model & Aider Control

- **/model**: Opens the model selector to change the AI model on the fly.
  - *Example*: `/model openai/gpt-4.1`
- **/reasoning-effort**: Sets the reasoning effort level for the model (e.g., `low`, `medium`, `high`).
  - *Example*: `/reasoning-effort high`
- **/think-tokens**: Sets the thinking token budget for models that support it.
  - *Example*: `/think-tokens 8k`
- **/undo**: Undoes the last git commit if it was made by Aider.
- **/redo**: Re-runs the last user prompt.
- **/edit-last**: Allows you to edit your last message and re-submit it.

## Other Utilities

- **/web**: Scrapes the content of a URL and adds it to the chat.
  - *Example*: `/web https://aider.chat/docs/`
- **/map**: Prints the current repository map in the chat.
- **/map-refresh**: Forces a refresh of the repository map.
- **/commit**: Commits any unstaged changes in your repository.
- **/init**: Initializes a `PROJECT.md` rule file for your project (only available in Agent Mode).
