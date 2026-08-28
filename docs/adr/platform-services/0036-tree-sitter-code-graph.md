# ADR-0036: Reusable Tree-Sitter Code Analysis Package

## Status

Accepted (2026-08-28)

## Context

Some AiderDesk extensions need structural code information: repository maps need ranked definitions, and context-autocompletion needs extracted symbols. Regex-only extraction is brittle across languages, while implementing parsers independently in each extension would duplicate grammar loading, caching, graph construction, and ranking.

The built-in `power---semantic_search` tool is a separate subsystem backed by the Probe integration in `src/main/utils/probe.ts`; it does not consume `@aiderdesk/tree-sitter-utils`. The tree-sitter package must therefore be documented as reusable analysis infrastructure for its actual consumers, not as the implementation of built-in semantic search.

## Decision Drivers

- **Must** parse supported languages locally without uploading source code
- **Must** share parser, symbol, graph, ranking, and cache logic across consumers
- **Must** remain usable by extensions without depending on Electron application internals
- **Should** support repository-map rendering and lower-level symbol extraction
- **Should** cache analysis artifacts to reduce repeated parsing cost

## Considered Options

### Option A — Regex extraction in each feature or extension

- **Pros**: No parser package or grammar lifecycle.
- **Cons**: Poor language accuracy, duplicated logic, inconsistent symbols, and no shared graph/ranking behavior.

### Option B — Structural analysis directly in the Electron main process

- **Pros**: One application service.
- **Cons**: Couples analysis to the app, prevents extension/package reuse, and conflates the feature with the independent Probe-backed semantic-search tool.

### Option C — Published tree-sitter utility package

- **Pros**: `packages/tree-sitter-utils` provides language detection, parser/grammar loading, symbol extraction, graph building, PageRank, caching, and tree rendering behind a reusable API; extensions can consume `extractSymbols` or `getRepoMap` directly.
- **Cons**: Grammar/WASM assets and caches need lifecycle management; initial analysis can be expensive; supported-language behavior is bounded by package grammars.

## Decision

Maintain `packages/tree-sitter-utils` as the reusable `@aiderdesk/tree-sitter-utils` package. Its public API exposes structural analysis operations backed by `TreeSitterParser`, `TreeSitterAnalyzer`, `symbol-extractor.ts`, `graph-builder.ts`, `pagerank.ts`, `cache-manager.ts`, and `tree-renderer.ts`.

Use the package in consumers that require structural code analysis, including the `tree-sitter-repo-map` and `context-autocompletion-words` extensions. Keep built-in semantic search on its established Probe path unless a future ADR deliberately unifies the two systems.

## Rationale

A package boundary lets multiple extensions share expensive language-aware machinery while keeping it independent from Electron and agent orchestration. Separating structural analysis from Probe search also prevents agents from making incorrect changes under the assumption that every search result flows through PageRank or tree-sitter.

## Consequences

### Positive

- Structural parsing and ranking logic is reusable across extensions
- Source analysis runs locally
- Repository-map and symbol consumers share language behavior and caches
- The package can be versioned and tested independently

### Negative

- Grammar/WASM assets add packaging and initialization complexity
- Large repositories incur an initial parsing cost
- There are two distinct code-discovery systems to understand: Probe search and tree-sitter analysis

### Risks & Mitigations

- Risk: a consumer assumes every language is supported identically — Mitigation: use language detection and handle unsupported/failed parsing gracefully
- Risk: stale cache output after source changes — Mitigation: preserve cache invalidation metadata and expose explicit cleanup where needed
- Risk: semantic search and tree-sitter are conflated — Mitigation: keep their ownership and call paths explicit in docs and code review

## Guardrails for Agents

### Do

- Use the package's exported APIs for repository maps and symbol extraction
- Keep `packages/tree-sitter-utils` independent of Electron and application managers
- Account for parser initialization, unsupported files, and cache invalidation
- Update package consumers and package tests when changing exported behavior
- Distinguish Probe-backed `power---semantic_search` from tree-sitter consumers

### Don't

- Don't claim that built-in semantic search uses this package unless the call path actually changes
- Don't add raw tree-sitter parsing independently inside an extension when the package API can be extended
- Don't upload analyzed source or symbols to external services by default
- Don't assume parser output is complete or error-free for every file
- Don't bypass ranking when implementing a consumer that promises a ranked repository map

## Related Decisions

- [ADR-0012: Skills and Custom Commands](../agent-system/0012-skills-and-custom-commands.md)
- [ADR-0029: Lifecycle-Hook Extension System](../extensions/0029-lifecycle-hook-extension-system.md)
- [ADR-0031: npm Workspaces Monorepo](../packages-monorepo/0031-npm-workspaces-monorepo.md)
