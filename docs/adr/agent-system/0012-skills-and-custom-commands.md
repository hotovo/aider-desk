# ADR-0012: Skills and Custom Commands

## Status

Accepted (2026-08-28)

## Context

Users accumulate repeatable workflows: project-specific procedures (skills) and shell-oriented shortcuts (commands). Hardcoding workflows into agent prompts or the UI doesn't scale, doesn't transfer across projects, and can't be user-authored. Both mechanisms must be available to agents as tools and to users directly.

## Decision Drivers

- **Must** let users author both mechanisms without code changes
- **Must** expose them to agents as namespaced tools ([ADR-0008](0008-tool-group-namespacing-contracts.md)) and via the REST API
- **Must** propagate additions/changes live to the UI (event bus) and to running agents
- **Should** support global and per-project scope

## Considered Options

### Option A — Built-in prompts / hardcoded macros

- **Pros**: No loading infrastructure.
- **Cons**: Every workflow is a code change; no user sharing or per-project customization; agents can't discover them dynamically.

### Option B — Data-driven registries with managers

- **Pros**: `skill-manager.ts` loads `SKILL.md`-style skill definitions (name, description, instructions, supporting files) from project and global locations; `custom-command-manager.ts` handles command definitions; both publish `SkillDefinition`/commands data over the event bus (`SkillsUpdatedData`, `CommandsData`) so UI and agents stay in sync; extensions can contribute via their refresh hooks ([ADR-0029](../extensions/0029-lifecycle-hook-extension-system.md)).
- **Cons**: Needs discovery rules, validation, and refresh plumbing.

## Decision

Implement **skills** (`src/main/skills/skill-manager.ts`) and **custom commands** (`src/main/custom-commands/custom-command-manager.ts`) as data-driven registries. Skills are markdown-defined procedural knowledge discoverable by agents via the skills tool group; commands are user-defined invocations available in the prompt field and via `CommandsData` to all clients. Both managers reload on change and emit update events; both are exposed over REST (`skills-api.ts`, `commands-api.ts`) and usable in agent profiles. Command palette entries can reference UI actions and commands ([ADR-0022](../frontend-ui/0022-stable-ui-action-catalog.md)).

## Rationale

Registry + tool + event-bus propagation gives one implementation serving three consumers: the human (UI), the agent (tools), and external clients (REST). Data-driven definitions keep workflow iteration in the user's hands and make workflows project-portable (checked into the project's `.aider-desk` directory).

## Consequences

### Positive

- New workflows require no releases
- Agents discover and follow user-authored procedures reliably (names/descriptions are searchable)
- Project-level skills/commands travel with the repository

### Negative

- Malformed definitions need graceful validation and clear errors
- Two similar mechanisms (skills vs commands) require documentation to disambiguate: skills = procedural knowledge for agents; commands = user-invoked shortcuts

### Risks & Mitigations

- Risk: skill content with stale instructions misleads agents — Mitigation: skills are plain files users control; agent tool descriptions instruct contextual use

## Guardrails for Agents

### Do

- Load skills/commands exclusively through their managers; never scan user directories ad hoc
- When adding agent-facing behavior around skills, extend the existing skills tool group rather than creating parallel discovery tools
- Emit update events after any programmatic modification so all clients refresh

### Don't

- Never cache skill/command definitions in the renderer beyond the event-driven state — always trust the latest `SkillsUpdatedData`/`CommandsData`
- Never conflate skills and commands in UI or types; they have distinct purposes and schemas

## Related Decisions

- [ADR-0003: Socket.IO Event Bus](../core-architecture/0003-socket-io-event-bus.md)
- [ADR-0008: Tool Group Namespacing](0008-tool-group-namespacing-contracts.md)
- [ADR-0022: Stable UI Action Catalog](../frontend-ui/0022-stable-ui-action-catalog.md)
- [ADR-0029: Lifecycle-Hook Extension System](../extensions/0029-lifecycle-hook-extension-system.md)
