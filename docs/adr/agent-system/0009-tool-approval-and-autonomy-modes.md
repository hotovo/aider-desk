# ADR-0009: Tool Approval and Autonomy Modes

## Status

Accepted (2026-08-28)

## Context

Agents execute tools that can read/write files and run shell commands — actions users must be able to constrain. At the same time, fully manual approval for every call makes autonomous workflows unusable. The system needs a graduated trust model: per-run, per-tool, per-profile, and per-task control, with third parties (extensions) able to veto or allow calls.

## Decision Drivers

- **Must** default to safe behavior: unapproved tool calls wait for user consent
- **Must** support autonomous operation (tasks run unattended, e.g. delegated/background subtasks)
- **Must** let extensions intercept approvals (block/allow) — e.g. policy guardrails
- **Should** remember "always allow" decisions per run without leaking them across runs

## Considered Options

### Option A — Global allow-list of trusted tools

- **Pros**: Simple.
- **Cons**: One-size-fits-all; no per-task autonomy; extensions cannot intervene; dangerous for arbitrary user MCP tools.

### Option B — Layered approval: autonomy mode + per-tool state + extension veto + per-run memory

- **Pros**: Manual/Guided/Autonomous modes set the default posture; `ToolApprovalState` (per profile, per tool) records standing grants; extensions get a blocking hook; "always approve" is scoped to the current run via keys.
- **Cons**: More states to reason about and to surface in UI.

## Decision

Implement tool governance as a **layered pipeline** in `ApprovalManager` (`src/main/agent/tools/approval-manager.ts`), instantiated per task with its `AgentProfile`:

1. **Extension gate** — `dispatchExtensionEvent('onToolApproval', …)` runs first; extensions may `block` (with reason) or `allow` ([ADR-0029](../extensions/0029-lifecycle-hook-extension-system.md))
2. **Autonomy mode** — `task.autonomyMode !== AutonomyMode.Manual` auto-approves (`isAutoApprove`); Manual mode requires consent per unapproved call
3. **Standing grants** — `ToolApprovalState` stored on the profile/tool decides without prompting
4. **Run-scoped memory** — `alwaysApproveForRunKeys` grants "always allow for this run" without persisting it

Questions that need user input surface as `QuestionData` over the event bus ([ADR-0003](../core-architecture/0003-socket-io-event-bus.md)). Autonomy mode is a task-level property (`AutonomyMode`: Manual/Guided/Autonomous, `DEFAULT_AUTONOMY_MODE` in `@common/types`) set per task or inherited from the launching context.

## Rationale

Layering matches real usage: interactive sessions want Manual/Guided with remembered grants; delegated background tasks need Autonomous; enterprise/policy extensions need a veto point before anything executes. Scoping "always approve" to the run prevents a one-session grant from silently becoming permanent.

## Consequences

### Positive

- One invocation path governs built-in and MCP tools alike ([ADR-0006](0006-mcp-for-tool-extensibility.md))
- Extensions can implement org-wide guardrails without core changes
- Autonomous background tasks are possible without disabling safety globally

### Negative

- Approval state adds UI (settings per profile) and persistence considerations
- Subtle bugs (e.g. over-broad run keys) have safety implications; the layering must be kept in order

### Risks & Mitigations

- Risk: new code path bypasses approval — Mitigation: all tool execution funnels through managers that consult `ApprovalManager`; guardrails below

## Guardrails for Agents

### Do

- Add every new tool's default `ToolApprovalState` when registering the tool; default to the restrictive side
- Route interactive consent through `QuestionData` events, never through blocking main-process dialogs
- Preserve the layer order: extension gate → autonomy mode → standing grants → run keys

### Don't

- Never auto-approve tools outside `ApprovalManager` (no side-channel execution)
- Never persist run-scoped "always allow" decisions
- Never treat `Autonomous` as "skip extensions" — the extension gate runs in every mode

## Related Decisions

- [ADR-0003: Socket.IO Event Bus](../core-architecture/0003-socket-io-event-bus.md)
- [ADR-0006: MCP for Tool Extensibility](0006-mcp-for-tool-extensibility.md)
- [ADR-0029: Lifecycle-Hook Extension System](../extensions/0029-lifecycle-hook-extension-system.md)
