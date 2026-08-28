# ADR-0006: MCP for Tool Extensibility

## Status

Accepted (2026-08-28)

## Context

The agent needs tools beyond built-ins: users bring their own tool servers, and the agent itself exposes capabilities (subagents, memory, tasks, skills) as tools. Adopting every integration as bespoke in-process code does not scale and couples the agent to arbitrary third-party APIs. MCP (Model Context Protocol) is the emerging standard for exactly this.

## Decision Drivers

- **Must** support user-configured external tool servers (stdio and HTTP transports)
- **Must** namespace external and built-in tools so names never collide ([ADR-0008](0008-tool-group-namespacing-contracts.md))
- **Must** route every tool call through the approval flow ([ADR-0009](0009-tool-approval-and-autonomy-modes.md))
- **Should** support MCP auth (OAuth) for remote servers

## Considered Options

### Option A — Bespoke integrations per tool source

- **Pros**: No protocol overhead.
- **Cons**: Unbounded maintenance; every new tool server requires agent code changes; no ecosystem reuse.

### Option B — MCP as the tool boundary

- **Pros**: One protocol covers arbitrary external servers; client SDKs exist (`@modelcontextprotocol/sdk`, `@ai-sdk/mcp`); tools, prompts, and resources arrive dynamically; OAuth support for remote servers.
- **Cons**: Tool listing/invocation is async and can fail; schema variations must be handled; adds connection lifecycle management.

## Decision

Use **MCP** as the standard tool boundary, managed by `src/main/agent/mcp-manager.ts` (connections via `StdioClientTransport` or `StreamableHTTPClientTransport`), `mcp-config-manager.ts` (per-project and global server configs), and `mcp-oauth-manager.ts` (OAuth flows and `McpOAuthStatus`). MCP tools are wrapped as AI SDK tools ([ADR-0005](0005-vercel-ai-sdk-as-agent-runtime.md)), namespaced as `<server><sep><tool>` using `TOOL_GROUP_NAME_SEPARATOR`, and every invocation passes through the `ApprovalManager`. MCP tool input schemas are validated via `McpToolInputSchema`.

## Rationale

MCP makes the tool ecosystem user-extensible without agent-code changes, and the SDK pair (`@ai-sdk/mcp` + `@modelcontextprotocol/sdk`) covers both the AI-runtime and transport/auth layers. Namespacing plus centralized approval keeps external tools safe and collision-free.

## Consequences

### Positive

- Users add tools via configuration only
- Built-in tools (aider, memory, subagents, tasks, todo, skills, power) and MCP tools share one invocation path — approval, telemetry, and error handling are uniform
- Remote servers with OAuth work without custom auth code per provider

### Negative

- Connection lifecycle (restarts, timeouts, unauthorized states) must be handled robustly
- Debugging tool issues spans process boundaries

### Risks & Mitigations

- Risk: a broken MCP server stalls agent startup — Mitigation: connections initialize asynchronously with per-server status; agent starts with the tools that are available

## Guardrails for Agents

### Do

- Route all tool invocations — built-in and MCP — through the same manager path so approval ([ADR-0009](0009-tool-approval-and-autonomy-modes.md)) applies uniformly
- Use `extractServerNameToolName` / `TOOL_GROUP_NAME_SEPARATOR` (`@common/tools`, `@common/utils`) when parsing or building namespaced tool names
- Add new built-in capabilities as tools in `src/main/agent/tools/` with schemas and stable names

### Don't

- Never execute an MCP tool call that bypasses the `ApprovalManager`
- Never hardcode MCP server names or tool names in feature logic — they are user configuration
- Never modify tool names/IDs that may already be persisted in task contexts ([ADR-0008](0008-tool-group-namespacing-contracts.md))

## Related Decisions

- [ADR-0005: Vercel AI SDK as Agent Runtime](0005-vercel-ai-sdk-as-agent-runtime.md)
- [ADR-0008: Tool Group Namespacing](0008-tool-group-namespacing-contracts.md)
- [ADR-0009: Tool Approval and Autonomy Modes](0009-tool-approval-and-autonomy-modes.md)
