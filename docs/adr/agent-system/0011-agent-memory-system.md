# ADR-0011: Local Vector Memory System

## Status

Accepted (2026-08-28)

## Context

Agents benefit from remembering durable facts across tasks, such as user preferences, project patterns, and architectural decisions. Keeping memories only in task context makes them ephemeral, while a hosted vector database or embedding API would expose potentially sensitive knowledge and add account/network requirements. Retrieval must support semantic similarity rather than keyword matching alone.

## Decision Drivers

- **Must** store memory entries and vectors on the user's machine
- **Must** compute embeddings locally after the configured model is available
- **Must** support semantic retrieval through agent tools under the stable memory namespace ([ADR-0008](0008-tool-group-namespacing-contracts.md))
- **Must** allow users to enable or disable the subsystem through settings
- **Should** defer native/vector and model initialization until memory is initialized

## Considered Options

### Option A — JSON entries with keyword lookup

- **Pros**: Minimal dependencies and easy inspection.
- **Cons**: Poor retrieval for paraphrases and growing collections; no vector similarity.

### Option B — Hosted vector storage or embedding APIs

- **Pros**: Little local compute and managed scaling.
- **Cons**: Sends memory content off-device, requires credentials and network access, and conflicts with local-first expectations.

### Option C — Embedded LanceDB with a local transformer model

- **Pros**: Entries, embeddings, and queries remain local; LanceDB provides embedded vector search; `@huggingface/transformers` runs the selected embedding model locally; modules can be loaded dynamically.
- **Cons**: The configured model may need to be downloaded on first use; dependencies and model cache consume disk space; first initialization can be slow.

## Decision

Implement memory in `MemoryManager` (`src/main/memory/memory-manager.ts`) using an embedded **LanceDB** database at `AIDER_DESK_MEMORY_FILE` and a local `@huggingface/transformers` feature-extraction pipeline. `MemoryManager` directly owns the database, table, model cache, embedding progress, and re-embedding behavior; it is not persisted through `DataManager` ([ADR-0026](../data-and-state/0026-central-data-manager.md)).

Load LanceDB and transformers with dynamic imports when the enabled memory subsystem initializes. The model may require a network download the first time it is selected; embedding and retrieval then execute locally from the cache. Expose memory operations through `MEMORY_TOOL_STORE` and `MEMORY_TOOL_RETRIEVE`, and expose management operations through `src/main/server/rest-api/memory-api.ts`.

## Rationale

Embedded vector storage plus local inference gives semantic recall without sending memory contents to a third-party embedding service. Dynamic loading reduces startup work and isolates initialization failures, while the settings gate lets users disable the feature. Explicitly acknowledging first-use model acquisition avoids overstating the system as network-free.

## Consequences

### Positive

- Memory entries and vectors remain on-device
- Semantic retrieval works across tasks without a hosted database
- Embedding model and distance threshold are configurable
- UI, REST, and agent tools share one owning manager

### Negative

- First use can download a model and incur noticeable latency
- LanceDB, transformer runtime, and model caches add disk and packaging cost
- Changing models can require re-embedding existing entries

### Risks & Mitigations

- Risk: model download or cache corruption leaves memory unavailable — Mitigation: initialization reports progress/errors and retries known corrupted-model failures after clearing that model's cache
- Risk: model changes mix incompatible vectors — Mitigation: use the existing provider/model change and re-embedding flow
- Risk: sensitive entries are exposed through APIs or logs — Mitigation: keep operations behind the manager and avoid logging entry content

## Guardrails for Agents

### Do

- Route memory reads, writes, deletion, and re-embedding through `MemoryManager`
- Keep LanceDB and transformer loading dynamic
- Preserve the settings enablement check and embedding progress reporting
- Treat first-use model download as a network and UX consideration
- Update the REST, tool, and UI surfaces together when changing memory capabilities

### Don't

- Don't send memory text or vectors to remote embedding/vector services without a new explicit decision and user-facing consent
- Don't describe memory as fully offline before its selected model has been downloaded
- Don't persist memory through `DataManager` or a parallel JSON store
- Don't bypass `MemoryManager` to mutate the LanceDB files or table
- Don't rename persisted memory tool IDs without a migration ([ADR-0008](0008-tool-group-namespacing-contracts.md))

## Related Decisions

- [ADR-0006: MCP for Tool Extensibility](0006-mcp-for-tool-extensibility.md)
- [ADR-0008: Tool Group Namespacing](0008-tool-group-namespacing-contracts.md)
- [ADR-0026: Domain-Owned Persistence Backends](../data-and-state/0026-central-data-manager.md)
