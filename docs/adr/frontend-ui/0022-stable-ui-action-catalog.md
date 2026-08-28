# ADR-0022: Stable UI Action Catalog

## Status

Accepted (2026-08-28)

## Context

The same user actions (open settings, new task, archive, export, focus prompt, …) must be reachable from multiple entry points: command palette, toolbar buttons, hotkeys, and (future) extensions and external callers. Registering actions ad hoc per entry point causes drift (palette has an action the toolbar lacks), label inconsistencies, and — critically — **instability of identifiers**: the command palette persists recently-used actions in localStorage, and external integrations reference actions by ID.

## Decision Drivers

- **Must** define each user-invokable action exactly once, consumable by all entry points
- **Must** keep action IDs stable across releases — they are persisted (palette recently-used) and reserved for external callers
- **Must** source labels from i18n ([ADR-0023](0023-i18n-all-locales.md)), not inline strings
- **Should** keep grouping/metadata (project, view, task categories) alongside definitions

## Considered Options

### Option A — Entry points register their own actions

- **Pros**: Local simplicity.
- **Cons**: Duplication, drift, inconsistent labels/hotkeys, and IDs owned by whoever registered last.

### Option B — Central static catalog with contractual IDs

- **Pros**: `ui-actions.ts` in `packages/common` exports `UI_ACTIONS` — a static array of `UiActionInfo` (`id`, `labelKey`, optional `descriptionKey`) with documented stability rules ("Never rename existing ids"); palette, hotkeys (`useConfiguredHotkeys`, `usePaletteCommands`), and toolbars all render from it; i18n keys guarantee translated labels.
- **Cons**: Central file needs curation; dynamic actions (project-specific commands) need a separate mechanism (custom commands, [ADR-0012](../agent-system/0012-skills-and-custom-commands.md)).

## Decision

Maintain a **static, versioned catalog of UI actions** in `packages/common/src/ui-actions.ts`. Each action has a stable string ID (e.g. `task.new`, `view.settings`, `project.close`), an i18n label key, and category grouping. All entry points — command palette, hotkey configuration, toolbar buttons — consume the catalog rather than defining actions locally. Removal or renaming of IDs is a breaking change requiring explicit migration consideration (persisted recently-used lists, external callers); deprecation happens by hiding, not deleting.

## Rationale

Making the catalog a static contract in the shared package turns action IDs into an API: safe to persist, safe to reference externally, impossible to drift between entry points. The i18n-key requirement keeps localization automatic for every new action.

## Consequences

### Positive

- One definition → palette + hotkeys + toolbar all consistent
- Persisted references and external integrations survive upgrades
- New actions are translatable by construction

### Negative

- Catalog file requires curation as the action count grows
- Truly dynamic actions (user commands) intentionally live outside this catalog — two lists to understand

### Risks & Mitigations

- Risk: someone renames an ID "for clarity" — Mitigation: explicit stability rule in the file's documentation; code review checklist; persisted-data breakage is user-visible

## Guardrails for Agents

### Do

- Add new user-invokable actions to `UI_ACTIONS` with a stable, namespaced ID (`domain.verb`) and i18n keys
- Wire entry points (palette/hotkeys/buttons) to reference catalog IDs
- Add translations for new `labelKey`s in all locale files ([ADR-0023](0023-i18n-all-locales.md))

### Don't

- Never rename or delete existing action IDs — hide/deprecate instead; they are persisted contracts
- Never hardcode label strings for catalog actions in components
- Never register a second, competing definition of an existing action in a local component

## Related Decisions

- [ADR-0012: Skills and Custom Commands](../agent-system/0012-skills-and-custom-commands.md)
- [ADR-0021: Zustand for State, Context for DI](0021-zustand-for-state-context-for-di.md)
- [ADR-0023: Internationalization](0023-i18n-all-locales.md)
