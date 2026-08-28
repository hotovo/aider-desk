# ADR-0037: Renderer-Side Realtime Voice Transcription

## Status

Accepted (2026-08-28)

## Context

Voice control needs microphone capture, provider session management, incremental transcription, visible recording state, and inactivity handling. Shipping a local speech model would add large downloads and native inference complexity. The supported providers already expose realtime transcription protocols, but their transports differ: OpenAI uses WebRTC plus a data channel, while Gemini uses its Live API and browser audio processing.

Audio capture and both provider clients currently run in the renderer. Their session configuration includes the provider token, so voice is an explicit exception to any rule that provider credentials are used only in the main process (see [ADR-0038](../security/0038-context-isolation-secrets-readonly.md)).

## Decision Drivers

- **Must** keep microphone capture and realtime browser APIs near the renderer UX
- **Must** support incremental transcription and provider-specific session events
- **Must** avoid bundling a local speech model and native inference stack
- **Must** make network use, credential exposure, and audio transfer explicit
- **Should** stop and clean up sessions deterministically on user action, inactivity, errors, or component teardown

## Considered Options

### Option A — Bundled local speech-to-text

- **Pros**: Audio and inference can remain offline after model installation.
- **Cons**: Large model/runtime footprint, native and platform complexity, and substantial CPU/memory cost.

### Option B — Main-process proxy for hosted transcription

- **Pros**: Provider credentials can remain out of the renderer; one main-side policy point.
- **Cons**: Browser microphone/WebRTC data must be bridged across IPC; realtime transport becomes more complex; Gemini and OpenAI still require provider-specific session logic.

### Option C — Renderer provider adapters using hosted realtime APIs

- **Pros**: `src/renderer/src/voice/openai.ts` uses browser WebRTC directly; `gemini.ts` manages Gemini Live sessions and audio processing; transcription callbacks feed the prompt UI with low latency.
- **Cons**: Audio leaves the device and provider tokens are present in renderer memory; provider protocol changes affect renderer code; no offline fallback.

## Decision

Implement voice control as **renderer-side realtime provider adapters** under `src/renderer/src/voice/`. `OpenAIVoiceProvider` opens an OpenAI realtime WebRTC session, reads transcription events from its data channel, and applies an idle timeout. `GeminiVoiceProvider` connects to Gemini Live, captures/processes browser audio, queues audio and transcription events, and manages silence/session state.

Select support through the existing provider strategy/configuration UI. Voice starts only after explicit user action and uses the provider token supplied in `VoiceSessionConfig`. Do not persist raw recordings; release media tracks, audio nodes, peer connections, sessions, timers, and callbacks when a session stops.

## Rationale

The browser already owns microphone permission and the realtime transports needed by the supported providers. Keeping adapter code next to that lifecycle avoids an additional IPC streaming protocol and avoids shipping local speech inference. This choice knowingly trades a broader renderer credential boundary for implementation simplicity and low latency; that trade-off must remain visible.

## Consequences

### Positive

- No bundled speech model or native inference dependency
- Incremental transcription with provider-native realtime protocols
- Browser media lifecycle and recording UI remain in one process
- Provider-specific behavior is isolated behind `VoiceProvider`

### Negative

- Voice requires network connectivity and a supported provider
- Audio is transmitted to the selected provider
- Provider credentials are available to renderer-side voice code
- WebRTC/Live API changes and browser media quirks require adapter maintenance

### Risks & Mitigations

- Risk: recording continues after the UI appears stopped — Mitigation: centralize cleanup in provider `stopSession` paths and test all exit/error cases
- Risk: token leakage from renderer logs or errors — Mitigation: never log session config, authorization headers, or provider payloads containing credentials
- Risk: sensitive audio is sent unexpectedly — Mitigation: require explicit start, show active state, and stop on user action/inactivity

## Guardrails for Agents

### Do

- Implement provider behavior behind the `VoiceProvider`/`VoiceSession` contracts
- Keep recording user-initiated and visibly active
- Tear down every browser media and provider resource on stop/error
- Preserve incremental `onTranscription`, state, error, and stop callbacks
- Treat voice tokens and provider events as sensitive renderer data
- Update security documentation if credential/session placement changes

### Don't

- Don't describe the feature as a simple file-upload transcription API; it uses realtime sessions
- Don't persist raw microphone audio or session tokens
- Don't log authorization headers, `VoiceSessionConfig`, or raw provider events indiscriminately
- Don't send audio to a provider other than the one selected for the active voice configuration
- Don't prohibit a future main-process proxy categorically; require a new decision if the security/transport trade-off changes

## Related Decisions

- [ADR-0013: Model Provider Adapter Registry](../model-integration/0013-provider-adapter-registry.md)
- [ADR-0021: Zustand for State, Context for Dependency Injection](../frontend-ui/0021-zustand-for-state-context-for-di.md)
- [ADR-0038: Electron Trust Boundaries, Secrets, and Readonly Access](../security/0038-context-isolation-secrets-readonly.md)
