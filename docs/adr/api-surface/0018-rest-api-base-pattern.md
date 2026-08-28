# ADR-0018: REST API Base Pattern and Domain Split

## Status

Accepted (2026-08-28)

## Context

Beyond the Electron IPC bridge, AiderDesk exposes an HTTP API: the browser-mode renderer consumes it ([ADR-0002](../core-architecture/0002-preload-ipc-bridge-and-api-contract.md)), the standalone MCP server package talks to it ([ADR-0019](0019-standalone-mcp-server-package.md)), and external tooling uses it directly. Dozens of endpoints across many domains (projects, tasks, agents, providers, settings, terminal, voice, …) need uniform validation, error shape, project resolution, and structure — or the surface becomes inconsistent and unauditable.

## Decision Drivers

- **Must** validate all inputs at the boundary (untrusted clients exist: browser mode, external callers)
- **Must** return consistent error shapes/status codes across all endpoints
- **Must** scope most operations to a specific started project (`projectDir` parameter)
- **Should** make adding an endpoint a local, pattern-following change

## Considered Options

### Option A — Free-form Express routes per feature

- **Pros**: Fastest to write.
- **Cons**: Validation/error handling drift; no shared project resolution; inconsistent 400/404/500 semantics.

### Option B — `BaseApi` template-method base class + one file per domain

- **Pros**: `base-api.ts` centralizes `findProject` (404 for unknown/not-started projects), `handleRequest` (uniform 500 with logged details), `validateRequest` (Zod → 400 with issues); each domain extends `BaseApi` and implements `registerRoutes(router)`; 20 domain modules (`project-api.ts`, `agent-api.ts`, `settings-api.ts`, …) keep ownership clear; Zod schemas document every endpoint.
- **Cons**: Boilerplate per domain module; base class changes affect all modules.

## Decision

Structure the REST server (`src/main/server/rest-api/`) as **domain modules extending the abstract `BaseApi` class**, registered on a shared Express router with Zod validation for every request body/params. Cross-cutting concerns live in the server layer: CORS (`cors.ts`), readonly gating ([ADR-0020](0020-remote-access-tunnel-and-readonly-mode.md)), and a server controller/runner managing lifecycle. The `browser-api.ts` renderer client mirrors these endpoints ([ADR-0002](../core-architecture/0002-preload-ipc-bridge-and-api-contract.md)); realtime flows bypass REST via the socket event bus ([ADR-0003](../core-architecture/0003-socket-io-event-bus.md)).

## Rationale

The template-method pattern buys uniform correctness (validation, errors, project scoping) for free, and the domain split keeps the surface navigable and reviewable. Zod schemas double as executable API documentation and are the single validation point.

## Consequences

### Positive

- Consistent error contract for all clients; easy to add clients (MCP server, scripts)
- New domains are copy-paste-pattern modules with immediate conformance
- Project-scoped safety check (started project exists) is unskippable

### Negative

- Two definition sites per UI capability (API interface + REST module) that must stay aligned
- Express router grows large; registration order matters for middleware

### Risks & Mitigations

- Risk: endpoints added without Zod validation — Mitigation: guardrails below; `validateRequest` is the only sanctioned way to read bodies

## Guardrails for Agents

### Do

- Add new endpoint groups as a new `*-api.ts` module extending `BaseApi`, implementing `registerRoutes`
- Validate every input with a Zod schema via `validateRequest`; use `findProject` for project-scoped routes; wrap handlers in `handleRequest`
- Keep response errors in the established shape: `{ error, message?/details? }` with correct status codes

### Don't

- Never read `req.body`/`req.query` without Zod validation
- Never implement cross-cutting logic (auth, CORS, readonly) inside domain modules — it belongs in the server layer
- Never bypass the REST layer by reaching into managers from `browser-api.ts` without a matching endpoint

## Related Decisions

- [ADR-0002: Preload IPC Bridge and Shared API Contract](../core-architecture/0002-preload-ipc-bridge-and-api-contract.md)
- [ADR-0003: Socket.IO Event Bus](../core-architecture/0003-socket-io-event-bus.md)
- [ADR-0019: Standalone MCP Server Package](0019-standalone-mcp-server-package.md)
- [ADR-0020: Remote Access](0020-remote-access-tunnel-and-readonly-mode.md)
