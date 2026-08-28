# ADR-0008: Tool Group Namespacing as Stable Contract

## Status

Accepted (2026-08-28)

## Context

Tools come from three sources — built-in groups (aider, memory, subagents, todo, power, skills), user MCP servers, and extension-provided tools ([ADR-0006](0006-mcp-for-tool-extensibility.md), [ADR-0029](../extensions/0029-lifecycle-hook-extension-system.md)). Tool names appear in persisted task contexts (every `ContextToolMessage` records the tool that ran), in agent profiles' tool-approval state (`ToolApprovalState` per tool name), in compaction/optimization rules, and in UI. Free-form naming would cause collisions between a user's MCP server named `memory` and the built-in memory tools, and any rename would corrupt historical context replay.

## Decision Drivers

- **Must** guarantee globally unique tool names across built-in, MCP, and extension sources
- **Must** keep tool identifiers stable across releases — they are persisted in task contexts and settings
- **Must** let subsystems (optimizer, compaction, approval, UI) identify tool *groups* without stringly-typed guesswork

## Considered Options

### Option A — Bare tool names, uniqueness by convention

- **Pros**: Shorter names in prompts.
- **Cons**: Collisions with user MCP servers; renames break persisted contexts and approval settings; group membership logic scattered as string comparisons.

### Option B — Central registry of group names + separator-based namespacing

- **Pros**: One module (`@common/tools`) exports every group and tool name constant plus `TOOL_GROUP_NAME_SEPARATOR`; names are globally unique by construction (`group<sep>tool`); all consumers import constants instead of literals.
- **Cons**: Slightly longer tool names consume prompt tokens; central file becomes a coordination point.

## Decision

All tool identity flows through **`packages/common/src/tools.ts`**: each built-in group exports its group name and per-tool name constants (e.g. `MEMORY_TOOL_GROUP_NAME`, `MEMORY_TOOL_RETRIEVE`, `POWER_TOOL_FILE_EDIT`, `AIDER_TOOL_GROUP_NAME`), and composed tool IDs are built/parsed with `TOOL_GROUP_NAME_SEPARATOR` (helpers like `extractServerNameToolName` in `@common/utils`). Consumers — the optimizer and smart compaction ([ADR-0010](0010-context-compaction-and-optimization.md)), the `ApprovalManager` ([ADR-0009](0009-tool-approval-and-autonomy-modes.md)), MCP wrapping ([ADR-0006](0006-mcp-for-tool-extensibility.md)), and UI rendering — import these constants; raw string literals for existing tool/group names are not allowed in feature code.

## Rationale

Persisted references (task contexts, approval state) make tool names *data contracts*, not implementation details. Centralizing them in a dependency-free common module makes the contract explicit, greppable, and import-safe from every process.

## Consequences

### Positive

- No name collisions between built-in groups, MCP servers, and extensions
- Compaction/optimization can reason about groups via constants, robustly
- Renames (if ever needed) happen in one auditable place with an explicit migration story

### Negative

- Tool names in prompts are longer (e.g. `memory__memory_retrieve`)
- Adding a tool requires touching the common registry

### Risks & Mitigations

- Risk: an agent "tidies up" and renames a constant, breaking persisted contexts — Mitigation: guardrails below; code review/typecheck catches missing constant imports

## Guardrails for Agents

### Do

- Always import tool/group name constants from `@common/tools`; build composite names with `TOOL_GROUP_NAME_SEPARATOR`
- When adding a tool, define its name constant in `packages/common/src/tools.ts` and use it in schema, execution, approval defaults, and UI
- When parsing a namespaced tool name, use the provided helpers (`extractServerNameToolName`), never `split` with a hardcoded separator

### Don't

- Never rename or remove an existing tool/group constant — they are persisted contracts; if truly required, supersede via a new ADR with a migration
- Never create a built-in group whose name could collide with user MCP server names; keep the `group<sep>tool` format for all identities
- Never write raw string literals like `'memory__memory_store'` in feature code

## Related Decisions

- [ADR-0006: MCP for Tool Extensibility](0006-mcp-for-tool-extensibility.md)
- [ADR-0009: Tool Approval and Autonomy Modes](0009-tool-approval-and-autonomy-modes.md)
- [ADR-0010: Context Compaction and Prompt Optimization](0010-context-compaction-and-optimization.md)
