# Multi-Model Run Extension for AiderDesk

Allows running the same prompt across multiple models simultaneously. Adds a UI component to the task top bar where you can select up to 10 additional models. When a prompt is started, the extension duplicates the task for each selected model and runs the same prompt in parallel.

![Multi-Model Run Screenshot](https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/multi-model-run/screenshot.png)

## How It Works

The extension registers a UI component (`MultiModelSelectorComponent`) at the `task-top-bar-left` placement. You can add, remove, and configure models from the task bar before sending a prompt.

When the prompt is started, AiderDesk fires the `onPromptStarted` hook. For each additional model selected, the extension:

1. Duplicates the current task via `projectContext.duplicateTask()`
2. Updates the duplicated task's provider, model, and name (prefixed with the model name)
3. Optionally switches the duplicated task to a git worktree (see [Worktree Support](#worktree-support))
4. Runs the same prompt on the duplicated task via `newTaskContext.runPrompt()`

The original task runs with its configured model as usual. Each duplicated task appears as a separate task in the task list, running in parallel.

### UI Actions

| Action | Description |
|--------|-------------|
| `add-model` | Adds a new model selection, defaulting to the current task's model |
| `remove-model` | Removes a model selection by index |
| `update-model` | Updates the model for a given selection index |
| `set-use-worktrees` | Toggles whether duplicated tasks use git worktrees |

## Worktree Support

By default, the "Use worktrees" checkbox is enabled. When enabled, each duplicated task is switched to its own git worktree, providing isolation so that file changes from different models don't conflict.

### Behavior Based on Source Task Working Mode

| Source Task Mode | Worktrees Enabled | Worktrees Disabled |
|---|---|---|
| **Local** | Each duplicate gets its own worktree, carrying over uncommitted changes | All duplicates run in local mode on the same working directory |
| **Worktree** | Duplicates switch to local first, then create a new worktree. Commits and uncommitted changes from the source worktree are carried over. The parent reference is cleared so each task is independent. | First duplicate merges the source worktree back to local with changes; subsequent duplicates switch to local without merging. Parent reference is cleared. |

## Usage

1. Open a task in AiderDesk.
2. In the task top bar, click the **+** button to add an additional model.
3. Select the desired model from the dropdown for each added slot.
4. Toggle "Use worktrees" if you want each model to work in an isolated git worktree (recommended).
5. Send your prompt. The original task runs with its configured model, and a duplicated task is created for each additional model — all running the same prompt simultaneously.
6. Compare results across tasks to evaluate different models side by side.

## Limitations / Known Gaps

- **No result aggregation** — Each model runs in a separate task. There is no built-in UI to compare or merge results across tasks.
- **Model availability** — Only models configured and available in AiderDesk's model list can be selected.
- **Task naming** — Duplicated task names are truncated to 45 characters of the original prompt, prefixed with the model identifier.
