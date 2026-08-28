# ADR-0023: Internationalization for All User-Facing Strings

## Status

Accepted (2026-08-28)

## Context

AiderDesk serves an international user base (English, Chinese, Russian locales ship; the settings language selector includes more). Hardcoded UI strings make translation impossible after the fact and scatter user-facing text across hundreds of components. The i18n system must also be usable outside React (stores, managers building UI-bound data) and for data defined in `packages/common` (UI actions, agent prompts labels).

## Decision Drivers

- **Must** externalize every user-facing string, including those defined in shared packages
- **Must** keep locale files complete — a missing key must never render raw keys or English fallbacks silently in other locales
- **Should** make adding a string a mechanical, reviewable change (key + all locale files in one commit)

## Considered Options

### Option A — Hardcoded strings, translate later

- **Pros**: Faster initial development.
- **Cons**: Retrofitting i18n across a large renderer is prohibitively expensive; locale parity decays immediately.

### Option B — i18next with central locale files in the shared package

- **Pros**: `packages/common/src/locales/` (`en.json`, `zh.json`, `ru.json`, `ko.json`) holds all strings — usable from renderer components and from common-defined data (e.g. `UiActionInfo.labelKey`); i18next integration in `src/renderer/src/i18n/`; keys are reviewable as a unit with translations.
- **Cons**: Key naming discipline required; locale files grow large; every UI change touches every shipped locale file.

## Decision

Use **i18next** with all user-facing strings externalized as keys into every shipped file in `packages/common/src/locales/` (currently `en.json`, `zh.json`, `ru.json`, and `ko.json`). Components reference keys, never literals; shared-package data (UI actions catalog [ADR-0022](0022-stable-ui-action-catalog.md), settings labels, prompts UI) carries `labelKey` references. English (`en.json`) is the source of truth; every other locale must be updated in the same change — a new UI string without its translations is an incomplete change. Language selection is a user setting applied at runtime.

## Rationale

Centralizing locale files in `@common` lets every process and package share one translation source, and the key-referencing pattern (vs string copies) keeps translations stable while wording evolves. Same-change translation updates are the only reliable way to prevent silent locale decay.

## Consequences

### Positive

- Full localization for all shipped languages with a single, auditable string source
- Shared-package data participates in i18n without renderer coupling
- Missing-translation regressions are visible in review (file diff parity)

### Negative

- Every UI change touches locale files — slightly more friction
- Key renames require updating references in code + 3 locale files together

### Risks & Mitigations

- Risk: agents add strings to `en.json` only — Mitigation: guardrails below; review checklist; locale parity can be verified by diffing key sets

## Guardrails for Agents

### Do

- Add every new user-facing string as an i18n key in `en.json` and every other shipped locale file in the same change
- Reference keys from components and shared data (`labelKey` pattern)
- Keep key naming consistent with the surrounding namespace (`settings.`, `task.`, `uiActions.`, …)

### Don't

- Never hardcode user-facing text in components — not even "temporary" strings
- Never add a key to `en.json` without the other locale files; never delete keys still referenced
- Never interpolate user-facing text by string concatenation — use i18next interpolation

## Related Decisions

- [ADR-0022: Stable UI Action Catalog](0022-stable-ui-action-catalog.md)
- [ADR-0024: React Component Conventions](0024-component-conventions.md)
