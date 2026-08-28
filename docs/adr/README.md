# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for AiderDesk. ADRs capture significant architectural decisions — the context, the options considered, the decision, its rationale, and its consequences — so that future engineers **and AI agents** can understand *why* the code is the way it is, not just *what* it is.

## Purpose: Guardrails for Agents

AiderDesk development is heavily agent-assisted. Every ADR therefore includes a **Guardrails for Agents** section with concrete do/don't rules. When working on a new feature, read the ADRs for the contexts you are touching and obey their guardrails. If a change conflicts with an ADR, either update the ADR first (via a superseding ADR) or change the approach.

## Organization

ADRs are grouped into context directories. **Numbering is global and sequential** across all contexts.

| Context | Scope |
|---------|-------|
| `core-architecture/` | Electron process model, IPC bridge, event bus, TypeScript setup |
| `agent-system/` | Agent runtime, MCP, profiles, approval, compaction, memory, skills |
| `model-integration/` | LLM provider adapters and caching |
| `aider-integration/` | Python connector bridge and Aider coexistence |
| `task-and-project/` | Task lifecycle, persistence, git worktrees |
| `api-surface/` | REST API, MCP server package, remote access |
| `frontend-ui/` | React state, UI actions, i18n, components, workers |
| `data-and-state/` | Persistence, migrations, renderer-side storage |
| `extensions/` | Extension hooks and extension UI |
| `packages-monorepo/` | Workspace layout, versioning policy, generated types |
| `platform-services/` | Telemetry, terminal, code graph, voice |
| `security/` | Isolation, secrets, readonly mode |
| `testing-tooling/` | Test setup and build system |

## Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [0001](core-architecture/0001-electron-multi-process-model.md) | Electron Multi-Process Model | Accepted | 2026-08-28 |
| [0002](core-architecture/0002-preload-ipc-bridge-and-api-contract.md) | Preload IPC Bridge and Shared API Contract | Accepted | 2026-08-28 |
| [0003](core-architecture/0003-socket-io-event-bus.md) | Socket.IO Event Bus for Push Events | Accepted | 2026-08-28 |
| [0004](core-architecture/0004-typescript-project-references.md) | TypeScript Project References (node/web split) | Accepted | 2026-08-28 |
| [0005](agent-system/0005-vercel-ai-sdk-as-agent-runtime.md) | Vercel AI SDK as Agent Runtime | Accepted | 2026-08-28 |
| [0006](agent-system/0006-mcp-for-tool-extensibility.md) | MCP for Tool Extensibility | Accepted | 2026-08-28 |
| [0007](agent-system/0007-agent-profiles-and-system-prompts.md) | Agent Profiles and System Prompts | Accepted | 2026-08-28 |
| [0008](agent-system/0008-tool-group-namespacing-contracts.md) | Tool Group Namespacing as Stable Contract | Accepted | 2026-08-28 |
| [0009](agent-system/0009-tool-approval-and-autonomy-modes.md) | Tool Approval and Autonomy Modes | Accepted | 2026-08-28 |
| [0010](agent-system/0010-context-compaction-and-optimization.md) | Context Compaction and Prompt Optimization | Accepted | 2026-08-28 |
| [0011](agent-system/0011-agent-memory-system.md) | Local Vector Memory System | Accepted | 2026-08-28 |
| [0012](agent-system/0012-skills-and-custom-commands.md) | Skills and Custom Commands | Accepted | 2026-08-28 |
| [0013](model-integration/0013-provider-adapter-registry.md) | Model Provider Adapter Registry | Accepted | 2026-08-28 |
| [0014](aider-integration/0014-python-connector-bridge.md) | Python Connector Bridge to Aider | Accepted | 2026-08-28 |
| [0015](aider-integration/0015-aider-vs-agent-mode-coexistence.md) | Aider Mode and Agent Mode Coexistence | Accepted | 2026-08-28 |
| [0016](task-and-project/0016-task-lifecycle-and-persistence.md) | Task Lifecycle and Persistence | Accepted | 2026-08-28 |
| [0017](task-and-project/0017-git-worktree-integration.md) | Git Worktree Integration | Accepted | 2026-08-28 |
| [0018](api-surface/0018-rest-api-base-pattern.md) | REST API Base Pattern and Domain Split | Accepted | 2026-08-28 |
| [0019](api-surface/0019-standalone-mcp-server-package.md) | Standalone MCP Server Package | Accepted | 2026-08-28 |
| [0020](api-surface/0020-remote-access-tunnel-and-readonly-mode.md) | Remote Access: Tunnel and Readonly Mode | Accepted | 2026-08-28 |
| [0021](frontend-ui/0021-zustand-for-state-context-for-di.md) | Zustand for State, Context for Dependency Injection | Accepted | 2026-08-28 |
| [0022](frontend-ui/0022-stable-ui-action-catalog.md) | Stable UI Action Catalog | Accepted | 2026-08-28 |
| [0023](frontend-ui/0023-i18n-all-locales.md) | Internationalization for All User-Facing Strings | Accepted | 2026-08-28 |
| [0024](frontend-ui/0024-component-conventions.md) | React Component Conventions | Accepted | 2026-08-28 |
| [0025](frontend-ui/0025-web-workers-for-heavy-compute.md) | Web Workers for Heavy Computation | Accepted | 2026-08-28 |
| [0026](data-and-state/0026-central-data-manager.md) | Domain-Owned Persistence Backends | Accepted | 2026-08-28 |
| [0027](data-and-state/0027-versioned-migration-chains.md) | Versioned Migrations for Evolving Stored Data | Accepted | 2026-08-28 |
| [0028](data-and-state/0028-renderer-local-persistence.md) | Renderer-Side Local Persistence | Accepted | 2026-08-28 |
| [0029](extensions/0029-lifecycle-hook-extension-system.md) | Lifecycle-Hook Extension System | Accepted | 2026-08-28 |
| [0030](extensions/0030-runtime-jsx-transpiled-extension-ui.md) | Runtime-Transpiled Extension UI Components | Accepted | 2026-08-28 |
| [0031](packages-monorepo/0031-npm-workspaces-monorepo.md) | npm Workspaces Monorepo Layout | Accepted | 2026-08-28 |
| [0032](packages-monorepo/0032-exact-version-pinning.md) | Exact Version Pinning for Published Packages | Accepted | 2026-08-28 |
| [0033](packages-monorepo/0033-generated-extension-types.md) | Generated Extension Type Declarations | Accepted | 2026-08-28 |
| [0034](platform-services/0034-telemetry-abstraction.md) | Centralized Product Telemetry and LLM Observability | Accepted | 2026-08-28 |
| [0035](platform-services/0035-pty-terminal-integration.md) | PTY-Based Integrated Terminal | Accepted | 2026-08-28 |
| [0036](platform-services/0036-tree-sitter-code-graph.md) | Reusable Tree-Sitter Code Analysis Package | Accepted | 2026-08-28 |
| [0037](platform-services/0037-provider-side-voice-transcription.md) | Renderer-Side Realtime Voice Transcription | Accepted | 2026-08-28 |
| [0038](security/0038-context-isolation-secrets-readonly.md) | Electron Trust Boundaries, Secrets, and Readonly Access | Accepted | 2026-08-28 |
| [0039](testing-tooling/0039-vitest-multi-config-and-playwright.md) | Vitest Multi-Config Testing and Playwright E2E | Accepted | 2026-08-28 |
| [0040](testing-tooling/0040-electron-vite-build-system.md) | electron-vite Build System | Accepted | 2026-08-28 |

## Creating a New ADR

1. Copy `template.md` to the appropriate context directory as `NNNN-short-title.md`, where `NNNN` is the next global number (check the index above; numbering is global, not per-directory).
2. Fill in all sections. Be specific: name real files, types, and modules.
3. Fill in the **Guardrails for Agents** section — this is mandatory and is the primary reason ADRs exist in this project.
4. Cross-link related ADRs (relative links) and update the index table above.
5. If the new ADR replaces an existing decision, mark the old one `Superseded by ADR-NNNN` — never edit an Accepted ADR's decision in place.

## Review Checklist

Before accepting an ADR:

- Trace the relevant call path and verify every named file, type, setting default, and runtime boundary against the current source.
- Separate current behavior from a desired future state. Use **Proposed** when the implementation does not yet match the decision.
- Avoid absolute security, privacy, durability, or compatibility claims unless the code enforces them across every documented exception.
- State important exceptions explicitly, especially renderer credentials, telemetry consent, readonly capabilities, generated artifacts, and domain-specific persistence.
- Check all relative ADR links and update this index when titles, statuses, or files change.
- Include external references when they explain a technology choice; omit the References section when there are none.

## ADR Status Values

- **Proposed** — under discussion
- **Accepted** — decision made; describes current architecture
- **Deprecated** — no longer relevant
- **Superseded** — replaced by a newer ADR
- **Rejected** — considered but not adopted (still valuable context)

## Provenance Note

The ADRs in this set were written retroactively (2026-08-28) by analyzing the existing codebase. They document *de-facto* decisions — the architecture as it is — reconstructed from source. Where the historical rationale involved judgment calls, the recorded trade-offs reflect what the code actually optimizes for. Treat them as descriptive of current architecture and prescriptive for future changes.
