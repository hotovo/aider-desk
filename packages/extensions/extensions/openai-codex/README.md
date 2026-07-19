# OpenAI Codex Auth

OpenAI Codex Auth is an extension for [AiderDesk](https://aiderdesk.hotovo.com) ([GitHub](https://github.com/hotovo/aider-desk)).

It provides an OpenAI Codex provider using **ChatGPT Plus/Pro OAuth authentication**. No API key required — authenticate with your ChatGPT subscription directly through the browser.

## Installation

You can install the extension either with the AiderDesk extensions CLI or manually.

### Option 1: Install with the extensions CLI globally for all projects

```bash
npx -y @aiderdesk/extensions install openai-codex --global
```

### Option 2: Manual installation

Clone the AiderDesk repository and copy this extension into your `~/.aider-desk/extensions/` folder, then install dependencies:

```bash
git clone --depth 1 https://github.com/hotovo/aider-desk temp-aider
cp -r temp-aider/packages/extensions/extensions/openai-codex ~/.aider-desk/extensions/
cd ~/.aider-desk/extensions/openai-codex
npm install
rm -rf temp-aider
```

After installation, AiderDesk will pick up the extension automatically via hot reload.

## Usage

1. In AiderDesk, open the model selector.
2. Find **OpenAI Codex** and choose one of its models (e.g., `gpt-5.4`, `gpt-5.3-codex`, `gpt-5.2`).
3. Start a task — on first use, your browser will open for OpenAI login.
4. Complete the login with your ChatGPT Plus/Pro account.
5. After authentication, you'll see a success page and can return to AiderDesk.

The access token is stored locally in `~/.aider-desk/extensions/openai-codex/auth-token.json` and will be automatically refreshed when it expires. You will not need to re-authenticate unless the refresh token becomes invalid.

## Available Models

Since Codex OAuth tokens cannot access the `/v1/models` API, the available models are hardcoded in the extension based on the [official Codex models page](https://developers.openai.com/codex/models):

| Model               | Description                                  |
| ------------------- | -------------------------------------------- |
| `gpt-5.6-sol`       | Flagship GPT-5.6 model for complex coding, computer use, research, and cybersecurity |
| `gpt-5.6-terra`     | Balanced GPT-5.6 model for everyday work |
| `gpt-5.6-luna`      | Fast and affordable GPT-5.6 model for cost-sensitive, high-volume tasks |
| `gpt-5.4`           | Flagship frontier model for professional work |
| `gpt-5.4-mini`      | Fast, efficient mini model for responsive tasks |
| `gpt-5.3-codex`     | Industry-leading coding model                |
| `gpt-5.2-codex`     | Advanced coding model                        |
| `gpt-5.2`           | Previous general-purpose model               |
| `gpt-5.1-codex-max` | Optimized for long-horizon agentic coding    |
| `gpt-5.1-codex-mini`| Cost-effective coding model                  |

## Troubleshooting

- **Browser doesn't open** — Check that AiderDesk has permission to open external URLs.
- **Authentication keeps failing** — Delete `~/.aider-desk/extensions/openai-codex/auth-token.json` and try again.

## Requirements

- [AiderDesk](https://aiderdesk.hotovo.com) with extension support
- ChatGPT Plus or Pro subscription
- Node.js ≥ 22

## ⚠️ Usage Notice

This plugin is for personal development use with your own ChatGPT Plus/Pro subscription. For production or multi-user applications, use the OpenAI Platform API.
