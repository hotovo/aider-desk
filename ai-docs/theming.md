# AiderDesk Theming System: Semantic Color Palette

## Introduction

This document outlines the semantic color palette for AiderDesk. The goal is to define a set of color names based on their functional purpose within the UI, rather than their specific visual 
characteristics (e.g., "dark gray"). This approach allows for easier theme management, consistency across the application, and simpler updates in the future.

The color definitions below map to specific Tailwind CSS `neutral-*` classes that reflect the *current dark theme* of the application. This ensures that adopting these semantic names will not
change the existing visual appearance.

## Color Palette

### Text Colors

| Semantic Name     | Tailwind Class      | Description                                                                 |
|-------------------|---------------------|-----------------------------------------------------------------------------|
| `text-primary`    | `text-neutral-100`  | Main text, titles, important labels, active button text, input field text.  |
| `text-secondary`  | `text-neutral-200`  | Less prominent text, descriptions, secondary labels, tooltips.              |
| `text-tertiary`   | `text-neutral-400`  | Placeholder text, hints, informational messages, disabled text.             |
| `text-code`       | `text-neutral-300`  | Content within code blocks and inline code snippets.                        |
| `text-interactive-hover` | `text-neutral-300` | Text color on hover for interactive elements (e.g., links, buttons).    |

### Background Colors

| Semantic Name         | Tailwind Class      | Description                                                                              |
|-----------------------|---------------------|------------------------------------------------------------------------------------------|
| `bg-surface-1`        | `bg-neutral-950`    | Outermost page/view background (often `from-neutral-950` in gradients).                  |
| `bg-surface-2`        | `bg-neutral-900`    | Main content area background, popups, tooltips, code/pre blocks (often `to-neutral-900`).|
| `bg-surface-3`        | `bg-neutral-850`    | Background for distinct sections like message blocks, input fields, diff viewer panels.  |
| `bg-element-primary`  | `bg-neutral-800`    | Background for UI elements like dialogs, inputs, dropdowns, default buttons, sliders.    |
| `bg-element-hover`    | `bg-neutral-750`    | Background for hovered interactive elements (e.g., list items, buttons).                 |
| `bg-element-active`   | `bg-neutral-700`    | Background for active/selected states (e.g., pressed buttons, selected tabs).          |
| `bg-element-selected` | `bg-neutral-600`    | Background for distinctly selected items or primary action buttons.                      |
| `bg-disabled`         | `bg-neutral-700`    | Background for disabled interactive elements (often matching `border-primary`).          |

### Border Colors

| Semantic Name     | Tailwind Class              | Description                                                                    |
|-------------------|-----------------------------|--------------------------------------------------------------------------------|
| `border-primary`  | `border-neutral-700`        | Default border for inputs, dialogs, dropdowns, cards (often `border-opacity-50`).|
| `border-secondary`| `border-neutral-600`        | Less prominent borders, dividers.                                              |
| `border-focus`    | `border-neutral-200`        | Border color for elements on keyboard focus (`focus:border-neutral-200`).        |
| `border-selected` | `border-neutral-400`        | Border color for selected items (e.g., context files).                         |

### Icon Colors

| Semantic Name     | Tailwind Class      | Description                                                              |
|-------------------|---------------------|--------------------------------------------------------------------------|
| `icon-primary`    | `text-neutral-100`  | Primary icons (often inherits text color).                               |
| `icon-secondary`  | `text-neutral-400`  | Less prominent, decorative, or inactive icons.                           |
| `icon-interactive-hover` | `text-neutral-300` | Icon color on hover for interactive icons.                             |

### Scrollbar & Slider Components

| Semantic Name         | Tailwind Class                | Description                                          |
|-----------------------|-------------------------------|------------------------------------------------------|
| `scrollbar-thumb`     | `scrollbar-thumb-neutral-600` | Draggable part of the scrollbar.                     |
| `scrollbar-track`     | `scrollbar-track-neutral-800` | Background of the scrollbar.                         |
| `slider-track-empty`  | `bg-neutral-700`              | The part of a slider track that is not filled.       |
| `slider-track-fill`   | `bg-neutral-500`              | The filled part of a slider track.                   |

## Usage Guidelines

When developing new components or refactoring existing ones:

1.  **Prioritize semantic names:** Instead of directly using `neutral-*` classes, refer to this guide and choose the appropriate semantic name based on the element's function.
2.  **Maintain consistency:** Using these defined names will help ensure a consistent look and feel across the application.
3.  **Future Theming:** This system will simplify future theme adjustments. Changes to the underlying Tailwind classes for these semantic names can be made in a central location (once a CSS 
variable system or similar is implemented based on this documentation).

This documentation serves as the first step towards a more robust theming system. The next phase would involve implementing these semantic names, possibly through CSS custom properties 
(variables) or by configuring Tailwind's theme extension.

## Current Theming System Implementation

The application already has a sophisticated theming system using CSS custom properties:

### System Architecture
- **Theme definitions**: [`src/common/themes/themes.json`](file:///Users/jkneen/Documents/GitHub/flows/aider-desk/src/common/themes/themes.json) - Contains 4 predefined themes (dark-default, light-default, dark-midnight, light-blue)
- **CSS variables**: [`src/renderer/src/styles/theme-variables.css`](file:///Users/jkneen/Documents/GitHub/flows/aider-desk/src/renderer/src/styles/theme-variables.css) - Defines all `--theme-*` CSS variables
- **Theme hook**: [`src/renderer/src/hooks/useThemeVariables.ts`](file:///Users/jkneen/Documents/GitHub/flows/aider-desk/src/renderer/src/hooks/useThemeVariables.ts) - Dynamically applies theme colors to CSS variables
- **React context**: [`src/renderer/src/context/ThemeContext.tsx`](file:///Users/jkneen/Documents/GitHub/flows/aider-desk/src/renderer/src/context/ThemeContext.tsx) - Manages theme state and switching

### Current Variable Structure
The existing system uses these CSS variable categories:
- `--theme-background-*` (primary, secondary, tertiary, input)
- `--theme-foreground-*` (primary, secondary, tertiary, error)  
- `--theme-border-*` (primary, secondary)
- `--theme-accent-*` (primary, secondary, tertiary)
- `--theme-button-*` (primary, secondary, danger)

### Implementation Status
✅ **IMPLEMENTED**: The semantic color palette has been implemented using the original subtle colors for optimal visual hierarchy.

| Semantic Name → CSS Variable → Value |
|---------------------------------------|
| `bg-surface-1` → `--theme-background-primary` → `#141417` (neutral-950) |
| `bg-surface-2` → `--theme-background-secondary` → `#191a22` (neutral-900) | 
| `bg-surface-3` → `--theme-background-tertiary` → `#222431` (neutral-850) |
| `bg-element-primary` → `--theme-background-input` → `#2a2c3f` (neutral-800) |
| `text-primary` → `--theme-foreground-primary` → `#f1f3f5` (neutral-100) |
| `text-secondary` → `--theme-foreground-secondary` → `#adb5bd` (custom muted) |
| `text-tertiary` → `--theme-foreground-tertiary` → `#6c757d` (custom muted) |
| `border-primary` → `--theme-border-primary` → `#3d4166` (custom muted) |
| `border-secondary` → `--theme-border-secondary` → `#585c75` (custom muted) |

**Note**: Text and border colors use the original custom muted values instead of pure neutral scale for better visual subtlety in dark themes.

**Next Steps**: Components can now be gradually migrated from hardcoded `neutral-*` classes to semantic names, which will automatically use the correct theme values through CSS variables.
