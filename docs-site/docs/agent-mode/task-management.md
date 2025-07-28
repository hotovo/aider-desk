---
sidebar_position: 3
title: "Task Management"
sidebar_label: "Task Management"
---

# Task Management with the TODO List

AiderDesk includes a task management system designed to help the agent track and complete complex, multi-step tasks. This feature is primarily used in **Agent Mode**.

## How It Works

When the agent is given a high-level goal, it can use its "Todo" tools to break the goal down into a checklist of smaller, manageable tasks. This list is saved to a `todos.json` file inside your project's `.aider-desk` directory, making it persistent across sessions.

## The TODO Window

A floating window will appear in the main chat view whenever there are active to-do items. This window provides a real-time view of the agent's plan and progress.

From this window, you can:
- **View all tasks** and their completion status.
- **Manually check or uncheck** items to guide the agent or correct its state.
- **Add new tasks** to the list.
- **Edit the names** of existing tasks.
- **Delete tasks** from the list.

## Agent Interaction

The agent interacts with the to-do list via a set of dedicated tools:

- **`set_items`**: Creates or overwrites the to-do list. The agent typically uses this at the beginning of a task to lay out its plan.
- **`get_items`**: Reads the current to-do list to understand its current state.
- **`update_item_completion`**: Marks a specific task as complete or incomplete.
- **`clear_items`**: Clears all items from the list, typically when starting a completely new task.

This feature provides transparency into the agent's process and allows for a collaborative workflow where you can monitor and adjust the agent's plan as it works.
