# ADR-0034: Centralized Product Telemetry and LLM Observability

## Status

Accepted (2026-08-28)

## Context

AiderDesk emits two related but distinct classes of telemetry. Product analytics report coarse application events to PostHog when a build-time public key is configured. AI/LLM observability is registered through the Vercel AI SDK's OpenTelemetry integration and selects a Langfuse or PostHog span exporter from environment configuration. These paths handle users' coding activity, so their configuration and payload boundaries must be explicit and reviewable.

The product telemetry setting currently defaults to enabled in `DEFAULT_SETTINGS`; most user-distinct events check it at capture time. Installation/uninstallation events also emit a product-level event under `PRODUCT_TELEMETRY_DISTINCT_ID`, independently of that per-user check. This ADR documents that de-facto behavior rather than incorrectly describing telemetry as default-off or universally consent-gated.

## Decision Drivers

- **Must** centralize product-event capture and provider initialization
- **Must** avoid sending prompts, code, message contents, secrets, or file contents as product analytics
- **Must** respect `settings.telemetryEnabled` for user-distinct product events
- **Must** initialize LLM tracing only when a supported exporter is configured
- **Should** distinguish product analytics consent from operator-configured LLM observability

## Considered Options

### Option A — Direct analytics and tracing SDK calls from feature code

- **Pros**: Minimal indirection.
- **Cons**: Scattered consent checks, inconsistent identity, difficult payload auditing, and backend coupling throughout the application.

### Option B — Central product manager plus telemetry exporter modules

- **Pros**: `TelemetryManager` owns PostHog product events and the stable user ID; `open-telemetry.ts`, `langfuse.ts`, and `posthog.ts` own AI SDK tracing setup; feature code uses typed manager methods.
- **Cons**: Product and LLM telemetry still have different enablement models; every new event/exporter must be reviewed for privacy and configuration semantics.

## Decision

Use `TelemetryManager` (`src/main/telemetry/telemetry-manager.ts`) as the product-analytics boundary. It creates the PostHog client only when `POSTHOG_PUBLIC_API_KEY` is present and gates user-distinct capture methods with `settings.telemetryEnabled`. Keep event payloads to coarse operational metadata such as counts, modes, booleans, and model-usage dimensions; any identifier or user-defined name requires explicit review.

Register Vercel AI SDK telemetry in `src/main/telemetry/open-telemetry.ts`. Select Langfuse when its public and secret keys are configured, otherwise select the configured PostHog tracing exporter. Treat this environment-driven tracing as a separate operator/developer observability path, not as equivalent to the product telemetry toggle.

Preserve the existing product-level extension install/uninstall events under `PRODUCT_TELEMETRY_DISTINCT_ID` as an explicit exception to user-distinct capture. Changes to that exception, the default setting, or consent semantics require updating this ADR and user-facing disclosure.

## Rationale

A central product manager makes capture sites and setting checks auditable, while exporter modules isolate the more detailed LLM tracing configuration. Separating these models avoids a false guarantee that one toggle controls every telemetry backend. Recording the current default and product-level exception gives future changes a reliable baseline.

## Consequences

### Positive

- Product analytics SDK usage and identity are concentrated in one manager
- Product-event payloads can be reviewed in one file
- LLM tracing backends can be selected by deployment configuration
- Missing build-time/exporter credentials disable the corresponding backend cleanly

### Negative

- The product telemetry default is enabled rather than opt-in
- Not every emitted event is gated by the user-distinct telemetry setting
- LLM tracing configuration is independent of the product telemetry toggle
- User-defined command or extension names can be sensitive and require scrutiny

### Risks & Mitigations

- Risk: content or secrets enter analytics properties — Mitigation: allow coarse metadata by default and explicitly review every new property
- Risk: users assume the UI toggle disables environment-configured tracing — Mitigation: document the distinction and do not describe the toggle as universal
- Risk: feature code imports telemetry SDKs directly — Mitigation: keep SDK initialization and capture inside `src/main/telemetry/`

## Guardrails for Agents

### Do

- Add product events as methods on `TelemetryManager`
- Check `telemetryEnabled` for every user-distinct product event
- Prefer counts, enums, booleans, and non-content operational metadata
- Treat command names, extension names, model names, paths, prompts, and arbitrary strings as potentially identifying
- Keep tracing exporter configuration in the telemetry modules and preserve secret redaction in logs
- Update this ADR and user-facing documentation when changing defaults or consent behavior

### Don't

- Don't claim telemetry is default-off or controlled by one universal consent switch
- Don't include code, prompts, message content, file content, credentials, or raw tool inputs/outputs in product analytics
- Don't import PostHog, Langfuse, or OpenTelemetry SDKs from feature modules
- Don't add a consent-bypass event without documenting its identity, payload, and rationale
- Don't log telemetry exporter secrets

## Related Decisions

- [ADR-0005: Vercel AI SDK as Agent Runtime](../agent-system/0005-vercel-ai-sdk-as-agent-runtime.md)
- [ADR-0013: Model Provider Adapter Registry](../model-integration/0013-provider-adapter-registry.md)
- [ADR-0026: Domain-Owned Persistence Backends](../data-and-state/0026-central-data-manager.md)
- [ADR-0038: Electron Trust Boundaries, Secrets, and Readonly Access](../security/0038-context-isolation-secrets-readonly.md)
