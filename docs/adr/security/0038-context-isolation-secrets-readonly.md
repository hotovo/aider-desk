# ADR-0038: Electron Trust Boundaries, Secrets, and Readonly Access

## Status

Accepted (2026-08-28)

## Context

AiderDesk handles source code, shell access, provider credentials, extension code, rendered LLM output, and optionally network clients. Its security posture is not one uniform sandbox. The primary Electron window uses a preload API and does not enable Node integration, but explicitly sets `sandbox: false`, `webSecurity: false`, and `webviewTag: true`. The local progress window is a narrower trusted-content exception with `nodeIntegration: true` and `contextIsolation: false`. Settings, provider discovery, and realtime voice flows also make some credentials available to renderer code.

Remote readonly mode has a different boundary: the server rejects the normal `/api` surface while readonly mode is active and exposes a dedicated `/api/readonly` router. Its bootstrap returns only display settings, but it can expose project/task content and, when enabled, constrained extension UI data and actions. Readonly means application mutation is restricted; it does not mean the remote client receives no sensitive project data.

## Decision Drivers

- **Must** expose privileged desktop operations through the typed preload `ApplicationAPI` rather than ad-hoc renderer Node imports ([ADR-0002](../core-architecture/0002-preload-ipc-bridge-and-api-contract.md))
- **Must** document and minimize Electron security exceptions instead of assuming default sandbox guarantees
- **Must** keep credentials out of logs, telemetry, readonly bootstrap payloads, and unrelated UI state
- **Must** enforce readonly routing and project/task validation on the server ([ADR-0020](../api-surface/0020-remote-access-tunnel-and-readonly-mode.md))
- **Must** authenticate or otherwise protect remotely reachable standard/server deployments
- **Should** reduce renderer credential exposure and disabled web security over time

## Considered Options

### Option A — Fully sandboxed renderer with all secrets and network calls main-side

- **Pros**: Strongest renderer-compromise boundary and smallest credential exposure.
- **Cons**: Does not describe the current architecture; webview/cross-origin workflows and realtime browser voice transports would need redesign and additional IPC/proxy services.

### Option B — Trusted desktop renderer with a typed privilege bridge and explicit exceptions

- **Pros**: Matches current Electron configuration; filesystem/process operations remain behind `ApplicationAPI`; browser media and selected provider calls can run directly; exceptions are reviewable rather than hidden.
- **Cons**: `sandbox: false`, disabled web security, webviews, runtime extension UI, and renderer-held credentials increase impact if renderer content is compromised.

### Option C — Expose the standard API in readonly mode and hide controls in the UI

- **Pros**: Little server work.
- **Cons**: A hostile client can call mutating endpoints directly; UI-only readonly enforcement is not a security boundary.

## Decision

Treat the **primary desktop renderer as a trusted-but-exposed application surface**, not as a security sandbox. Keep OS/filesystem/process capabilities behind the typed preload bridge and avoid enabling Node integration in the primary window. Preserve current Electron exceptions only where existing functionality requires them, and subject changes involving `sandbox`, `webSecurity`, `webviewTag`, navigation, window creation, runtime extension UI, or renderer credentials to explicit security review.

Treat the progress window as a local trusted-content exception: it loads only packaged/development-local progress content and must not navigate to or render untrusted content while Node integration is enabled.

Store settings in the main-process `Store`, but acknowledge that standard desktop settings and selected provider workflows can pass credentials to renderer code. Minimize that exposure, never forward credentials to readonly bootstrap/clients, and never log or include them in telemetry. Voice's direct renderer token use is documented in [ADR-0037](../platform-services/0037-provider-side-voice-transcription.md).

Enforce remote readonly mode server-side. While active, reject the normal API, validate exact configured projects/tasks in `ReadonlyApi`, expose only the dedicated readonly bootstrap/data routes, and gate extension UI. Extension UI actions are an explicit capability exception and must remain constrained to declared, resolved components.

## Rationale

This record must provide usable guardrails for the code that exists. Claiming that the renderer is sandboxed or never receives credentials would conceal the areas requiring the most scrutiny. A typed preload still reduces accidental privilege access, while server-side readonly routing provides a genuine enforcement point for remote clients. Explicit exceptions make future hardening measurable.

## Consequences

### Positive

- Privileged desktop APIs remain centralized and typed
- Current Electron and renderer credential risks are visible to reviewers
- Readonly clients cannot bypass restrictions by calling the standard API
- Readonly bootstrap avoids exposing full settings/provider configuration

### Negative

- The primary renderer is not sandboxed and has web security disabled
- Runtime extension UI, webviews, and rendered remote/LLM content expand the renderer attack surface
- Some provider tokens exist in renderer memory
- The progress window has full Node access within its local-content trust assumption
- Readonly clients can still receive source/task content and optionally invoke extension UI actions

### Risks & Mitigations

- Risk: renderer injection reaches sensitive APIs or credentials — Mitigation: sanitize/render defensively, constrain navigation/windows/webviews, keep preload methods narrow, and reduce renderer-side secrets where feasible
- Risk: the progress window navigates to untrusted content — Mitigation: keep its load target local and reject feature growth that introduces remote content
- Risk: readonly extension actions mutate state unexpectedly — Mitigation: require declared component/action resolution, project/task validation, and an explicit enablement gate
- Risk: remote standard API is exposed without protection — Mitigation: use configured authentication/CORS/network controls and do not equate readonly routing with authentication

## Guardrails for Agents

### Do

- Route filesystem, shell, process, and other privileged desktop operations through `ApplicationAPI`
- Validate renderer/client inputs again in main-process and REST handlers
- Review navigation, webview, external URL, markdown/HTML, and extension UI changes as security-sensitive
- Keep readonly routes separate and validate project/task/component identifiers server-side
- Return the minimum display configuration needed by readonly bootstrap
- Redact credentials, authorization headers, prompts, and sensitive content from logs and product telemetry
- Prefer moving new credentialed network operations main-side unless browser-only transport requires renderer execution

### Don't

- Don't claim `sandbox: true`, `webSecurity: true`, or universal context isolation without checking every `BrowserWindow`
- Don't enable Node integration in the primary renderer or load remote/untrusted content in the progress window
- Don't add new preload/IPC escape hatches that expose generic filesystem, process, or Electron primitives
- Don't send full settings or provider profiles to readonly clients
- Don't assume renderer-held values are secret from renderer code or DevTools
- Don't rely on hidden/disabled UI controls to enforce readonly behavior
- Don't treat readonly mode as authentication or as a guarantee that project data is non-sensitive

## Related Decisions

- [ADR-0001: Electron Multi-Process Model](../core-architecture/0001-electron-multi-process-model.md)
- [ADR-0002: Preload IPC Bridge](../core-architecture/0002-preload-ipc-bridge-and-api-contract.md)
- [ADR-0009: Tool Approval and Autonomy Modes](../agent-system/0009-tool-approval-and-autonomy-modes.md)
- [ADR-0020: Remote Access and Readonly Mode](../api-surface/0020-remote-access-tunnel-and-readonly-mode.md)
- [ADR-0029: Lifecycle-Hook Extension System](../extensions/0029-lifecycle-hook-extension-system.md)
- [ADR-0034: Centralized Product Telemetry and LLM Observability](../platform-services/0034-telemetry-abstraction.md)
- [ADR-0037: Renderer-Side Realtime Voice Transcription](../platform-services/0037-provider-side-voice-transcription.md)
