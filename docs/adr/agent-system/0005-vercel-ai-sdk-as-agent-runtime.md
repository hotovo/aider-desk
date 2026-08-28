# ADR-0005: Vercel AI SDK as Agent Runtime

## Status

Accepted (2026-08-28)

## Context

The agent system needs multi-provider LLM access, streaming with mixed content parts (text, reasoning, tool calls), tool execution, and middleware-style message transformation. Building this directly on raw provider HTTP APIs would mean reimplementing streaming protocols, tool-call parsing, and provider quirks for 25+ providers.

## Decision Drivers

- **Must** support many providers with one integration surface (see [ADR-0013](../model-integration/0013-provider-adapter-registry.md))
- **Must** handle streaming text, reasoning, and tool-call parts uniformly
- **Must** support prompt middleware (reasoning extraction, context optimization — see [ADR-0010](0010-context-compaction-and-optimization.md))
- **Should** avoid per-provider protocol maintenance

## Considered Options

### Option A — Direct provider SDKs / raw HTTP per provider

- **Pros**: Full control over every protocol detail.
- **Cons**: 25+ integrations to maintain; streaming/tool-call logic duplicated; provider quirks leak into agent logic.

### Option B — Vercel AI SDK (`ai` package)

- **Pros**: Unified message/part model (`ModelMessage`, `TextPart`, `ToolCallPart`, …), provider-agnostic streaming, middleware support, built-in MCP client interop (`@ai-sdk/mcp`), active maintenance.
- **Cons**: Framework abstraction occasionally lags new provider features; part model must be mapped to AiderDesk's own context message types.

## Decision

Build the agent runtime on the **Vercel AI SDK**. Agent execution in `src/main/agent/agent.ts` uses the SDK's streaming APIs with a custom middleware pipeline (`src/main/agent/middlewares/`, e.g. `extract-reasoning-middleware.ts`). SDK message parts are the runtime currency, while persistence uses AiderDesk's own `ContextMessage` types (`ContextAssistantMessage`, `ContextToolMessage`, … in `@common/types`); conversion happens at the agent boundary (`src/main/agent/utils.ts`). MCP tools are converted to SDK `Tool`s via `convertMcpResultToModelOutput` and the MCP manager ([ADR-0006](0006-mcp-for-tool-extensibility.md)).

## Rationale

The SDK collapses the multi-provider problem into one integration point and provides the middleware hook needed for compaction/optimization. AiderDesk's own persistence types remain the durable format, so the runtime framework stays replaceable — a deliberate insulation layer.

## Consequences

### Positive

- Provider additions never touch agent logic
- Streaming of text/reasoning/tool parts works uniformly across providers
- Middleware cleanly separates concerns (reasoning extraction, optimization)

### Negative

- Dual type systems (SDK parts vs `ContextMessage`) require disciplined conversion at boundaries
- Upgrading the `ai` package can shift part/type shapes — upgrades need a dedicated pass

### Risks & Mitigations

- Risk: SDK types leak into persisted data or common types — Mitigation: `@common/types` never imports from `ai`; conversion helpers in `src/main/agent/utils.ts` are the only mapping point

## Guardrails for Agents

### Do

- Use AI SDK streaming and part types inside `src/main/agent/`; convert to/from `ContextMessage` only at the persistence boundary
- Add cross-cutting prompt/response behavior as SDK middleware in `src/main/agent/middlewares/`
- Keep `packages/common` free of `ai` package imports

### Don't

- Never call provider SDKs (e.g. `@anthropic-ai/sdk`) directly from agent code; all model access flows through the provider adapters ([ADR-0013](../model-integration/0013-provider-adapter-registry.md))
- Never persist raw SDK message objects; persist `ContextMessage` types

## Related Decisions

- [ADR-0006: MCP for Tool Extensibility](0006-mcp-for-tool-extensibility.md)
- [ADR-0010: Context Compaction and Prompt Optimization](0010-context-compaction-and-optimization.md)
- [ADR-0013: Model Provider Adapter Registry](../model-integration/0013-provider-adapter-registry.md)
