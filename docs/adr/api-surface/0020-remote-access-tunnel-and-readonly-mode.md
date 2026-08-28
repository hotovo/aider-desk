# ADR-0020: Remote Access: Tunnel and Readonly Mode

## Status

Accepted (2026-08-28)

## Context

The app's UI runs locally, but there are two important remote scenarios: (1) exposing the local server to other devices/networks without VPN or port forwarding, and (2) letting external viewers (dashboards, teammates, read-only consumers) observe activity without granting control. Both reuse the same server stack, but differ sharply in granted capabilities.

## Decision Drivers

- **Must** support secure exposure of the local server beyond localhost (tunneling)
- **Must** offer a strictly read-only access mode — viewers must never be able to mutate projects/tasks/settings
- **Must** enforce readonly at the server boundary, not by UI convention
- **Should** reuse the existing REST + event-bus stack rather than building a second serving path

## Considered Options

### Option A — Manual port forwarding / user-managed reverse proxies

- **Pros**: No app code.
- **Cons**: Poor UX, security-critical setup left to users, no readonly concept.

### Option B — Built-in Cloudflare tunnel + server-enforced readonly mode

- **Pros**: `cloudflare-tunnel-manager.ts` manages tunnel lifecycle in-app; `readonly.ts` + `ReadonlyApiContext` enforce read-only semantics centrally; readonly connectors subscribe to a filtered event stream ([ADR-0003](../core-architecture/0003-socket-io-event-bus.md)) and a dedicated `readonly-api.ts` surface.
- **Cons**: Tunnel dependency/availability; readonly enforcement must be kept complete as endpoints grow.

## Decision

Provide **remote access** through two cooperating mechanisms in `src/main/server/`:

1. **Tunnel**: `cloudflare-tunnel-manager.ts` creates/manages a Cloudflare tunnel to the local server, so remote clients reach the REST API + socket bus over a public URL without network configuration.
2. **Readonly mode**: a server-level mode (`readonly.ts`) that swaps in `ReadonlyApiContext` — exposing only the `readonly-api.ts` surface and `readonly` event connectors. Mutating REST endpoints and events are unreachable; enforcement is server-side and default-on for readonly connections.

The renderer already supports both transports transparently ([ADR-0002](../core-architecture/0002-preload-ipc-bridge-and-api-contract.md)), so remote browsers get the full (or readonly) UI with no separate build.

## Rationale

Server-boundary enforcement is the only trustworthy readonly guarantee — UI hiding is bypassable. Reusing one server stack for local, tunneled, and readonly access keeps a single code path to secure and test.

## Consequences

### Positive

- Zero-config remote access; readonly observation is a first-class, safe capability
- One security boundary to audit (the server), enforced independent of clients
- Browser clients need no special build

### Negative

- Every new endpoint must respect readonly classification
- External tunnel availability becomes a runtime dependency for that feature

### Risks & Mitigations

- Risk: a mutating endpoint accidentally exposed in readonly mode — Mitigation: readonly surface is an explicit allow-list (`readonly-api.ts`), not a block-list; default is denial

## Guardrails for Agents

### Do

- Classify every new REST endpoint for readonly exposure: add to `readonly-api.ts` only if genuinely read-only
- Test new endpoints against readonly mode (must fail/omit, not leak)
- Keep tunnel management lifecycle-aware (start/stop/retry) within its manager

### Don't

- Never implement readonly by hiding UI elements only — the server must refuse
- Never widen the readonly surface "temporarily" for convenience
- Never expose management endpoints (settings writes, project control) through the tunnel without explicit product sign-off

## Related Decisions

- [ADR-0002: Preload IPC Bridge](../core-architecture/0002-preload-ipc-bridge-and-api-contract.md)
- [ADR-0003: Socket.IO Event Bus](../core-architecture/0003-socket-io-event-bus.md)
- [ADR-0018: REST API Base Pattern](0018-rest-api-base-pattern.md)
- [ADR-0038: Electron Trust Boundaries, Secrets, and Readonly Access](../security/0038-context-isolation-secrets-readonly.md)
