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
- Theme type registry: `src/common/types.ts` (`THEMES`)
- Theme selector UI: `src/renderer/src/components/settings/GeneralSettings.tsx`
- Theme application: `src/renderer/src/App.tsx` (applies `theme-<name>` class to `document.body`)
- Theme display names (i18n):
  - `src/common/locales/en.json` (`themeOptions.<name>`)
  - `src/common/locales/zh.json` (`themeOptions.<name>`)

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
- `src/common/types.ts`

Add `'<name>'` to the exported `THEMES` array.

This makes the theme selectable and type-safe.

### 5) Add i18n display names

Edit:
- `src/common/locales/en.json`
- `src/common/locales/zh.json`

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

## Troubleshooting

- Theme not showing up:
  - missing `@use` import in `src/renderer/src/themes/themes.scss`
  - missing entry in `THEMES` array in `src/common/types.ts`
  - typo mismatch between `.theme-<name>` and the `<name>` stored in settings

- Some UI areas look “unstyled”:
  - you likely missed one or more `--color-*` variables; compare against a known-good theme and fill in the missing ones.
