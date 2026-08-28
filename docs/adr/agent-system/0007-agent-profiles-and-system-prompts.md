# ADR-0007: Agent Profiles and System Prompts

## Status

Accepted (2026-08-28)

## Context

Different workflows need different agent behaviors: models, autonomy, tool availability, subagent structure, and prompt text all vary. Hardcoding one agent personality cannot serve coding, review, docs, and orchestration workflows, and users need to bring their own agent definitions.

## Decision Drivers

- **Must** let users define multiple named agents (model, provider, tools, prompt) and switch per task
- **Must** support user-editable system prompts with safe composition of dynamic parts
- **Must** keep profile data versioned and migratable ([ADR-0027](../data-and-state/0027-versioned-migration-chains.md))
- **Should** support orchestrator/subagent topologies

## Considered Options

### Option A — Single hardcoded agent configuration

- **Pros**: Simple; no management UI/storage.
- **Cons**: Cannot represent different workflows; users patch code to customize; conflicts with multi-model support.

### Option B — Agent profiles as first-class stored entities

- **Pros**: Behavior is data, not code; profiles compose model/provider/tools/prompt; built-in profiles (orchestrator, minion, code-checker, code-reviewer, test-writer, translation-manager, …) ship as defaults and users can add their own; subagents are just profiles invoked by a parent tool ([ADR-0006](0006-mcp-for-tool-extensibility.md)).
- **Cons**: Needs management UI, storage, migrations, and validation.

## Decision

Model agent behavior as **`AgentProfile`** entities (type in `@common/types`, incl. `agent.ts` helpers), managed by `src/main/agent/agent-profile-manager.ts` and editable in the renderer (`src/renderer/src/components/settings/agent/`). Profiles reference provider/model settings, tool configuration, autonomy mode ([ADR-0009](0009-tool-approval-and-autonomy-modes.md)), and system prompt content. System prompts are assembled by the prompts system (`src/main/prompts/prompts-manager.ts`) supporting custom user prompts and placeholder substitution (`system-prompt-placeholders.ts` in `@common`). Subagents (`subagent.ts`) run child tasks with a parent profile delegating to another profile.

## Rationale

Profiles turn agent customization into configuration — no forks, no code changes — and give subagents a uniform implementation: a subagent is a profile execution with its own task context. Placeholder-based prompt assembly lets users customize prose while the system injects required dynamic context.

## Consequences

### Positive

- New agent behaviors ship as data (built-in profiles) or user config
- Subagent orchestration reuses the exact same runtime as top-level agents
- Prompt customization survives upgrades because dynamic parts are placeholders, not edited blobs

### Negative

- Profile schema changes require migrations and UI updates
- Placeholder contracts must stay backward compatible or old user prompts break

### Risks & Mitigations

- Risk: users edit away placeholders, breaking dynamic context injection — Mitigation: placeholders are documented, validated on save, and render as visible slots in the editor

## Guardrails for Agents

### Do

- Treat `AgentProfile` fields as the source of truth for behavior; read capabilities from the profile, never from ambient globals
- Add new dynamic prompt values as placeholders in `system-prompt-placeholders.ts` — never by mutating user prompt text
- When adding profile fields, update the type, defaults, settings UI, and a store migration ([ADR-0027](../data-and-state/0027-versioned-migration-chains.md))

### Don't

- Never hardcode model names, provider IDs, or prompt text in agent execution code
- Never remove or rename existing placeholders or profile fields (persisted data references them)

## Related Decisions

- [ADR-0006: MCP for Tool Extensibility](0006-mcp-for-tool-extensibility.md)
- [ADR-0009: Tool Approval and Autonomy Modes](0009-tool-approval-and-autonomy-modes.md)
- [ADR-0027: Versioned Migration Chains](../data-and-state/0027-versioned-migration-chains.md)
