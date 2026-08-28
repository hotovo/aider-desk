# ADR-0029: Lifecycle-Hook Extension System

## Status

Accepted (2026-08-28)

## Context

Third parties need to extend agent behavior: enforce tool policies, redact secrets in tool results, add tools/commands/UI. Allowing arbitrary code inside the core agent is a maintenance and security hazard; refusing extensibility strands power users. The system needs a stable, typed contract through which extensions observe and influence the agent/task lifecycle — without core code knowing individual extensions.

## Decision Drivers

- **Must** define a typed, versioned extension API surface, publishable as types (`@aiderdesk/extensions`)
- **Must** let extensions intervene at critical points (tool approval, tool completion) with block/allow/rewrite semantics
- **Must** keep extension failures isolated from core stability
- **Should** allow extensions to contribute tools, commands, modes, agents, and UI, with the core notified via refresh hooks

## Considered Options

### Option A — Plugins patch core objects at runtime (monkey-patching)

- **Pros**: Total flexibility.
- **Cons**: Untyped, unversioned, fragile against refactors; security nightmare; impossible to audit.

### Option B — Explicit lifecycle hook interface dispatched by an extension manager

- **Pros**: `packages/common/src/extensions.ts` defines the `Extension` interface (~1700+ lines of documented hooks: `onToolCalled`, `onToolFinished`, `onToolApproval`, `onResponseCompleted`, refresh triggers for tools/commands/modes/agents/components); `extension-manager.ts`, `extension-loader.ts`, `extension-registry.ts`, `extension-context.ts` load, register, and dispatch events; dispatch returns structured results (`blocked`/`allowed`) that core respects; extensions fetched from a registry (`extension-fetcher.ts`); failures are contained per extension.
- **Cons**: Hook interface must evolve carefully (it is a public contract); every new extension point requires a core-side dispatch site.

## Decision

Implement extensibility as a **typed lifecycle-hook system**: extensions implement the `Extension` interface from `packages/common/src/extensions.ts` (published types; `extensions.d.ts` is generated from it — [ADR-0033](../packages-monorepo/0033-generated-extension-types.md)). The main-process `ExtensionManager` loads extensions, hands them an `ExtensionContext` (API access, task/project context), and dispatches lifecycle events. Dispatch results are contractual: `onToolApproval` may `block` (with reason) or `allow` and the `ApprovalManager` obeys ([ADR-0009](../agent-system/0009-tool-approval-and-autonomy-modes.md)); `onToolFinished` may rewrite results. Extensions register tools, commands, modes, agents, and UI components; the core learns of changes via explicit refresh callbacks. The extension UI surface is covered in [ADR-0030](0030-runtime-jsx-transpiled-extension-ui.md).

## Rationale

A documented, typed hook interface keeps the core unaware of specific extensions while guaranteeing (via structured dispatch results) that extension verdicts actually gate behavior. Isolated loading/registration confines failures, and the published types make third-party development stable across releases.

## Consequences

### Positive

- Policy/security extensions (permission gates, redaction) work without core changes
- Extension contributions (tools/commands/UI) integrate through one mechanism
- The hook file is the single public contract to review for breaking changes

### Negative

- Core dispatch sites must be maintained at every extension point
- Hook signature changes are breaking; evolution needs deprecation discipline

### Risks & Mitigations

- Risk: new features bypass extension hooks (behavior extensions can't see) — Mitigation: when adding tool/agent lifecycle steps, evaluate whether a dispatch belongs there; guardrails below

## Guardrails for Agents

### Do

- Treat `packages/common/src/extensions.ts` as a public API: additive changes only; update docs and regenerate types ([ADR-0033](../packages-monorepo/0033-generated-extension-types.md))
- Respect dispatch results wherever they gate behavior (approval, tool results) — never ignore an extension verdict
- Dispatch extension events at meaningful lifecycle steps for new agent/task capabilities

### Don't

- Never import or depend on specific extensions in core code; core knows only the interface
- Never let an extension failure crash the agent — catch, log, continue
- Never change hook semantics (e.g. when `onToolApproval` fires) without an ADR-level decision

## Related Decisions

- [ADR-0009: Tool Approval and Autonomy Modes](../agent-system/0009-tool-approval-and-autonomy-modes.md)
- [ADR-0030: Runtime-Transpiled Extension UI](0030-runtime-jsx-transpiled-extension-ui.md)
- [ADR-0033: Generated Extension Types](../packages-monorepo/0033-generated-extension-types.md)
