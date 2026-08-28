# ADR-0024: React Component Conventions

## Status

Accepted (2026-08-28)

## Context

A large React 19 renderer with many contributors — human and AI — needs uniform component style so that components remain predictable, reviewable, and translatable. Without enforced conventions, the codebase accumulates competing idioms (class components, `React.FC`, inline styles, ad-hoc icon libraries), raising the cost of every change.

## Decision Drivers

- **Must** keep components small, single-purpose, and in their own files
- **Must** have one styling system and one icon source
- **Must** keep handlers testable and typed without `any` (ESLint enforces)
- **Should** make AI-generated components indistinguishable in style from human-written ones

## Considered Options

### Option A — Per-developer style, enforced only by review

- **Consistent?** No — drift is guaranteed with many contributors.

### Option B — Codified conventions, ESLint-enforced where possible

- **Pros**: Mechanical predictability; ESLint catches violations (`no-explicit-any`, etc.); conventions double as agent guardrails.
- **Cons**: Requires discipline for the rules lint can't check (file size, handler extraction).

## Decision

Adopt these conventions for all renderer components (documented in `CONVENTIONS.md` and applied throughout `src/renderer/src/components/`):

- **Function components only**, defined as arrow functions; no `React.FC`; props typed as `type Props` placed immediately above the component, destructured in the signature (`({ value }: Props)`)
- **No `import React from 'react'`** (React 19 JSX transform); import specific types/hooks (`import { MouseEvent } from 'react'`)
- **One component per file**; extract to a dedicated file once a component grows past ~50 lines or gains own state/hooks/types
- **Handlers extracted** to named functions (`const handleClick = (e: MouseEvent<HTMLDivElement>) => …`), not inline arrows in JSX
- **Styling via Tailwind CSS** (utility classes; `clsx` for conditional classes); themes via the theme system in `src/renderer/src/themes/`
- **Icons from `react-icons`** only
- **No `any`** — ESLint fails the build; find the existing type
- **Overlay/dialog coordination** clears competing state in the show handler, not via `useEffect`
- **Unused parameters are omitted**, not underscore-prefixed, unless positional necessity requires them

## Rationale

These rules optimize for consistency and reviewability over expressiveness. Arrow functions, extracted handlers, and colocated `type Props` make components trivially comparable; Tailwind + react-icons eliminate styling/icon anarchy; the no-`any` rule keeps the type system trustworthy — which matters doubly because AI agents write much of the new code and follow explicit rules better than vibes.

## Consequences

### Positive

- Uniform, predictable component structure across the renderer
- Lint-enforceable rules catch violations automatically
- Agents produce conforming code on first attempt

### Negative

- Slight boilerplate (Props types, handler extraction)
- Extraction discipline requires judgment about "too big"

### Risks & Mitigations

- Risk: large components accrete anyway — Mitigation: review checklist; the ~50-line guideline is explicit in `CONVENTIONS.md`

## Guardrails for Agents

### Do

- Before writing a component, read neighboring components and mimic their structure, prop patterns, and Tailwind usage
- Define `type Props` immediately above the component; destructure props in the signature
- Use `clsx` for conditional classes and `react-icons` for icons; wire handlers as named functions
- Check existing components for reuse before creating new ones

### Don't

- Never use `React.FC`, default React imports, `any`, inline styles, or non-react-icons icon sources
- Never define a substantial component inline inside another component's file
- Never add UI text without i18n keys ([ADR-0023](0023-i18n-all-locales.md))

## Related Decisions

- [ADR-0021: Zustand for State, Context for DI](0021-zustand-for-state-context-for-di.md)
- [ADR-0023: Internationalization](0023-i18n-all-locales.md)
