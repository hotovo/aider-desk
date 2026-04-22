---
name: theme-factory
description: Create new AiderDesk UI themes by defining SCSS color variables, registering theme types, and adding i18n display names. Use when adding a theme, creating a color scheme, customizing appearance, or implementing dark mode and light mode variants.
---

# Theme Factory

Use this skill when you need to add a **new theme** to AiderDesk.

AiderDesk themes are implemented as **SCSS files** that define a `.theme-<name>` class with a full set of **CSS custom properties** (variables). The UI uses Tailwind utilities mapped to these CSS variables.

## Where themes live

- Theme files: `src/renderer/src/themes/theme-<name>.scss`
- Theme aggregator (imports all themes): `src/renderer/src/themes/themes.scss`
- Theme type registry: `packages/common/src/types/common.ts` (`THEMES`)
- Theme selector UI: `src/renderer/src/components/settings/GeneralSettings.tsx`
- Theme application: `src/renderer/src/App.tsx` (applies `theme-<name>` class to `document.body`)
- Theme display names (i18n):
  - `packages/common/src/locales/en.json` (`themeOptions.<name>`)
  - `packages/common/src/locales/zh.json` (`themeOptions.<name>`)

## Definition format

Each theme is a class:

- Class name: `.theme-<name>`
- Contents: a complete set of `--color-*` variables.

Best workflow: **copy an existing theme** (e.g. `theme-dark.scss`) and adjust values.

## Checklist: add a new theme

### 1) Choose a theme name

Pick a kebab-case name, e.g. `sunset`, `nord`, `paper`.

You will reference it consistently in:
- CSS class: `.theme-<name>`
- filename: `theme-<name>.scss`
- `THEMES` array value: `'<name>'`
- i18n key: `themeOptions.<name>`

### 2) Create the theme SCSS file

Create:
- `src/renderer/src/themes/theme-<name>.scss`

Start by copying a similar theme (dark -> dark-ish, light -> light-ish), then update the hex colors.

Minimum requirement: define **all variables** expected by the app.

Practical way to ensure completeness:
- Compare with `src/renderer/src/themes/theme-dark.scss` (or another full theme)
- Keep variable names identical; only change values.

### 3) Register the theme in the theme aggregator

Edit:
- `src/renderer/src/themes/themes.scss`

Add:
```scss
@use 'theme-<name>.scss';
```

If the file is not imported here, it won’t be included in the built CSS.

### 4) Register the theme in TypeScript types

Edit:
- `packages/common/src/types/common.ts`

Add `'<name>'` to the exported `THEMES` array.

This makes the theme selectable and type-safe.

### 5) Add i18n display names

Edit:
- `packages/common/src/locales/en.json`
- `packages/common/src/locales/zh.json`

Add entries under `themeOptions`:

```json
{
  "themeOptions": {
    "<name>": "Your Theme Name"
  }
}
```

### 6) Verify in the UI

- Open Settings → General → Theme
- Confirm the new theme appears in the dropdown
- Switch to it and confirm the whole UI updates (no restart)

### 7) Quality checks

- Contrast: confirm text is readable on all backgrounds (aim for WCAG AA)
- Verify key surfaces:
  - main background panels
  - inputs
  - buttons
  - borders/dividers
  - diff viewer colors
  - code blocks
  - muted/secondary text
- Check both states:
  - normal
  - hover/active

## Color Variable Reference

Each variable maps from `--color-<group>-<variant>` in SCSS to a Tailwind utility like `bg-<group>-<variant>`, `text-<group>-<variant>`, or `border-<group>-<variant>`. The mapping is defined in `tailwind.config.js`.

### Background layer system (`--color-bg-*`)

The app uses a **5-tier surface hierarchy** from darkest to lightest (for dark themes; reversed for light):

| Variable | Usage | Where visible |
|---|---|---|
| `bg-primary` | **Deepest background** — app body, outer containers | `body`, outer page wrapper, main content areas, inline edit panels |
| `bg-primary-light` | **Primary raised surface** — task bars, sidebar items, file viewers, content panels | TaskBar, TaskItem (idle), file viewer scrollable area, top-bar gradient end |
| `bg-primary-light-strong` | **Semi-transparent overlay** — selected items, diff/file headers, notifications, tooltip arrows, reflected messages | TaskItem (selected), PierreDiffViewer header, toast notification bg |
| `bg-secondary` | **Card/panel surface** — input fields, dialog content, chips, selected/hovered task items | Model dialog, chip items, settings cards, hover on menu items |
| `bg-secondary-light` | **Elevated input container** — search/dropdown wrappers, dropdown menus, merge button popover | Tag input containers, settings dropdown focus wrappers |
| `bg-secondary-light-strongest` | **Opaque elevated surface** — dialogs (BaseDialog), thinking blocks, inactive tab hover | BaseDialog bg, ThinkingAnswerBlock, inactive project tab hover |
| `bg-tertiary` | **Hover/highlight surface** — icon button hover, menu item hover, scrollbar thumb, diff gutter omit, CodeMirror autocomplete border | All icon button hovers, menu item hovers, scrollbar thumbs |
| `bg-tertiary-emphasis` | **Accent-tinted hover** — uses the theme's accent color at ~25% opacity for tinted hover states | Header icon button hover, delete button hover backgrounds, task badges |
| `bg-tertiary-strong` | **Stronger tinted hover** — accent color at ~50% opacity | Active project tab hover |
| `bg-fourth` | **Separator / small control surface** — vertical dividers in TaskBar, checkbox checked state, close button bg, tab hover for active tab | TaskBar dividers, Checkbox checked bg, BaseDialog close button |
| `bg-fourth-muted` | **Accent-tinted subtle bg** — accent color at ~20% opacity | Decorative/special accent backgrounds |
| `bg-fourth-emphasis` | **Accent-tinted medium bg** — accent color at ~30% opacity | Decorative/special accent backgrounds |
| `bg-fifth` | **Highest hover state** — used for "close" button hover in dialogs | BaseDialog close button hover |
| `bg-selection` | **Text selection highlight** — used in PromptField for text selection color | PromptField `::selection` color |
| `bg-code-block` | **Code block background** — standalone code blocks, diff file items, log viewer | CodeBlock component, DiffFileItem, LogsPage pre blocks |

### Diff viewer backgrounds (`--color-bg-diff-viewer-*`)

| Variable | Usage |
|---|---|
| `diff-viewer-old-primary` | Deleted line background (used in DiffViewer.scss, CompactDiffViewer) |
| `diff-viewer-old-secondary` | Deleted line character-level edit highlight |
| `diff-viewer-new-primary` | Inserted line background |
| `diff-viewer-new-secondary` | Inserted line character-level edit highlight |

### Text hierarchy (`--color-text-*`)

| Variable | Usage | Visible on |
|---|---|---|
| `text-primary` | **Primary text** — labels, headings, button text, body text | Most text throughout the app |
| `text-secondary` | **Secondary text** — icons in header, model subtitles, status text | Header icons (notebook, chart, settings), model provider text |
| `text-tertiary` | **Tertiary text** — hover state for muted items, diff modified markers, toolbar button hover | Hover state text, diff line numbers, expanded toolbar buttons |
| `text-muted-light` | **Dimmed text** — reflected messages, placeholder labels | ReflectedMessageBlock, disabled-state labels |
| `text-muted` | **Muted text** — description paragraphs, log viewer text, empty states | Settings descriptions, log output, chip empty labels |
| `text-muted-dark` | **Dark muted** — input placeholders, section dividers | PromptField placeholder, TaskSectionHeader |
| `text-dark` | **Darkest text** — very deep background text, decorative | Rarely used, deepest layer text |

### Border hierarchy (`--color-border-*`)

| Variable | Usage | Visible on |
|---|---|---|
| `border-dark` | **Subtlest border** — outer container edges, sticky headers | Home page outer border, UpdatedFilesDiffModal header, bash blocks |
| `border-dark-light` | **Light subtle border** — code blocks, sidebar section separators, task item borders | CodeBlock border, TaskSectionHeader top border, TaskItem border |
| `border-dark-light-strong` | **Semi-transparent subtle border** — reflected messages, code block `<hr>` | ReflectedMessageBlock, CodeBlock horizontal rules |
| `border-default-dark` | **Medium border** — prompt input borders (unfocused), diff comment panel | PromptField unfocused border |
| `border-default` | **Standard border** — inputs, cards, dividers, containers (most common) | Settings inputs, Home container, inline edit panels, TaskItem |
| `border-accent` | **Accent border** — focused inputs, checked checkboxes/radios, diff headers, badge borders | PromptField focus, Checkbox checked, PierreDiffViewer header |
| `border-light` | **Lightest border** — selected/focused inputs, active tab indicators | Settings active option border, input focus state |

### Accent colors (`--color-accent-*`)

| Variable | Usage |
|---|---|
| `accent-primary` | Brand accent — AI sparkle icon, welcome message bullets, commit badges, voice recording indicator |
| `accent-secondary` | Secondary accent — selected answer highlights, decorative accents |
| `accent-light` | Highlight accent — token usage bar fill, hover text for commit links |

### Status colors (`--color-success-*`, `--color-warning-*`, `--color-error-*`, `--color-info-*`)

Each has up to 7 variants with consistent suffix semantics:
- **(base)** — solid color for icons, text, badges
- **-light** — lighter shade for hover states
- **-lighter** / **-lightest** — progressively lighter for gradient effects (error, info only)
- **-subtle** — ~10% opacity for very faint backgrounds
- **-muted** — ~20% opacity for muted backgrounds
- **-emphasis** — ~30% opacity for medium-strength backgrounds
- **-strong** — ~50% opacity for strong backgrounds (error only)
- **-dark** — darker variant for darkened states (error only)
- **-text** — text color to use on top of the base color (warning, buttons)

### Button colors (`--color-button-*`)

Three button palettes (`primary`, `secondary`, `danger`) each with 5 variants. See `Button.tsx` for the full mapping:

| Variant | Usage in `contained` | Usage in `text` | Usage in `outline` |
|---|---|---|---|
| `(base)` | Background | — | Border color |
| `-light` | Hover background | — | — |
| `-subtle` | — | Hover background | Hover background |
| `-emphasis` | Hover background (danger) | — | — |
| `-text` | Text color | Text color | Text color |

The **tertiary** button color uses `bg-primary`/`bg-secondary` + `text-primary` instead of dedicated button tokens.

Disabled buttons use: `bg-bg-tertiary-strong` background + `text-text-muted` text.

### Input colors (`--color-input-*`)

Currently **not directly used** in TSX components — inputs use `bg-bg-secondary` + `border-border-default` + `text-text-primary` instead. These are defined for potential future use or custom components.

### Agent colors (`--color-agent-*`)

Semantic colors for tool/badge indicators in the AgentSelector and related UI:
- `agent-auto-approve` — auto-approve toggle indicator
- `agent-aider-tools` — aider tools icon
- `agent-power-tools` — power tools icon
- `agent-todo-tools` — todo tool badge
- `agent-tasks-tools` — tasks tool badge
- `agent-memory-tools` — memory tool badge
- `agent-skills-tools` — skills tool badge
- `agent-subagents-tools` — subagents tool badge
- `agent-context-files` — context file indicator
- `agent-repo-map` — repo map indicator
- `agent-ai-request` — AI request indicator
- `agent-sub-agent` — sub-agent indicator

### Dark theme registration

Dark themes (those that need a dark code editor) must also be added to the `isCodeEditorDarkTheme` array in `packages/common/src/types/common.ts`.

### Color opacity suffix convention

Many variables include an inline hex alpha suffix (e.g. `#D4A05440` = accent at ~25% opacity). The convention is:
- `1a` ≈ 10% — subtle
- `19` ≈ 10% — subtle (alternate)
- `26` ≈ 15% — muted
- `33` ≈ 20% — muted
- `4c` ≈ 30% — emphasis
- `4d` ≈ 30% — emphasis (alternate)
- `50` ≈ 31% — selection
- `60` ≈ 38% — strong
- `7f` ≈ 50% — strong (alternate)
- `80` ≈ 50% — semi-transparent
- `f2` ≈ 95% — almost opaque

### Global color applications (non-Tailwind)

Some components use CSS variables directly via `var(--color-*)` instead of Tailwind utilities:
- `main.css`: body background/text, CodeMirror editor styling, resize handle
- `DiffViewer.scss` / `PierreDiffViewer.scss`: diff line backgrounds, gutters
- `notifications.ts`: toast background/text styling
- `PromptField.tsx`: text selection color

## Troubleshooting

- Theme not showing up:
  - missing `@use` import in `src/renderer/src/themes/themes.scss`
  - missing entry in `THEMES` array in `packages/common/src/types/common.ts`
  - typo mismatch between `.theme-<name>` and the `<name>` stored in settings

- Some UI areas look "unstyled":
  - you likely missed one or more `--color-*` variables; compare against a known-good theme and fill in the missing ones.

- Input fields don't match theme:
  - Components use `bg-bg-secondary` + `border-border-default` for inputs, not the `input-*` tokens. Focus on the bg/border/text hierarchies instead.
