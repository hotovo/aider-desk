# ADR-0019: Standalone MCP Server Package

## Status

Accepted (2026-08-28)

## Context

Users want AiderDesk capabilities (task state, prompts, context files) inside *other* AI clients — Claude Desktop, Cursor, etc. Embedding the Electron app there is impossible; a separate thin server that bridges MCP clients to a running AiderDesk instance is the natural fit. It must be publishable as its own npm package, independent of Electron, and track the app's API without bundling the whole application.

## Decision Drivers

- **Must** be consumable by any MCP client as a standard MCP server
- **Must** stay Electron-free and lightweight (buildable with esbuild)
- **Must** operate against a *running* AiderDesk instance (the app owns projects/tasks) rather than duplicating state
- **Should** reuse shared types from `@aiderdesk/common` to stay in sync ([ADR-0031](../packages-monorepo/0031-npm-workspaces-monorepo.md))

## Considered Options

### Option A — Expose Electron IPC / internal modules directly

- **Pros**: No translation layer.
- **Cons**: Requires the Electron app in-process; unusable from external clients; couples consumers to internals.

### Option B — Separate MCP server package proxying the REST API

- **Pros**: `packages/mcp-server` speaks MCP (tools/resources) externally and the REST API ([ADR-0018](0018-rest-api-base-pattern.md)) internally; publishes as `@aiderdesk/mcp-server`; esbuild bundle keeps it small; AiderDesk remains the single source of truth.
- **Cons**: REST surface must remain stable — the package is an external consumer; latency of HTTP hop (negligible locally).

## Decision

Ship **`packages/mcp-server`** (`@aiderdesk/mcp-server`), a standalone Electron-free MCP server that exposes AiderDesk functionality (projects, tasks, context, prompts) as MCP tools, proxying all operations to a running AiderDesk instance via its REST API. It shares types with the app through `@aiderdesk/common` and is built with esbuild (per the build system, [ADR-0040](../testing-tooling/0040-electron-vite-build-system.md)), published per the monorepo versioning policy ([ADR-0032](../packages-monorepo/0032-exact-version-pinning.md)).

## Rationale

Proxying REST keeps exactly one implementation of business logic (the app) and makes the MCP surface a thin adapter — cheap to maintain, impossible to desynchronize semantically. Independence from Electron is what makes external adoption possible at all.

## Consequences

### Positive

- Any MCP client gains AiderDesk integration with zero app changes
- REST contract discipline improves (a real external consumer exists)
- Small, fast builds; trivial deployment (npx)

### Negative

- Requires a running AiderDesk instance; nothing works headless against closed app
- Breaking REST changes must consider the MCP server as a downstream consumer

### Risks & Mitigations

- Risk: MCP tools lag behind new app features — Mitigation: additive REST endpoints are easy to surface; package version bumps ride the release flow ([ADR-0032](../packages-monorepo/0032-exact-version-pinning.md))

## Guardrails for Agents

### Do

- Keep `packages/mcp-server` free of Electron and main-process imports; REST + `@aiderdesk/common` only
- When adding REST endpoints intended for external use, expose and document them via the MCP server tools
- Treat the REST API as a public contract in reviews — check MCP server impact

### Don't

- Never duplicate business logic in the MCP server; it translates, it doesn't implement
- Never introduce state in the MCP server beyond connection config; the app owns all data
- Never break REST endpoints without checking `packages/mcp-server` usage

## Related Decisions

- [ADR-0018: REST API Base Pattern](0018-rest-api-base-pattern.md)
- [ADR-0031: npm Workspaces Monorepo](../packages-monorepo/0031-npm-workspaces-monorepo.md)
- [ADR-0032: Exact Version Pinning](../packages-monorepo/0032-exact-version-pinning.md)
