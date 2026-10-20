# External-Agent Provider Extensions

Use this guide when `getProviders()` wraps a coding-agent SDK or server rather than a plain model endpoint.

Authoritative contracts: [extensions.ts](https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/common/src/extensions.ts). The complete local signatures are in [extension-interface.md](extension-interface.md#extensionproviderstrategy); website documentation is in [the provider API reference](https://aiderdesk.hotovo.com/docs/extensions/api-reference#extensionproviderstrategy).

## Provider construction and host compatibility

`createLlm` receives these positional arguments:

1. `profile`
2. `model`
3. `settings`
4. `projectDir`
5. `toolSet?`
6. `systemPrompt?`
7. `providerMetadata?`
8. `tlsRegistrar?`
9. `sessionId?`
10. `approveTool?: ProviderToolApprovalHandler`

`loadModels` also accepts an optional third `tlsRegistrar` argument. Use the exact types in the authoritative source instead of guessing SDK or host signatures.

The trailing arguments are optional: ordinary model providers can ignore them. Native-tool integrations must reject native execution if their required approval callback is absent. Updating an extension cannot add a callback to an older host. Test against the matching core build and restart the Electron/main process after core changes; renderer refresh or extension hot reload alone is insufficient.

## Approval is not execution

```typescript
import type { ProviderToolApprovalHandler } from '@aiderdesk/extensions';

const approveNativeRead = async (
  approveTool: ProviderToolApprovalHandler | undefined,
  filePath: string,
): Promise<[boolean, string?]> => {
  if (!approveTool) {
    return [false, 'Update and restart AiderDesk to enable provider tool approvals.'];
  }
  return approveTool('power---file_read', { filePath }, 'Approve native file read?', filePath);
};
```

Map native inputs into the corresponding AiderDesk schema first. Native read uses `power---file_read` and `filePath`; native shell uses `power---bash` and `command`/`cwd`. Await the result before granting permission to the native agent. Forward the rejection reason so the model can distinguish a policy rejection from a missing tool.

The callback uses the active run's shared approval manager:

- Missing/disabled tools and **Never** are denied in every mode.
- Power bash denied-command patterns are enforced. Allowed patterns skip the Manual prompt, without bypassing approval-hook vetoes.
- **Manual** follows **Always/Ask** and shares existing keys and always-for-this-run state with ordinary Power tools.
- **Guided/Autonomous** do not prompt for enabled tools. Approval hooks (`onToolApproval`, `onHandleApproval`) still run before auto/pre-approval; disabled-tool and denied-pattern checks reject before hooks.

Do not implement this policy with unconditional `TaskContext.askQuestion` calls, silently approve when the callback is missing, or invoke a Power executor merely to check approval. The callback does not apply Power execution hooks (`onToolCalled`/`onToolFinished`), executor guards, sandboxing, or output processing. Document those native-tool limitations explicitly.

## Exactly one execution owner

- Native tools execute inside the external agent after an approved permission request.
- Bridged tools execute through the supplied, already-wrapped AiderDesk `toolSet` executors. Wait for MCP discovery/readiness before starting a turn.
- When reporting externally executed calls through AI SDK, set `providerExecuted: true` on the observed tool calls so the host does not execute them again.
- Deduplicate replayed calls/results by call ID across approval continuations. Preserve original arguments; a resumed event may repeat a call with empty input.
- Correlate MCP execution with its observed call ID and arguments, including parallel calls to the same tool.
- Retain original wrapped-tool return values for AiderDesk UI/history. MCP content arrays or `toModelOutput` conversions can differ from the schema expected by specialized renderers. Preserve conversion, images and error status for the model without replacing the UI result with a different representation.

## Streaming and message ownership

For standard AI SDK providers, AiderDesk owns chat-message grouping and completion: tool/non-assistant boundaries close assistant groups rather than every `text-end`, and step finalization follows the consumer reaching `finish-step`. Forward coherent reasoning/text block IDs and tool boundaries; suppress replayed blocks or replayed prefixes rather than giving old content a fresh ID. Do not also insert a second copy of the response through `TaskContext.addResponseMessage`.

For extension-owned orchestration/rendering (such as Cursor SDK), use stable message IDs and mark messages complete before opening the next group. Streamed and finalized content must agree. SDK completion callbacks can run ahead of an async stream consumer: do not finalize a message while queued deltas can still append to it.

## Persistent conversations and transient resources

A native session ID is not enough if its database is deleted at the end of each run. Separate persistent conversation data from temporary runtime configuration, authentication, server processes and MCP bridges.

- Store scoped session identifiers in task/provider metadata and retain the native session's backing data in a documented extension-owned location.
- Keep user-editable configuration in the extension directory as usual. Native runtime/session storage is a different category; give it explicit scoping, access restrictions and retention/cleanup documentation.
- Import the complete prepared AiderDesk history into a fresh conversation. Some SDKs treat a supplied session ID as proof that the history already exists; pre-creating an empty session can therefore discard history.
- Resume only after validating workspace, model, conversation scope and a successfully completed history checkpoint. Rebuild from full AiderDesk history after edits, clearing, compaction, or a missing session.
- Invalidate the resumable checkpoint before dispatch, and checkpoint only completed, non-aborted turns. Do not retry a dispatched generation automatically when tools might already have run.
- The `createLlm` `sessionId` currently identifies the AiderDesk task. Parent and subagent runs may share it. Give each conversation its own native session and resource ownership; finishing a subagent must not stop its parent.
- Stop owned processes and bridges on completion, cancellation, task closure and unload, without deleting session data needed for the next turn. Reconnect the new MCP endpoint when resuming after a server restart.

## Verification checklist

- Exercise reasoning → tool calls → reasoning/text and multiple approval continuations; verify message order, completion and no replay duplicates.
- Test native and MCP calls independently, including approval/rejection and exactly-once execution.
- Test all autonomy modes against Always/Ask/Never, bash patterns and approval-extension vetoes.
- Test absent callbacks on an older host: native execution must be rejected, not silently approved.
- Verify first-turn history import, continuation after a complete runtime restart, changed/cleared/compacted history, missing sessions and parent/subagent isolation.
- Confirm the UI receives original tool-result shapes, not MCP text-block arrays where strings or structured Power results are expected.
- Verify cleanup of owned resources and document any dependency on core changes in both the README and the handoff to the user.

Examples: [OpenCode Free](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/opencode-free/) for native/MCP integration and [Cursor SDK](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/cursor-sdk/) for extension-owned orchestration.
