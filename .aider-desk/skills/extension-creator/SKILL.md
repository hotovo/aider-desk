---
name: extension-creator
description: Create AiderDesk extensions by setting up extension files, defining metadata, implementing Extension interface methods, and updating documentation. Use when building a new extension, creating extension commands, tools, or event handlers.
---

# Extension Creator

Create AiderDesk extensions that extend functionality through events, commands, tools, agents, and modes.

## When to Use

Use this skill when:

- Building a new AiderDesk extension
- Creating extension commands, tools, or event handlers
- Implementing the Extension interface
- Setting up extension metadata and documentation

Do not use when:

- Simply activating an existing extension
- Making general code changes unrelated to extensions
- Running tests or builds

## Rules

### Rule: Determine extension type first

**When:** Starting extension creation

**Then:** Check if extension needs npm dependencies or multiple files

**If:** Extension needs dependencies or multiple files

**Then:** Create folder extension in `packages/extensions/extensions/my-extension/`

**If:** Extension is simple with no dependencies

**Then:** Create single-file extension in `packages/extensions/extensions/my-extension.ts`

### Rule: Implement Extension interface

**When:** Creating extension file

**Then:** Implement required methods from Extension interface

**Must:** Export `metadata` object with name, version, description, author, capabilities

**Must:** Export class as `default`

**Never:** Use `@/` imports in extension files

### Rule: Add UI components when needed

**When:** Extension needs to display UI elements

**Then:** Implement `getUIComponents()` method

**Must:** Return array of UIComponentDefinition objects with id, placement, jsx

**Must:** Define components as JSX strings or load from .jsx files

**If:** Component needs data, set `loadData: true` and implement `getUIExtensionData()`

**If:** Component triggers actions, implement `executeUIExtensionAction()`

### Rule: Update extensions.json

**When:** Extension file created

**Then:** Add entry to `packages/extensions/extensions.json`

**Must:** Include id, name, description, file or folder path, type, capabilities

**Must:** Set `hasDependencies: true` for folder extensions

### Rule: Update documentation

**When:** Extension is complete

**Then:** Add entry to `docs-site/docs/extensions/examples.md` table

**Must:** Include extension name, description, capabilities, and type

### Rule: Use proper TypeScript config for folders

**When:** Creating folder extension

**Then:** Include `tsconfig.json` with `module: ES2020+`

**Must:** Include `package.json` with name, version, main, dependencies

### Rule: Store config in extension directory

**When:** Extension needs persistent config

**Then:** Store config files in extension directory

**Never:** Store config outside extension directory

## Process

1. Determine extension type (single-file or folder)
2. Create extension file or directory structure
3. Implement Extension interface methods
4. Export metadata and default class
5. Update extensions.json
6. Update docs-site/docs/extensions/examples.md
7. Verify with code-checker

**Between steps 3 and 4:**

- If extension needs config storage, create config.ts
- If extension needs logging, create logger.ts
- If extension needs constants, create constants.ts
- If extension has UI components, create .jsx files for components (recommended for components > 20 lines)

## Preconditions

Before using this skill, verify:

- Extension purpose and required capabilities are clear
- Extension type (single-file or folder) is determined
- Extension interface and types are understood

If any precondition fails:

- Review [packages/extensions/extensions.d.ts]({projectDir}/packages/extensions/extensions.d.ts)
- Check [references/event-types.md](references/event-types.md) for event types
- Check [references/command-definition.md](references/command-definition.md) for command structure

## Postconditions

After completing this skill, verify:

- Extension implements Extension interface correctly
- Metadata export includes all required fields
- Default export is the extension class
- No `@/` imports used
- extensions.json updated correctly
- docs-site/docs/extensions/examples.md updated
- Passes code-checker verification

**Success metrics:**

- Extension loads without errors
- Extension appears in extensions list
- Extension capabilities work as expected

## Common Situations

**Situation:** Extension needs to handle events

**Pattern:**
- When: Extension needs to modify agent behavior
- Then: Implement event handler methods (onAgentStarted, onToolCalled, etc.)
- Return: Partial event object to modify behavior

**Situation:** Extension needs to register commands

**Pattern:**
- When: Extension provides slash commands
- Then: Implement getCommands() method
- Return: Array of CommandDefinition objects

**Situation:** Extension needs to add UI components

**Pattern:**
- When: Extension needs to display information in UI
- Then: Implement getUIComponents() method
- Return: Array of UIComponentDefinition objects
- Use: JSX strings or external .jsx files
- Load data: Implement getUIExtensionData() if component needs data
- Handle actions: Implement executeUIExtensionAction() for user interactions

**Situation:** Extension needs config storage

**Pattern:**
- Check: Extension needs persistent settings
- If yes: Create config.ts with loadConfig and saveConfig functions
- Store: Config files in extension directory

## References

- [packages/common/src/extensions.ts]({projectDir}/packages/common/src/extensions.ts) - Extension types and interfaces
- [event-types.md](references/event-types.md) - All event types and payloads
- [command-definition.md](references/command-definition.md) - Command structure
- [ui-components.md](references/ui-components.md) - UI component system, placements, and available components
- [examples-gallery.md](references/examples-gallery.md) - Real extension examples
- [extension-types.md](references/extension-types.md) - Single-file vs folder extensions

## Assets

- [templates/single-file.ts.template](assets/templates/single-file.ts.template) - Single-file template
- [templates/folder-extension/](assets/templates/folder-extension/) - Folder template
- [templates/ui-component.ts.template](assets/templates/ui-component.ts.template) - UI component inline template
- [templates/ui-component-external.ts.template](assets/templates/ui-component-external.ts.template) - UI component with external JSX
- [templates/Component.jsx.template](assets/templates/Component.jsx.template) - JSX component template
