# My Minions

Adds **Orchestrator** and **Minion** agent profiles to AiderDesk — a coordinator that delegates ALL work to a focused execution subagent.

Inspired by the [opencode orchestrator plugin](https://github.com/anomalyco/opencode/blob/v2/.opencode/plugins/orchestrator.ts).

## How It Works

| Profile | Role | Description |
|---------|------|-------------|
| **Orchestrator** | Primary agent | Coordinates, briefs, and synthesizes. Delegates all actual work — implementation, exploration, file reading, even trivial edits — to the Minion subagent. Never does the work itself. |
| **Minion** | Automatic subagent | Focused execution agent that receives clear, self-contained briefs from the Orchestrator and completes them using available tools. Cannot spawn further subagents. |

### Key Design Decisions

- The Orchestrator uses `enabledSubagentIds: ['minion']` to restrict its subagent list to only the Minion.
- The Minion uses `InvocationMode.Automatic`, so the Orchestrator can invoke it without user explicitly requesting it.
- The Minion has `useSubagents: false` and `subagents---run_task: Never`, preventing nested delegation.
- Both profiles use the `systemPrompt` field (Orchestrator) and `subagent.systemPrompt` field (Minion) for their respective system prompts.

## Usage

1. Enable the extension in **Settings → Extensions**.
2. Select the **Orchestrator** agent profile in your task or project settings.
3. The Orchestrator will automatically delegate work to the Minion subagent as needed.
4. Both profiles are fully customizable in **Settings → Agent** — provider, model, tool approvals, and prompts can be adjusted.

## Customization

Both agent profiles support `onAgentProfileUpdated()`, meaning any changes made in the AiderDesk settings UI are persisted for the session. You can customize:

- **Provider & model** — switch to any configured LLM provider
- **Tool approvals** — fine-tune which tools require approval
- **System prompts** — adjust the Orchestrator's coordination instructions or the Minion's execution instructions
- **Subagent settings** — change invocation mode, context memory, color, and description
