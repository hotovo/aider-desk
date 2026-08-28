# ADR-0015: Aider Mode and Agent Mode Coexistence

## Status

Accepted (2026-08-28)

## Context

AiderDesk began as a GUI for Aider ("Aider mode": classic prompt → Aider edits repo). It then grew its own TypeScript agent system ("Agent mode": profiles, tools, MCP, subagents). Both paradigms are valuable — Aider for fast, surgical repo edits with mature edit-formats; agents for orchestrated, tool-driven workflows — and existing users depend on both. They must coexist within one task without forked UX or duplicated context handling.

## Decision Drivers

- **Must** keep both modes first-class; removing either is a regression for existing users
- **Must** share task context (messages, context files) across modes so users can switch without losing history
- **Must** keep the agent system independent of Aider internals (the agent must run even when no connector is healthy)
- **Should** allow agents to delegate specific edits to Aider deliberately

## Considered Options

### Option A — Migrate fully to the agent system, deprecate Aider mode

- **Pros**: One paradigm to maintain.
- **Cons**: Discards Aider's strengths and breaks existing workflows; enormous migration burden on users.

### Option B — Two engines behind one task facade, with explicit delegation

- **Pros**: `Task` (`src/main/task/task.ts`) owns context/messages/state; mode selects the execution engine — Aider via the connector ([ADR-0014](0014-python-connector-bridge.md)) or the agent runtime ([ADR-0005](../agent-system/0005-vercel-ai-sdk-as-agent-runtime.md)); the agent exposes Aider itself as a tool (`tools/aider.ts`, `AIDER_TOOL_GROUP_NAME`) for deliberate delegation.
- **Cons**: The task facade must normalize two engines' output shapes into one `ContextMessage` stream.

## Decision

Keep **both engines as siblings behind the `Task` facade**. Mode selection is per-task/per-prompt; context files, messages, and state live in the task regardless of engine ([ADR-0016](../task-and-project/0016-task-lifecycle-and-persistence.md)). The agent system treats Aider as just another tool source (`AIDER_COMMANDS`, `AIDER_MODES`, `EditFormat`, `AiderRunOptions` in `@common/types`), so an agent can delegate an edit to Aider and continue reasoning about its result. Shared enums/constants for Aider concepts live in `@common` and are consumed by both engines' UI and tooling.

## Rationale

The facade keeps user-facing state unified while letting each engine do what it's best at, and the "Aider as agent tool" inversion means the agent doesn't compete with Aider — it can orchestrate it. This preserves the product's history and its two strengths without a risky big-bang migration.

## Consequences

### Positive

- Users choose paradigms per task; existing workflows unaffected
- Agents gain Aider's editing competence via one tool boundary
- Engine internals can evolve independently behind the facade

### Negative

- Two engines to test; context normalization code must handle both message dialects
- Feature parity questions (what exists in both modes) need explicit product decisions

### Risks & Mitigations

- Risk: mode-specific fields leak into shared task data — Mitigation: shared `ContextMessage`/`TaskData` types in `@common/types` are the only storage format; engine-specific data is embedded as typed parts/options

## Guardrails for Agents

### Do

- Route all task state changes through the `Task` facade regardless of engine
- When touching shared types, ensure both engines remain representable (a field added for the agent must not break Aider-mode contexts)
- Use the existing Aider constants (`AIDER_COMMANDS`, `AIDER_MODES`, `EditFormat`) when working with Aider concepts

### Don't

- Never couple agent execution to connector health — agents must run without Aider
- Never let UI code special-case engines where the task facade can abstract the difference
- Don't remove Aider-mode support in refactors; it is a product commitment

## Related Decisions

- [ADR-0005: Vercel AI SDK as Agent Runtime](../agent-system/0005-vercel-ai-sdk-as-agent-runtime.md)
- [ADR-0014: Python Connector Bridge](0014-python-connector-bridge.md)
- [ADR-0016: Task Lifecycle and Persistence](../task-and-project/0016-task-lifecycle-and-persistence.md)
