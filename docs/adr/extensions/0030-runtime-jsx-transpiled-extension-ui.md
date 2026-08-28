# ADR-0030: Runtime-Transpiled Extension UI Components

## Status

Accepted (2026-08-28)

## Context

Extensions should be able to render UI into the app (custom panels, overlays, task components) without rebuilding AiderDesk. Extension code arrives as source (or bundled JS) at runtime, while the host app's renderer is a production React build — the host cannot `import` extension JSX at build time. A mechanism is needed to turn extension-provided component source into executable, React-compatible modules at load time, with React supplied by the host.

## Decision Drivers

- **Must** render extension-provided components inside the host renderer without a host rebuild
- **Must** not duplicate React inside extension bundles (single host React instance — hooks/context must work across the boundary)
- **Must** support TypeScript/JSX source from extensions (extension authors shouldn't need a bespoke build pipeline)
- **Should** keep the mechanism small and sandboxed-ish (transpile only; execution shares the renderer)

## Considered Options

### Option A — Extensions ship prebuilt UMD bundles requiring their own React

- **Pros**: No runtime transpilation.
- **Cons**: Second React instance breaks hooks/context across the boundary; bundles go stale against host versions.

### Option B — Runtime transpilation (sucrase) with host-provided React injection

- **Pros**: `packages/common/src/jsx-transpiler.ts` transpiles TSX source strings at load (sucrase, production mode); `prependCode`/`postpendCode` rewrite the module so the default export becomes `(React) => Component` — the host injects its own React; extensions author plain TSX with no build tooling.
- **Cons**: Transpile cost at load (small); extension code runs with renderer privileges (trust model documented below).

## Decision

Render extension UI via **runtime transpilation**: extension component source is transpiled with **sucrase** (`transpileJsxString` in `packages/common/src/jsx-transpiler.ts`) — prepending a React import and post-processing the export into a `(React) => Component` factory — then executed in the renderer with the **host's single React instance**. The extension manager triggers component loading/refresh through the extension hooks (`onComponentMount`-style lifecycle and UI refresh events, [ADR-0029](0029-lifecycle-hook-extension-system.md)), and rendered components refresh via the extension UI refresh mechanism (`ExtensionUIRefreshData` on the event bus, state in `extensionUIStore`).

## Rationale

Runtime transpilation removes the build step for extension authors entirely and — critically — the React-rewriting trick guarantees exactly one React instance, without which hooks and context bridging between host and extension components cannot work. Shipping source also keeps extensions inspectable.

## Consequences

### Positive

- Extension UI with zero build tooling and zero host rebuilds
- Single React instance: extension components use host context, portals, and hooks correctly
- Extensions stay reviewable as source

### Negative

- Extension UI code executes with full renderer privileges — the trust model is "extensions are trusted code" (same as npm dev dependencies)
- Transpile errors surface at load; error reporting must be clear

### Risks & Mitigations

- Risk: malicious extension UI exfiltrates data — Mitigation: extensions are user-installed and reviewed by users; permission-gate patterns exist for agent behavior; install flow shows sources

## Guardrails for Agents

### Do

- Keep the transpiler in `packages/common` environment-agnostic (string in, string out — no DOM/Node access)
- Preserve the `(React) => Component` export contract in any transpiler change; host React injection is the compatibility mechanism
- Route extension component refresh through the extension UI refresh event/store, not ad-hoc re-render hacks

### Don't

- Never bundle React (or a second copy of any host singleton) into extension UI code
- Never extend the transpiler into a general eval harness; it exists for component source only
- Never assume extension components can access host internals beyond the documented extension API

## Related Decisions

- [ADR-0029: Lifecycle-Hook Extension System](0029-lifecycle-hook-extension-system.md)
- [ADR-0003: Socket.IO Event Bus](../core-architecture/0003-socket-io-event-bus.md)
- [ADR-0021: Zustand for State, Context for DI](../frontend-ui/0021-zustand-for-state-context-for-di.md)
