# ADR-0040: electron-vite Build System

## Status

Accepted (2026-08-28)

## Context

An Electron app needs coordinated builds for three targets with different formats: main process (Node CJS/ESM), preload (sandboxed bridge), and renderer (browser bundle with code splitting), plus HMR for productive UI development — and the repo additionally builds the MCP server package (standalone, no Electron) and published packages. A hand-rolled Webpack/Gulp matrix would be slow to evolve and hard for contributors (and agents) to reason about.

## Decision Drivers

- **Must** build main, preload, and renderer with correct per-target formats and externals
- **Must** provide fast dev mode with HMR (`npm run dev`, `dev:no-hmr`) and full builds with type checking (`npm run build`)
- **Must** produce platform packages via electron-builder (`build:win/mac/linux`, `build:unpack`)
- **Should** share configuration philosophy with the frontend ecosystem (Vite) and keep the MCP server buildable independently (esbuild)

## Considered Options

### Option A — Custom Webpack configuration

- **Pros**: Max control.
- **Cons**: Heavy config maintenance; slower dev iteration; HMR across three targets is manual work; steeper contributor ramp-up.

### Option B — electron-vite (+ esbuild for the MCP server)

- **Pros**: `electron.vite.config.ts` configures main/preload/renderer in one file with Vite ergonomics; built-in HMR in dev; renderer gets standard Vite asset/CSS handling (Tailwind, PostCSS: `postcss.config.js`, `tailwind.config.js`); integrates with the tsconfig split via build-time typecheck (`npm run build` includes type checking); `vite.config.server.ts` covers server-side build needs; `packages/mcp-server` bundles with esbuild directly (Electron-free, [ADR-0019](../api-surface/0019-standalone-mcp-server-package.md)); electron-builder handles packaging per OS.
- **Cons**: electron-vite version coupling with Electron/Vite majors; worker/native-module edge cases need config attention.

## Decision

Build with **electron-vite**, configured in `electron.vite.config.ts` for the three Electron targets, with **esbuild** bundling the standalone MCP server package and **electron-builder** (`electron-builder.yml`) producing OS packages. Development runs `npm run dev` (HMR; `dev:no-hmr` variant); `npm run build` performs type checking (both tsconfigs, [ADR-0004](../core-architecture/0004-typescript-project-references.md)) and full builds; platform scripts (`build:win`, `build:mac`, `build:linux`, `build:unpack`) wrap electron-builder. Web-worker and asset handling follows Vite conventions ([ADR-0025](../frontend-ui/0025-web-workers-for-heavy-compute.md)).

## Rationale

electron-vite is the community-standard path for new Electron apps: it keeps the three-target complexity inside one well-documented tool, gives instant HMR for renderer work, and composes with the existing Vite-shaped config ecosystem (Tailwind/PostCSS). Keeping the MCP server on bare esbuild preserves its Electron-free, publishable nature.

## Consequences

### Positive

- One mental model for dev and prod builds across targets
- Fast UI iteration via HMR; typecheck gates prod builds
- Platform packaging is declarative (electron-builder.yml)

### Negative

- Upgrade coupling: Electron × electron-vite × Vite majors must move together carefully
- Native modules (node-pty) need externalization/rebuild attention per platform

### Risks & Mitigations

- Risk: build config drifts with special cases until unmaintainable — Mitigation: keep target configs minimal; prefer convention over per-file overrides; document necessary exceptions inline

## Guardrails for Agents

### Do

- Run `npm run build` (which type checks) before considering a change release-ready; use `npm run dev` for iteration
- Add new top-level entry points (workers, additional windows) through the electron-vite config, not ad-hoc bundler hacks
- Keep the MCP server build (`esbuild`) free of Electron dependencies and verify it independently

### Don't

- Never add heavyweight bundler plugins or transform hacks for a single file — solve it in source or with standard Vite mechanisms
- Never bypass typecheck in build scripts to make a build pass
- Never change electron-builder packaging (ASAR, native module handling) without testing the affected platform build

## Related Decisions

- [ADR-0004: TypeScript Project References](../core-architecture/0004-typescript-project-references.md)
- [ADR-0019: Standalone MCP Server Package](../api-surface/0019-standalone-mcp-server-package.md)
- [ADR-0035: PTY Terminal](../platform-services/0035-pty-terminal-integration.md)
