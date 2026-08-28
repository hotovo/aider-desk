# ADR-0013: Model Provider Adapter Registry

## Status

Accepted (2026-08-28)

## Context

AiderDesk must work with a wide and growing set of LLM providers — first-party APIs (Anthropic, OpenAI, Gemini, Mistral, …), cloud platforms (Azure, Bedrock, Vertex AI), local runtimes (Ollama, LM Studio, GPUStack), aggregators (OpenRouter, Requesty, LiteLLM, Cerebras, Groq, DeepSeek, …), and plan-based offerings (Alibaba, Kimi, MiniMax, Z.ai, OpenCode, NeuralWatt, ClinePass, Synthetic). Each has overlapping but non-identical APIs, model listing, and capabilities. Provider logic scattered across the agent would make every addition a cross-cutting change.

## Decision Drivers

- **Must** add new providers with minimal, isolated code
- **Must** share logic between providers with identical wire protocols (OpenAI-compatible, Anthropic-compatible)
- **Must** expose provider/model data (including cost/token info) to settings UI, agent profiles, and task flows via `ModelsData`/`ProviderModelsData`
- **Should** exploit provider capabilities like prompt caching where available

## Considered Options

### Option A — Provider `switch` statements inside agent/model code

- **Pros**: No abstraction upfront.
- **Cons**: Every provider touches core files; combinatorial growth; testing per provider is impossible in isolation.

### Option B — Adapter registry with base adapters

- **Pros**: One module per provider under `src/main/models/providers/`; shared base adapters (`openai-compatible.ts`, `anthropic-compatible.ts`, `default.ts`) absorb protocol families; `model-manager.ts`/`index.ts` resolve and dispatch; adding a provider = adding one file.
- **Cons**: Base-adapter APIs must evolve carefully to avoid breaking 25+ subclasses.

## Decision

Implement providers as an **adapter registry** in `src/main/models/providers/` — 27+ modules, each conforming to the shared provider interface (`types.ts`). Protocol families inherit from base adapters (`openai-compatible`, `anthropic-compatible`); `default.ts` holds fallback behavior. `model-manager.ts` resolves provider profiles (`ProviderProfile` in settings), lists/fetches models (`ModelsData`, `ProviderModelsData`), normalizes model metadata (`ModelInfo`), and applies `CacheControl` for prompt caching on capable providers ([ADR-0010](../agent-system/0010-context-compaction-and-optimization.md)). The agent runtime consumes adapters only through this registry — never vendor SDKs directly ([ADR-0005](../agent-system/0005-vercel-ai-sdk-as-agent-runtime.md)).

## Rationale

The registry isolates provider churn behind one seam. The base-adapter pattern means most new providers (especially OpenAI-compatible endpoints) are thin configuration, and capability differences (caching, streaming quirks) stay encapsulated per file.

## Consequences

### Positive

- New provider ≈ one new file (+ registry entry), no agent changes
- Provider-specific bugs are fixable in isolation with focused tests (`providers/__tests__`)
- Cost/token metadata flows uniformly to UI (Model Library, usage dashboards)

### Negative

- Base adapter changes require checking all inheritors
- Providers with unusual capabilities may strain the shared interface

### Risks & Mitigations

- Risk: duplicating provider logic outside the registry — Mitigation: guardrails below; `models/utils.ts` offers shared helpers

## Guardrails for Agents

### Do

- Add new providers as a new module in `src/main/models/providers/`, extending the matching base adapter, and register it in the registry/index
- Surface new provider capabilities through the shared interface + `ModelInfo` metadata rather than special-casing provider names in consumers
- Add/adjust tests under `src/main/models/providers/__tests__` for new adapters

### Don't

- Never import vendor SDKs outside `src/main/models/` (and never at all in agent logic — the AI SDK adapters handle wire protocols)
- Never branch on provider names (e.g. `if (provider === 'anthropic')`) in feature code; extend the adapter interface instead
- Never hardcode model names or prices in UI/logic — always via `ModelInfo` from the manager

## Related Decisions

- [ADR-0005: Vercel AI SDK as Agent Runtime](../agent-system/0005-vercel-ai-sdk-as-agent-runtime.md)
- [ADR-0010: Context Compaction and Prompt Optimization](../agent-system/0010-context-compaction-and-optimization.md)
