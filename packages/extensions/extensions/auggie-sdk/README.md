# Auggie SDK Extension for AiderDesk

> ⚠️ **Not a Built-in Provider** — Auggie SDK is now available as a **community extension**. It is no longer bundled with AiderDesk.

Integrates the [Auggie SDK](https://www.npmjs.com/package/@augmentcode/auggie-sdk) as an LLM provider in AiderDesk, using the Augment platform for authentication.

## How It Works

1. Registers `auggie` as an LLM provider in AiderDesk
2. Provides Claude and GPT model variants via the Augment platform
3. Supports both API key/URL authentication and local CLI session auto-discovery
4. Uses `auggie/` prefix for Aider mode integration

## Prerequisites

- **Auggie CLI** (optional): Install from [npm](https://www.npmjs.com/package/@augmentcode/auggie-sdk) and run `auggie login` to authenticate
- **Or** API Token and URL: Manually provide your Augment API token and URL

## Available Models

| Model | Input Tokens | Output Tokens |
|-------|-------------|---------------|
| claude-haiku-4-5 | 200K | 8K |
| claude-sonnet-4-6 | 200K | 16K |
| claude-opus-4-7 | 200K | 32K |
| claude-opus-4-8 | 200K | 32K |
| gpt-5-2 | 200K | 16K |
| gpt-5-4 | 200K | 16K |
| gpt-5-5 | 200K | 16K |

### Adding More Models

If you need additional models, edit the `AUGGIE_MODELS` array in `~/.aider-desk/extensions/auggie-sdk/index.ts` to include the desired model ID and token limits.

## Mode Support

This provider **only works in Agent mode**:

- ✅ **Agent Mode**: Fully supported
- ❌ **Code Mode**: Not supported
- ❌ **Ask Mode**: Not supported
- ❌ **Architect Mode**: Not supported
- ❌ **Context Mode**: Not supported

## Configuration

### Option 1: Auggie CLI (Auto-Discovery)

If no API key is provided, the provider will attempt to use the local CLI session (`~/.augment/session.json`).

### Option 2: API Token and URL

Provide your Augment API token and URL in the provider configuration:

- **API Token**: Your Augment API token for authentication
  - Environment variable: `AUGMENT_API_TOKEN`
- **API URL**: The Augment API URL endpoint
  - Environment variable: `AUGMENT_API_URL`

### Important Notes

- **Extension Required**: This is not a built-in provider — the extension must be installed separately
- **Agent Mode Only**: This provider exclusively works in Agent mode
- **Model Prefix**: Use `auggie/` prefix when specifying models in Aider mode
- **Auto-Discovery**: If no API key is provided, the provider will attempt to use the local CLI session

## Troubleshooting

**Provider Not Available**:
1. Verify the extension is installed and enabled in AiderDesk
2. Check that the Auggie CLI is installed and authenticated, or that API token and URL are provided

**Authentication Fails**:
1. Run `auggie login` again to re-authenticate
2. Or provide API token and URL manually in the provider configuration
