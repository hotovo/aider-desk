# Claude Agent SDK Extension for AiderDesk

> ⚠️ **Not a Built-in Provider** — Claude Agent SDK is now available as a **community extension**. It is no longer bundled with AiderDesk.

> ⚠️ **Important: Subscription Changes**
>
> Starting **June 15, 2026**, Claude subscription plans (Pro, Max, Team, Enterprise) no longer include Agent SDK usage as part of the regular subscription. Instead, Anthropic provides a separate monthly Agent SDK credit:
>
> | Plan | Monthly Agent SDK Credit |
> |------|------------------------|
> | Pro | $20 |
> | Max 5x | $100 |
> | Max 20x | $200 |
> | Team (Standard) | $20 |
> | Team (Premium) | $100 |
> | Enterprise (usage-based) | $20 |
> | Enterprise (seat-based Premium) | $200 |
>
> Once this credit is exhausted, **you are charged at standard API rates** if usage credits are enabled. If usage credits are not enabled, requests stop until the credit refreshes.
>
> For full details, see: [Use the Claude Agent SDK with your Claude plan](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan)

> ⚠️ **Educational Purposes Only**
>
> This extension is provided primarily for **educational and experimental purposes**. For production use, it is **strongly recommended to use the [Anthropic provider](https://aiderdesk.hotovo.com/docs/configuration/providers/anthropic) with API keys** directly in AiderDesk instead. The Anthropic API provider offers:
>
> - **Direct API access** with no intermediary CLI
> - **Better cost control** with transparent per-token pricing
> - **Lower latency** by skipping the Claude Code CLI layer
> - **Full feature support** across all AiderDesk modes (Agent, Code, Ask, Architect, Context)
> - **No subscription credit limitations** or separate billing concerns

Integrates the [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk) as an LLM provider in AiderDesk, using the Claude Code CLI for authentication. Powered by [ai-sdk-provider-claude-code](https://github.com/ben-vargas/ai-sdk-provider-claude-code).

## How It Works

1. Registers `claude-agent-sdk` as an LLM provider in AiderDesk
2. Provides three models: `haiku`, `sonnet`, and `opus`
3. Forwards AiderDesk's tools to Claude Code via the AI SDK
4. Optimizes tool output (trims large responses from aider/subagent tools)
5. Converts JSON Schema tool inputs to Zod schemas (required by Claude Agent SDK)
6. Supports conversation resume via session ID tracking

## Prerequisites

- **Claude Code CLI**: Must be installed from [Claude Code](https://claude.com/product/claude-code)
- **Authentication**: Run `claude login` before using the provider
- **Claude Subscription**: Active Claude Code Pro, Max, Team, or Enterprise subscription (or a Claude Platform API key)

## Available Models

| Model | Input Tokens | Output Tokens |
|-------|-------------|---------------|
| haiku | 200K | 64K |
| sonnet | 200K | 64K (default) |
| opus | 200K | 64K |
| fable | 1M | 128K |

## Mode Support

This provider **only works in Agent mode**:

- ✅ **Agent Mode**: Fully supported
- ❌ **Code Mode**: Not supported
- ❌ **Ask Mode**: Not supported
- ❌ **Architect Mode**: Not supported
- ❌ **Context Mode**: Not supported
- ❌ **Aider Integration**: Cannot be used with Aider

## Configuration

No additional configuration is needed. Once the extension is loaded and Claude Code CLI is authenticated, the `claude-agent-sdk` provider will appear in AiderDesk's Model Library with the following models:

- `claude-agent-sdk/haiku`
- `claude-agent-sdk/sonnet`
- `claude-agent-sdk/opus`

### Important Notes

- **Extension Required**: This is not a built-in provider — the extension must be installed separately
- **CLI Required**: Claude Code CLI must be installed and authenticated before use
- **Agent Mode Only**: This provider exclusively works in Agent mode
- **Model Prefix**: Use `claude-agent-sdk/` prefix when specifying models
- **Provider Switching**:
  - ✅ Switching FROM Claude Agent SDK to another provider works fine
  - ⚠️ Switching FROM another provider TO Claude Agent SDK during an active conversation might not fully work as expected and is not a recommended workflow

### Limitations

- **Message Editing**: Redo user message, Edit last user message, and Delete message actions do not work as expected because the provider does not support session modification
- **Token Usage Tracking**: Currently, it's not possible to properly track the model's token usage

## Troubleshooting

**Provider Not Available**:
1. Verify the extension is installed and enabled in AiderDesk
2. Check that the Claude Code CLI is installed and authenticated

**Authentication Fails**:
1. Run `claude login` again to re-authenticate
2. Check that your Claude Code subscription is active
3. Verify the CLI version is up to date

**Mode Compatibility**:
- Remember: This provider only works in Agent mode
- If you need Code/Ask/Architect modes, use the standard Anthropic provider instead
