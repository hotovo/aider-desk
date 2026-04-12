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

### Rule: Choose installation target first

**When:** Starting extension creation

**Then:** Ask the user where to install the extension

**If:** Working inside the AiderDesk project (the current project is the aider-desk repository)

**Then:** Offer three options:
1. **Current Project** — Install to `.aider-desk/extensions/` in the current project (project-scoped)
2. **Global** — Install to `~/.aider-desk/extensions/` (available in all projects)
3. **In-Repo** — Create inside `packages/extensions/extensions/` (ships with AiderDesk app)

**If:** Working outside the AiderDesk project

**Then:** Offer two options:
1. **Current Project** — Install to `.aider-desk/extensions/` in the current project (project-scoped)
2. **Global** — Install to `~/.aider-desk/extensions/` (available in all projects)

**Must:** Wait for user's choice before proceeding. The chosen target determines the entire workflow.

**Reference:** [references/install-targets.md](references/install-targets.md) for full details on each target.

### Rule: Follow the correct flow for the chosen target

**When:** User has chosen an installation target

**If:** Target is **Current Project** or **Global**

**Then:** Follow the [Project / Global Flow](references/project-global-flow.md):
1. Determine extension type (single-file or folder)
2. Create extension file(s) in the target directory (`.aider-desk/extensions/` or `~/.aider-desk/extensions/`)
3. Implement Extension interface methods
4. Export metadata and default class
5. Verify the extension loads (auto-discovered, no registry needed)

**If:** Target is **In-Repo**

**Then:** Follow the [In-Repo Flow](references/in-repo-flow.md):
1. Determine extension type (single-file or folder)
2. Create extension file(s) in `packages/extensions/extensions/`
3. Implement Extension interface methods
4. Export metadata and default class
5. **Register in `packages/extensions/extensions.json`**
6. **Document in `docs-site/docs/extensions/examples.md`**
7. Install npm dependencies if folder extension
8. Verify with type checking

### Rule: Determine extension type

**When:** Creating extension files (after target is chosen)

**Then:** Check if extension needs npm dependencies or multiple files

**If:** Extension needs dependencies or multiple files

**Then:** Create folder extension

**If:** Extension is simple with no dependencies

**Then:** Create single-file extension

### Rule: Implement Extension interface

**When:** Creating extension file

**Then:** Implement required methods from Extension interface

**Must:** Define `static metadata` property on the class with name, version, description, author, capabilities

**Must:** Export class as `default` (e.g., `export default class MyExtension implements Extension`)

**Never:** Use `@/` imports in extension files

### Rule: Add UI components when needed

**When:** Extension needs to display UI elements in task page placements

**Then:** Implement `getUIComponents()` method

**Must:** Return array of UIComponentDefinition objects with id, placement, jsx

**Must:** Define components as JSX strings or load from .jsx files

**If:** Component needs data, set `loadData: true` and implement `getUIExtensionData()`

**If:** Component triggers actions, implement `executeUIExtensionAction()`

### Rule: Add config component for extension settings

**When:** Extension needs user-configurable settings (shown in gear icon dialog)

**Then:** Implement three methods: `getConfigComponent()`, `getConfigData()`, `saveConfigData()`

**Must:** Return JSX string from `getConfigComponent()` — use external .jsx file for components > 20 lines

**Must:** Load/merge defaults in `getConfigData()`, persist merged data in `saveConfigData()`

**Must:** Store config file in extension directory via `join(__dirname, 'config.json')`

**Must:** Use `ui.*` components (`ui.Input`, `ui.Checkbox`, etc.) instead of raw HTML elements

**Should:** Avoid inner state (`useState`/`useEffect`) for simple form fields — read directly from `config` prop, call `updateConfig` on change. Only use local state for derived values or transient UI state.

**Never:** Use `'extension-settings'` placement — it was removed; use the dedicated config API instead

### Rule: Update registry and docs (In-Repo only)

**When:** Target is In-Repo and extension file is created

**Then:** Add entry to `packages/extensions/extensions.json`

**Must:** Include id, name, description, file or folder path, type, capabilities

**Must:** Set `hasDependencies: true` for folder extensions

**Then:** Add entry to `docs-site/docs/extensions/examples.md` table

**Must:** Include extension name, description, capabilities, and type

**When:** Target is Project or Global

**Then:** Do NOT modify `extensions.json` or `examples.md` — these are only for built-in extensions

### Rule: Use proper TypeScript config for folders

**When:** Creating folder extension

**Then:** Include `tsconfig.json` with `module: ES2020+`

**Must:** Include `package.json` with name, version, main, dependencies

### Rule: Store config in extension directory

**When:** Extension needs persistent config

**Then:** Store config files in extension directory

**Never:** Store config outside extension directory

## Process Overview

### For Project / Global targets:

1. Ask user: Current Project or Global?
2. Determine extension type (single-file or folder)
3. Create extension file or directory structure in target dir
4. Implement Extension interface methods
5. Export metadata and default class
6. Verify extension loads (auto-discovered)

**Between steps 3 and 5:**
- If extension needs config storage, create config.ts (or use inline getConfigData/saveConfigData)
- If extension has a settings UI (config component), create ConfigComponent.jsx and implement the three config methods
- If extension needs logging, create logger.ts
- If extension needs constants, create constants.ts
- If extension has placement-based UI components, create .jsx files for components (recommended for components > 20 lines)

### For In-Repo target:

1. Confirm user wants In-Repo (only available in aider-desk project)
2. Determine extension type (single-file or folder)
3. Create extension file or directory structure in `packages/extensions/extensions/`
4. Implement Extension interface methods
5. Export metadata and default class
6. **Register in `packages/extensions/extensions.json`**
7. **Document in `docs-site/docs/extensions/examples.md`**
8. Run `npm install` in `packages/extensions/` (folder extensions)
9. Verify with type checking

**Between steps 3 and 5:**
- Same optional files as Project/Global flow above

## Preconditions

Before using this skill, verify:

- Installation target has been chosen by the user
- Extension purpose and required capabilities are clear
- Extension type (single-file or folder) is determined
- Extension interface and types are understood

If any precondition fails:

- Review [packages/common/src/extensions.ts](https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/common/src/extensions.ts) for types
- Check [references/install-targets.md](references/install-targets.md) for target options
- Check [references/event-types.md](references/event-types.md) for event types
- Check [references/command-definition.md](references/command-definition.md) for command structure

## Postconditions

After completing this skill, verify:

- Extension implements Extension interface correctly
- Static `metadata` property on the class includes all required fields (name, version)
- Default export is the extension class
- No `@/` imports used
- **If In-Repo:** extensions.json updated correctly
- **If In-Repo:** docs-site/docs/extensions/examples.md updated
- **If In-Repo:** Type checking passes
- Extension loads without errors
- Extension appears in extensions list
- Extension capabilities work as expected

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

**Situation:** Extension needs to log messages

**Pattern:**
- If: Debug/internal logging (developer diagnostics, not shown to users)
- Then: Use `context.log(message, type)` — logs to backend console only
- If: User-visible output (showing results, status, timing info in the chat)
- Then: Use `context.getTaskContext()?.addLogMessage(level, message)` — displays in task's chat UI
- When ambiguous: If the user says "log", "show", "display", or "report" something, default to `addLogMessage` (user-visible). Use `context.log` only for internal diagnostics.
- Note: `context.log` is always available; `getTaskContext()` returns `null` outside a task, so always use optional chaining (`?.`)

**Situation:** Extension needs config storage

**Pattern:**
- Check: Extension needs persistent settings
- If yes: Create config.ts with loadConfig and saveConfig functions
- Store: Config files in extension directory

**Situation:** Extension needs a settings UI (config component)

**Pattern:**
- When: Extension has user-configurable options that should appear in the Settings dialog
- Then: Implement `getConfigComponent()`, `getConfigData()`, `saveConfigData()` methods
- JSX: Return a `.jsx` file content via `readFileSync(join(__dirname, './ConfigComponent.jsx'), 'utf-8')`
- Props: Component receives `{ config, updateConfig, ui, icons, models, providers, ... }`
- Flow: Dialog opens → loads data via getConfigData → renders JSX with props → user edits → Save calls saveConfigData
- Reference: [config-components.md](references/config-components.md) for full guide and examples

## References

### Target Selection

- [install-targets.md](references/install-targets.md) - All three installation targets, when to use each, key differences

### Flows

- [project-global-flow.md](references/project-global-flow.md) - Step-by-step for Project and Global installations
- [in-repo-flow.md](references/in-repo-flow.md) - Step-by-step for In-Repo (packages/extensions/) installations

### Technical Reference (all targets)

- [packages/common/src/extensions.ts](https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/common/src/extensions.ts) - Extension types and interfaces
- [extension-interface.md](references/extension-interface.md) - Full Extension interface, ExtensionContext, TaskContext, Metadata
- [extension-types.md](references/extension-types.md) - Single-file vs folder extensions, examples, extensions.json format
- [event-types.md](references/event-types.md) - All event types and payloads
- [command-definition.md](references/command-definition.md) - Command structure
- [ui-components.md](references/ui-components.md) - UI component system, placements, and available components
- [config-components.md](references/config-components.md) - Config component API (settings UI), methods, JSX format, and patterns
- [examples-gallery.md](references/examples-gallery.md) - Real extension examples

## Assets

- [templates/single-file.ts.template](assets/templates/single-file.ts.template) - Single-file template
- [templates/folder-extension/](assets/templates/folder-extension/) - Folder template (basic)
- [templates/folder-extension-with-config/index.ts.template](assets/templates/folder-extension-with-config/index.ts.template) - Folder template with config component API
- [templates/ui-component.ts.template](assets/templates/ui-component.ts.template) - UI component inline template
- [templates/ui-component-external.ts.template](assets/templates/ui-component-external.ts.template) - UI component with external JSX
- [templates/Component.jsx.template](assets/templates/Component.jsx.template) - Placement-based JSX component template
- [templates/ConfigComponent.jsx.template](assets/templates/ConfigComponent.jsx.template) - Config/settings JSX component template
