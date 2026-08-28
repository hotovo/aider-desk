# ADR-0014: Python Connector Bridge to Aider

## Status

Accepted (2026-08-28)

## Context

Aider — the AI pair-programming engine for repo editing — is a Python application. AiderDesk is TypeScript/Electron. Aider brings years of battle-tested repo-map, edit-format, and git-integration behavior that would be prohibitive to reimplement in TS, but it must be embedded into AiderDesk's lifecycle: one Aider instance per project, with bidirectional streaming of prompts, responses, context-file changes, questions, and repo maps.

## Decision Drivers

- **Must** reuse Aider's engine rather than reimplement it
- **Must** run one isolated Aider process per project (independent state, lifecycles)
- **Must** support bidirectional, streaming, typed communication (prompts in; response chunks, questions, tokens, autocompletion, repo map out)
- **Should** be treatable as a separate deployment unit (Docker images, connector-only environments)

## Considered Options

### Option A — Port Aider logic to TypeScript

- **Pros**: Single language; no process management.
- **Cons**: Enormous reimplementation effort; permanent upgrade lag behind upstream Aider; loses Python ecosystem (models, tooling).

### Option B — Out-of-process Python connector speaking a typed socket protocol

- **Pros**: Aider stays upstream-true inside `resources/connector/connector.py`; per-project process isolation; Socket.IO protocol with a typed message union and type guards (`isPromptFinishedMessage`, `isUpdateRepoMapMessage`, …) keeps both sides honest; process runs headless in Docker.
- **Cons**: Process + Python environment lifecycle management (installation via `python-dependencies-installer.ts`, health via `useAiderConnectorStatus`/`usePythonInstallStatus`); protocol is a versioned contract across languages.

## Decision

Integrate Aider through a **dedicated Python connector process** per project: `connector-manager.ts` spawns and supervises `resources/connector/connector.py`, communicating over **Socket.IO** with a closed set of typed messages guarded by `is*Message` type guards (`connector.ts`, `connector-auth.ts` for authentication). The manager adapts connector messages to AiderDesk events ([ADR-0003](../core-architecture/0003-socket-io-event-bus.md)) and task state; questions from Aider flow to the UI as `QuestionData`; context-file and repo-map updates flow back. The connector protocol is intentionally narrow — everything else (UI, agents, storage) is TypeScript-side.

## Rationale

An out-of-process bridge is the only option that preserves upstream Aider fidelity while fitting AiderDesk's multi-project, event-driven architecture. The typed message union makes the cross-language boundary reviewable and testable, and process isolation means a wedged Aider never takes the app down.

## Consequences

### Positive

- Upstream Aider features arrive by bumping the connector's Aider dependency
- Crashes/hangs are contained per project and restartable
- The same connector serves server/Docker deployments

### Negative

- Users need a Python environment (mitigated by the installer + status UI)
- Protocol changes require synchronized updates in two languages

### Risks & Mitigations

- Risk: protocol drift between TS and Python sides — Mitigation: closed message union with type guards on both sides; changes are explicitly reviewed at the boundary

## Guardrails for Agents

### Do

- Modify connector messages in pairs: Python message class + TS type guard/adapter, keeping the union closed
- Route all connector events through the connector manager into the event bus — never let UI subscribe to connector sockets directly
- Treat connector startup failures as recoverable: surface status, allow retry

### Don't

- Never add business logic to `connector.py` beyond Aider adaptation; agent logic stays in TypeScript
- Never assume the connector is fast or immortal — every call path needs timeout/restart behavior
- Never break existing message fields; protocol is versioned in practice

## Related Decisions

- [ADR-0003: Socket.IO Event Bus](../core-architecture/0003-socket-io-event-bus.md)
- [ADR-0015: Aider Mode and Agent Mode Coexistence](0015-aider-vs-agent-mode-coexistence.md)
- [ADR-0016: Task Lifecycle and Persistence](../task-and-project/0016-task-lifecycle-and-persistence.md)
