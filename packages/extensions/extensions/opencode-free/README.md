# OpenCode Free

An experimental AiderDesk Agent-mode provider for the free models available through OpenCode. Powered by [ai-sdk-provider-opencode-sdk](https://github.com/ben-vargas/ai-sdk-provider-opencode-sdk).

**Only free models are exposed.** For paid models, subscriptions, API keys, and normal direct model access, use AiderDesk's built-in **OpenCode GO** or **OpenCode ZEN** providers instead.

## Installation

Install **OpenCode Free** from AiderDesk's extension gallery. For a manual installation, copy this entire directory into an AiderDesk extensions directory and run `npm install` inside it. Restart AiderDesk or reload the extension, then select a model from **OpenCode Free** in an Agent profile.

Node.js 22 or later is required. Dependencies include a pinned OpenCode 2.x CLI binary; a separate OpenCode installation or account is not required. Your installed OpenCode CLI, credentials, configuration, and sessions are not modified. First use requires network access to OpenCode and the model catalog.

## Models

The extension discovers OpenCode's live model catalog rather than maintaining a static model list. It includes only enabled OpenCode chat models that support tools and text output, with zero input, output, and advertised cache costs. Decision-only models such as Jev are excluded.

Availability and free offers can change. Refresh the model library if a model stops working. The selected model is revalidated at the start of each run; the extension never falls back to a paid model. It does not load your API credentials or other LLM-provider environment variables.

## How it works

- Starts an owned, password-authenticated OpenCode server bound to loopback, with isolated temporary configuration and persistent, extension-owned session storage. Project OpenCode configuration is disabled to prevent additional plugins, credentials, or MCP servers from being loaded.
- Imports the full AiderDesk conversation into a new OpenCode session on first use, then resumes that populated session on subsequent turns. Sessions are isolated by project, task, provider profile, and parent/subagent conversation scope, using the actual workspace or worktree directory.
- Keeps native OpenCode `shell` and `read` tools available. Their events are displayed as `power---bash` and `power---file_read`; AiderDesk does **not** execute those tools again.
- Exposes the remaining executable tools from the active AiderDesk toolset through a private loopback MCP bridge. Original tool execution wrappers still apply, including their approvals, hooks, throttling, and result handling. Disabled tools are not added.
- Waits for MCP discovery before starting generation. Correlates MCP execution with the original tool-call ID to avoid duplicate execution and preserve tool history.
- Disables other native OpenCode tools and delegation. Stops its owned server and bridge and removes temporary configuration when the agent run finishes, is interrupted, or the extension unloads.

## Current limitations

### Native shell and read are required

OpenCode's free tier currently rejects some reduced-toolset configurations. For compatibility, this extension uses **native OpenCode shell/read**, not the implementations of AiderDesk's Power bash/file-read tools. Other enabled AiderDesk tools are bridged through MCP.

Native shell/read approvals use the same AiderDesk approval manager and Power bash/file-read approval keys as ordinary tools. **Never** or a missing tool denies the call in every autonomy mode. Power bash denied-command patterns are enforced; allowed patterns skip the Manual prompt without bypassing approval-extension vetoes. **Guided/Autonomous** auto-approve enabled tools unless an approval extension vetoes them. In **Manual** mode, **Always** is pre-approved and **Ask** prompts normally, including the existing always-for-this-run option. Rejecting a request sends explicit feedback to the model not to retry or work around the rejection. This requires an AiderDesk build with provider tool-approval callbacks; older builds refuse native execution rather than silently bypassing policy.

Mapping native events is for display/history only. Approval hooks (`onToolApproval` and `onHandleApproval`) apply, but Power-specific execution hooks (`onToolCalled`/`onToolFinished`), execution guard extensions, timeouts, and truncation do not automatically apply to native tools. **Do not use this extension if your security policy depends on those Power wrappers.** The native shell is not an operating-system sandbox; carefully review commands before approval, even though its initial working directory is the task workspace.

### OpenCode owns the agent loop

OpenCode performs model/tool iterations and keeps its own transcript across resumed turns. AiderDesk's tool implementations still execute for MCP calls, but AI SDK tools are not passed directly into the underlying provider. This is not a drop-in raw model endpoint.

- Agent mode only; Code, Ask, Architect, and other direct Aider modes are not supported.
- The server process restarts for each run, but its session database persists. The session ID is checkpointed in task/provider metadata after a successful main-agent turn. A matching history, workspace, model, and available native session are required for reuse; clearing, editing, branching, or compacting history rebuilds the native session with the full current context. Interrupted turns are not reused. Startup still adds latency.
- Sampling controls such as temperature and output-token limits are subject to the provider's OpenCode API limitations. Native structured output is not guaranteed.
- Images and other attachments remain subject to the selected model and the OpenCode provider's capabilities; full parity with direct providers is not guaranteed.
- Approval continuation is handled internally and tool-call IDs are deduplicated. Failures after dispatch are not automatically replayed, to avoid repeating side effects.

## Privacy and reliability

Native transcripts and session pointers are retained under `~/.aider-desk/opencode-free/sessions/`, separate from your ordinary OpenCode installation. Closing a task or unloading the extension stops processes but does not delete these transcripts. To purge them, stop the extension and remove that directory; subsequent turns import AiderDesk history into fresh native sessions.

Free does not imply zero retention. Some free models may collect prompts or code for model improvement, and some trial endpoints prohibit confidential or personal data. Review the current [OpenCode model and privacy documentation](https://opencode.ai/v2/docs/console/models/) before use.

The extension runs a real OpenCode server; it does not spoof a client or inject placeholder tools into direct model requests. Free-tier access, availability, rate limits, and upstream behavior remain controlled by OpenCode.

## Development

Run `npm install` in this directory, then `npm run typecheck`. From `packages/extensions`, run `npm run test -- --no-color extensions/opencode-free/__tests__`. The focused tests use mocks/local MCP traffic and do not call a model or incur inference costs.
