# ADR-0010: Context Compaction and Prompt Optimization

## Status

Accepted (2026-08-28)

## Context

Long agent tasks accumulate huge contexts: file contents, tool outputs, bash logs, diffs. Model context windows and costs make naive append-only contexts untenable, but blunt truncation destroys information the agent needs (e.g. a tool result referenced by a later step). Compaction must be *tool-aware*: different tool results have different value densities, and summarized content must remain a faithful part of the conversation history.

## Decision Drivers

- **Must** keep contexts within model limits for multi-hour tasks without user intervention
- **Must** preserve conversational integrity — history remains replayable after summarization
- **Must** respect tool-group semantics when deciding what to shrink ([ADR-0008](0008-tool-group-namespacing-contracts.md))
- **Should** offer user control (off / manual / automatic) per settings

## Considered Options

### Option A — Truncate oldest messages at a token threshold

- **Pros**: Trivial to implement.
- **Cons**: Loses critical instructions/tool results; breaks replay; tool-call pairs get orphaned.

### Option B — Tool-aware compaction + optimization pipeline

- **Pros**: `smart-compaction.ts` replaces spans of older content with LLM-generated summary messages that reference preserved tool results; `optimizer.ts` shrinks *within* the current request (large tool outputs, outputs of low-value groups) without touching persisted history; both operate on typed parts (`TextPart`, `ToolResultPart`) and group constants.
- **Cons**: Summarization calls cost tokens; two mechanisms must stay conceptually distinct.

## Decision

Provide two complementary mechanisms in `src/main/agent/`:

1. **Smart compaction** (`smart-compaction.ts`, `compaction.ts`): when context exceeds thresholds (configured via `ContextCompactionType` in settings), a summarization model produces a summary `ContextMessage` for older conversation spans; referenced tool results are retained so later steps still resolve them. Compaction results are **persisted** — history after compaction is the canonical history.
2. **Prompt optimizer** (`optimizer.ts`): a request-time middleware ([ADR-0005](0005-vercel-ai-sdk-as-agent-runtime.md)) that reduces the *outgoing* prompt only — stripping/trimming large tool results based on tool-group membership (`MEMORY_TOOL_GROUP_NAME`, `AIDER_TOOL_GROUP_NAME`, etc.) — without modifying stored messages. It is profile- and cache-aware (`CacheControl`, see [ADR-0013](../model-integration/0013-provider-adapter-registry.md)).

## Rationale

Separating "permanent history reduction" (compaction) from "per-request slimming" (optimization) keeps persisted data faithful while still cutting per-call cost. Tool-group awareness encodes the insight that e.g. memory-store results or huge file dumps can be represented by references far more cheaply than reasoning chains.

## Consequences

### Positive

- Long-running tasks survive without hitting context limits
- Persisted history stays replayable and exportable after compaction
- Optimization reductions don't corrupt what the user sees or what future requests can access

### Negative

- Summaries can lose detail; compaction quality depends on the summarization model
- Two subsystems to maintain in lockstep with the tool registry ([ADR-0008](0008-tool-group-namespacing-contracts.md))

### Risks & Mitigations

- Risk: compaction orphans tool-call/tool-result pairs — Mitigation: compaction operates on typed parts and keeps referenced results; tests cover pair integrity

## Guardrails for Agents

### Do

- Keep persisted `ContextMessage` history authoritative; only optimizer output is ephemeral
- When adding a tool group/tool, evaluate its compaction/optimizer treatment in `smart-compaction.ts`/`optimizer.ts` and update the group constants usage
- Maintain tool-call/tool-result pairing through every transformation

### Don't

- Never mutate persisted context messages during optimization — operate on copies built for the outgoing request
- Never drop `ToolResultPart`s that a summary references
- Never introduce a second compaction mechanism; extend the existing ones

## Related Decisions

- [ADR-0005: Vercel AI SDK as Agent Runtime](0005-vercel-ai-sdk-as-agent-runtime.md)
- [ADR-0008: Tool Group Namespacing](0008-tool-group-namespacing-contracts.md)
- [ADR-0013: Model Provider Adapter Registry](../model-integration/0013-provider-adapter-registry.md)
