---
title: "Todo Management"
sidebar_label: "Todo Management"
---

# Todo Management in Agent Mode

AiderDesk includes a todo management system designed to help the agent track and complete complex, multi-step tasks. This feature is integrated into the broader **Task Management** system and is primarily used in **Agent Mode**.

## How It Works

When the agent is given a high-level goal, it can use its "Todo" tools to break the goal down into a checklist of smaller, manageable subtasks. This list is saved to a `todos.json` file within each task's directory, making it persistent across task sessions and integrated with the overall task state.

## The TODO Window

A floating todo window will appear in the main chat view whenever there are active todo items within the current task. This window provides a real-time view of the agent's plan and progress for the specific task you're working on.

![TODO window with the agent's checklist](../images/am-todo-window.png)

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

This todo system provides transparency into the agent's process and allows for a collaborative workflow where you can monitor and adjust the agent's plan as it works. The todos are saved as part of the task data, ensuring they persist alongside your conversation history and context files.
