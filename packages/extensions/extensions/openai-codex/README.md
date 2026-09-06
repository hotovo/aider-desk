# OpenAI Codex Auth

It provides an OpenAI Codex provider using **ChatGPT Plus/Pro OAuth authentication**. No API key required — authenticate with your ChatGPT subscription directly from AiderDesk.

## Usage

1. In AiderDesk, open the model selector.
2. Find **OpenAI Codex** and choose one of its models (e.g. `gpt-5.6-sol`, `gpt-5.5`, `gpt-5.3-codex`).
3. On first use, the agent will tell you that sign-in is required — open **Settings → Extensions → OpenAI Codex Auth** and use the sign-in options there. Authentication is never triggered implicitly while a task runs.

## Signing In

Open **Settings → Extensions → OpenAI Codex Auth** and choose one of the two sign-in methods:

- **Sign in with Browser** — opens your system browser, completes a PKCE OAuth flow over a local loopback callback (uses an ephemeral port, so it does not conflict with the Codex CLI's port 1455). Use this when your browser and AiderDesk run on the same machine.
- **Sign in with Device Code** — shows a one-time code and a link (`https://auth.openai.com/codex/device`). Open the link in **any** browser on **any** machine, enter the code, and AiderDesk polls until the sign-in completes. Use this when your browser runs on a different machine than AiderDesk (e.g. AiderDesk running headless on a server, accessed remotely).

Device code sign-in is a beta OpenAI feature and must be enabled first in your ChatGPT security settings (or by a workspace admin for business/enterprise accounts).

Tokens are stored in the `extensions-data/openai-codex` folder under the AiderDesk home/data directory (outside the extension install folder, so they survive extension updates) and are automatically refreshed when they expire. Use **Sign out** to remove them.

## Usage Quota

When an OpenAI Codex agent profile is active, the task usage area shows the primary and secondary Codex quota windows, including their usage percentage and reset time. The display refreshes after every prompt and otherwise caches data for one minute.

This information is retrieved from the ChatGPT backend used by the official Codex CLI. It is not a documented public OpenAI API and may change without notice.

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
| `gpt-5.3-codex-spark` | Coding model variant                       |

## Troubleshooting

- **Browser doesn't open** — Check that AiderDesk has permission to open external URLs, or use the device code method.
- **Device code link leads to login without a code field** — Enable device code login in your ChatGPT security settings first (workspace users may need an admin).
- **Authentication keeps failing** — Sign out from the extension settings (or delete `~/.aider-desk/extensions-data/openai-codex/auth-token.json`) and sign in again.
- **Session expired errors on every prompt** — Sign in again from extension settings.

## Requirements

- [AiderDesk](https://aiderdesk.hotovo.com) with extension support
- ChatGPT Plus or Pro subscription
- Node.js ≥ 22

## ⚠️ Usage Notice

This plugin is for personal development use with your own ChatGPT Plus/Pro subscription. For production or multi-user applications, use the OpenAI Platform API.
