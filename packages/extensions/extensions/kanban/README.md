# Kanban Board Extension

A Kanban board for AiderDesk project tasks, grouped by task state.

![Button](https://raw.githubusercontent.com/hotovo/aider-desk/main/packages/extensions/extensions/kanban/button.png)

![Kanban Board](https://raw.githubusercontent.com/hotovo/aider-desk/main/packages/extensions/extensions/kanban/screenshot.png)

## Features

- **Visual task board** — displays all project tasks across 8 columns matching AiderDesk's `DefaultTaskState` values
- **Auto-updating** — board refreshes when tasks are created, updated, or closed
- **Task activation** — click a task card to navigate to it in the sidebar
- **Task count badges** — each column shows the number of tasks it contains

### Columns

| Emoji | State | Description |
|-------|-------|-------------|
| 📋 | TODO | Tasks waiting to be started |
| 🚀 | Ready for Implementation | Tasks ready to be worked on |
| ⚙️ | In Progress | Tasks currently being worked on |
| 💬 | More Info Needed | Tasks requiring additional information |
| ⏸️ | Interrupted | Tasks that have been paused |
| 🔄 | Delegated | Tasks delegated to others |
| 👀 | Ready for Review | Tasks awaiting review |
| ✅ | Done | Completed tasks |

## Installation

```bash
npx @aiderdesk/extensions install kanban
```

Or manually copy this directory to `~/.aider-desk/extensions/kanban/`.

## Usage

1. Click the **kanban icon** (columns icon) in the task sidebar header
2. A modal opens showing the Kanban board with all project tasks
3. Click any task card to activate it in the sidebar

## Technical Details

- **Placement**: `tasks-sidebar-actions-left` — renders an icon button in the task sidebar header
- **UI library**: [react-kanban-kit](https://github.com/braiekhazem/react-kanban-kit) loaded via esm.sh
- **Data source**: `ProjectContext.getTasks()` — fetches real-time task data from the project
- **Task sorting**: Tasks are sorted by `updatedAt` descending within each column
