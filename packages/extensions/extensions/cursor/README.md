# Cursor Extension for AiderDesk

Adds a `cursor/` provider that integrates Cursor models via a local OpenAI-compatible proxy, giving AiderDesk full control over tool execution and approval.

This is the **recommended** Cursor extension if you want AiderDesk to have full control over tool execution, approval, and MCP integration. It runs Cursor's models through AiderDesk's native agent loop rather than through a separate subprocess. However, note that this extension communicates directly with Cursor's internal API using vendored protocol schemas. Cursor may make changes to this API at any time that could break the extension.

## How It Works

When a `cursor/` model is selected, AiderDesk's agent loop calls `createLlm()` which:

1. Exchanges your Cursor API key for an access token
2. Spawns a local proxy process (bundled from vendored code)
3. Returns an `@ai-sdk/openai-compatible` LanguageModel pointing at the proxy

The proxy translates OpenAI-format requests to Cursor's protocol, manages conversation state (checkpoints, blobs, session resumption), and translates responses back to OpenAI SSE format.

### Tool Execution Flow

```
AiderDesk Agent Loop (doStream with tools)
    ↓ OpenAI chat/completions request
Local Proxy
    ↓ Protocol translation
Cursor's API
    ↓ Streaming response with tool calls
Local Proxy
    ↓ OpenAI SSE with tool_calls (finishReason: 'tool-calls')
AiderDesk Agent Loop
    ↓ Execute tools with ApprovalManager
    ↓ Call doStream() again with tool results
Local Proxy → Cursor (resume session with tool results)
    ↓ Streaming response
AiderDesk Agent Loop
```

### Tool Dispatch Modes

| Mode | Description |
|------|-------------|
| **Reject** (default) | Cursor's native tools are rejected. Only AiderDesk's tools are available with full approval control. |
| **Redirect** | Cursor's native tools (shell, read, write, grep, etc.) are silently redirected to AiderDesk's power tools. Tools execute through AiderDesk with approval. |
| **Native** | Proxy executes tools locally with path sandboxing. Fastest but no AiderDesk approval. |

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| API Key | Cursor API key from [cursor.com/dashboard](https://cursor.com/dashboard) | (required) |
| Native Tools Mode | How Cursor's native tools are handled | `reject` |
| Max Mode | Uses larger context window | `off` |
| Fast Mode | Enables fast mode | `off` |
| Thinking | Enables reasoning/deliberation | `on` |
| Max Retries | Retry attempts for transient failures | `2` |

## Comparison: `cursor` vs. `cursor-sdk`

AiderDesk has two Cursor extensions. This one (`cursor`) is preferred if you want AiderDesk to have full control over tool execution and approval. The [cursor-sdk](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/cursor-sdk/) extension is an alternative that runs Cursor agents via the official `@cursor/sdk` package, but cannot control tool approval.

| Aspect | `cursor` (this extension) | `cursor-sdk` |
|--------|--------------------------|--------------|
| Agent Loop | AiderDesk native (full control) | Cursor CLI subprocess (black box) |
| Tool Approval | ✅ Full AiderDesk approval support | ❌ Not controllable |
| MCP Integration | AiderDesk manages natively | Passed to Cursor |
| Provider Type | OpenAI-compatible (via proxy) | Overrides agent loop |
| Interrupt Support | Native AiderDesk interrupt | SDK cancel |
| Stability | ⚠️ Depends on Cursor's internal API (may break) | ✅ Uses official SDK (more stable) |

## Attribution

This extension includes proxy server code adapted from [pi-cursor](https://github.com/schultzp2020/pi-extensions) by **Paul Schultz**, licensed under the MIT License.
