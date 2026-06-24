# GitHub Copilot Extension for AiderDesk

Integrates [GitHub Copilot](https://github.com/features/copilot) as an LLM provider in AiderDesk, using the official [Copilot SDK](https://github.com/github/copilot-sdk) (bundled Copilot CLI). This provider uses VS Code's privileged first-party client ID for full model access.

## How It Works

1. Registers `github-copilot` as an LLM provider in AiderDesk
2. Uses the official `@github/copilot-sdk` which spawns the Copilot CLI as a child process
3. The CLI handles all model routing (Responses API, Chat Completions, Messages API), authentication, and endpoint selection internally
4. Forwards AiderDesk's tools to the Copilot agent via `defineTool`
5. The user authenticates once via the Copilot CLI (keychain credentials)

## Prerequisites

- **Copilot CLI**: Install it manually from [github.com/features/copilot/cli](https://github.com/features/copilot/cli). You only need it to authenticate — the extension bundles its own CLI binary for runtime use.
- **Authentication**: Run `copilot` in your terminal once to authenticate before using this provider
- **Copilot Subscription**: Active GitHub Copilot subscription (Individual, Business, or Enterprise)

## Mode Support

This provider **only works in Agent mode**:

- ✅ **Agent Mode**: Fully supported
- ❌ **Code Mode**: Not supported
- ❌ **Ask Mode**: Not supported
- ❌ **Architect Mode**: Not supported
- ❌ **Context Mode**: Not supported
- ❌ **Aider Integration**: Cannot be used with Aider

## Configuration

No additional configuration is needed. Once the extension is installed and the Copilot CLI is authenticated, the `github-copilot` provider will appear in AiderDesk's Model Library.

### Important Notes

- **Extension Required**: This is not a built-in provider — the extension must be installed separately
- **Agent Mode Only**: This provider exclusively works in Agent mode
- **Model Prefix**: Use `github-copilot/` prefix when specifying models
- **Token Usage Tracking**: Basic token usage is reported when available from the Copilot CLI

## Troubleshooting

**Provider Not Available**:
1. Verify the extension is installed and enabled in AiderDesk
2. Ensure the Copilot CLI is installed (see [github.com/features/copilot/cli](https://github.com/features/copilot/cli))
3. Check that the Copilot CLI can authenticate (run `copilot` in your terminal)

**Authentication Fails**:
1. Run `copilot` in your terminal to re-authenticate (ensure the CLI is installed)
2. Check that your Copilot subscription is active

**Model Not Supported**:
- Some models may not be available depending on your subscription tier
- Run `copilot -i /models` to verify available models

## Technical Details

- Uses `@github/copilot-sdk` which spawns the Copilot CLI as a child process (JSON-RPC over stdio)
- The CLI uses VS Code's privileged first-party client ID (`Iv1.b507a08c87ecfe98`) for full model access
- All model routing (Responses API for GPT-5+, Messages API for Claude, Chat Completions for others) is handled by the CLI internally
- No custom OAuth app or API key management required
