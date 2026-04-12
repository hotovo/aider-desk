# Config Components Reference

Config components provide a **per-extension settings UI** that appears in the Extension Settings dialog when users click the gear icon on an extension card. Unlike placement-based UI components (which render inside task pages), config components render in a dedicated settings modal with Save/Cancel buttons.

## Overview

```
User clicks extension gear icon
  → ExtensionSettingsDialog opens
    → Calls api.getExtensionConfigComponent(extensionId)
      → Extension.getConfigComponent(context) returns JSX string
    → Calls api.getExtensionConfig(extensionId)
      → Extension.getConfigData(context) returns current config data
    → Renders JSX with { config, updateConfig } props
    → User edits values, clicks Save
    → Calls api.saveExtensionConfig(extensionId, config)
      → Extension.saveConfigData(configData, context) persists data
```

## The Three Methods

### `getConfigComponent(context)` — Return Settings JSX

Returns a JSX string for the settings UI. The component receives `{ config, updateConfig }` as props:

- **`config`** — The current config data loaded from `getConfigData()`
- **`updateConfig`** — Callback to mutate the in-memory config state

```typescript
getConfigComponent(_context: ExtensionContext): string | undefined {
  // Option A: Inline JSX string
  return `({ config, updateConfig }) => { ... }`;

  // Option B: Load from external .jsx file (recommended for > 20 lines)
  return readFileSync(join(__dirname, './ConfigComponent.jsx'), 'utf-8');
}
```

Return `undefined` if your extension has no settings UI.

### `getConfigData(context)` — Load Current Config

Called when the settings dialog opens. Returns the persisted configuration data:

```typescript
async getConfigData(_context: ExtensionContext): Promise<unknown> {
  try {
    if (existsSync(this.configPath)) {
      const data = readFileSync(this.configPath, 'utf-8');
      const parsed = JSON.parse(data);
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch {
    // Ignore errors, fall back to defaults
  }
  return { ...DEFAULT_CONFIG };
}
```

### `saveConfigData(configData, context)` — Persist Config

Called when user clicks **Save** in the dialog:

```typescript
async saveConfigData(configData: unknown, _context: ExtensionContext): Promise<unknown> {
  const merged = { ...DEFAULT_CONFIG, ...configData as Partial<MyConfig> };
  writeFileSync(this.configPath, JSON.stringify(merged, null, 2), 'utf-8');
  return merged;
}
```

## Prefer ui Components Over Raw HTML

Always use the `ui` prop components (`ui.Input`, `ui.TextArea`, `ui.Select`, `ui.Checkbox`, etc.) instead of raw HTML `<input>`, `<textarea>`, `<select>` elements. This ensures consistent styling, accessibility, and theming across the application.

**Do this:**
```jsx
({ config, updateConfig, ui }) => {
  const { Input } = ui;

  return (
    <Input
      label="My Setting"
      value={config?.mySetting || ''}
      onChange={(value) => updateConfig({ ...config, mySetting: value })}
    />
  );
};
```

**Not this:**
```jsx
// Avoid raw HTML — inconsistent styling, no theme support
<input
  type="text"
  value={config?.mySetting || ''}
  onChange={(e) => updateConfig({ ...config, mySetting: e.target.value })}
  className="w-full px-3 py-2 ..."
/>
```

The `ui` components handle their own labels, styling, focus states, and dark mode automatically.

## When Inner State Is (and Isn't) Needed

Config components receive `config` that is kept in sync by the parent dialog. **You do NOT need local state for simple form fields.**

### No inner state needed (most cases)

When your component just reads from `config` and calls `updateConfig` on change — use `config` directly:

```jsx
({ config, updateConfig, ui }) => {
  const { Input } = ui;
  return <Input label="Folders" value={config?.folders || ''} onChange={(v) => updateConfig({ ...config, folders: v })} />;
};
```

This works because `updateConfig` triggers a re-render with the updated `config` prop, so the input always shows the current value.

### Inner state IS needed

Only introduce local state when you need behavior that goes beyond simple read/write:

- **Derived/computed values**: Displaying a transformed version of config (e.g., splitting a comma string into tags)
- **Transient UI state**: Expand/collapse sections, active tabs, modal visibility
- **Debounced input**: Delaying updates until user stops typing
- **Validation state**: Showing per-field error messages

```jsx
({ config, updateConfig, ui }) => {
  const { useState } = React;
  const { Input } = ui;

  // Only needed because we transform config into tag-like items for editing
  const [tags, setTags] = useState((config?.folders || '').split(',').filter(Boolean));

  // ...
};
```

## Config Component Props

The JSX component receives these props:

```typescript
{
  // Current config data from getConfigData()
  config: unknown,

  // Callback to update in-memory config (does NOT persist!)
  updateConfig: (newConfig: unknown) => void,

  // All standard extension props (from useExtensions())
  ui: UIComponents,
  icons: Record<string, unknown>,
  models: Model[],
  providers: ProviderProfile[],
  projectDir?: string,
  task?: TaskData,
  agentProfile?: AgentProfile,
  mode: string,
  api: ApplicationAPI,
}
```

**Important:** `updateConfig` only updates the local React state. Persistence happens only when the user clicks **Save**, which triggers `saveConfigData()`.

## Config Component JSX Format

Config components follow the same format as all other extension JSX files:

- Pure arrow function with destructured props
- React hooks accessed via `React.useState`, `React.useEffect`, etc.
- No imports — everything is available via props or globals
- Use Tailwind CSS for styling

### Example: Text Input (no inner state, using ui.Input)

```jsx
({ config, updateConfig, ui }) => {
  const { Input } = ui;

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="My Setting"
        value={config?.mySetting || ''}
        onChange={(value) => updateConfig({ ...config, mySetting: value })}
        placeholder="Enter value..."
      />
      <p className="text-xs text-text-secondary -mt-2">
        Description of what this setting does.
      </p>
    </div>
  );
};
```

### Example: Checkbox Toggle (no inner state)

```jsx
({ config, updateConfig, ui }) => {
  const { Checkbox } = ui;

  return (
    <Checkbox
      label="Enable feature"
      checked={config?.enabled ?? false}
      onChange={(checked) => updateConfig({ ...config, enabled: checked })}
    />
  );
};
```

### Example: Multiple Fields (no inner state)

```jsx
({ config, updateConfig, ui }) => {
  const { Input, Checkbox } = ui;

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Rule Folders"
        value={config?.ruleFolders || ''}
        onChange={(value) => updateConfig({ ...config, ruleFolders: value })}
        placeholder=".custom-rules, .ai/rules"
      />
      <Input
        label="Max Depth"
        type="number"
        value={String(config?.maxDepth ?? 3)}
        onChange={(value) => updateConfig({ ...config, maxDepth: Number(value) })}
      />
      <Checkbox
        label="Include hidden directories"
        checked={config?.includeHidden ?? false}
        onChange={(checked) => updateConfig({ ...config, includeHidden: checked })}
      />
    </div>
  );
};
```

### Example: With Inner State (derived/transient UI only)

Only use local state when you need behavior beyond simple read/write — such as derived display values or transient UI state:

```jsx
({ config, updateConfig, ui }) => {
  const { useState, useMemo } = React;
  const { Input } = ui;

  // Inner state needed: splitting comma string into editable tag-like items
  const rawValue = config?.folders || '';
  const tags = useMemo(() => rawValue.split(',').map(t => t.trim()).filter(Boolean), [rawValue]);
  const [activeTag, setActiveTag] = useState(null);

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Folders (comma-separated)"
        value={rawValue}
        onChange={(value) => updateConfig({ ...config, folders: value })}
      />
      {/* Tag preview — derived from config, uses inner state for UI interaction */}
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <span
            key={tag}
            onClick={() => setActiveTag(tag === activeTag ? null : tag)}
            className={`px-2 py-0.5 rounded text-xs cursor-pointer ${
              tag === activeTag ? 'bg-accent text-white' : 'bg-bg-secondary'
            }`}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
};
```

## File Structure Pattern

Recommended structure for extensions with config components:

```
my-extension/
├── index.ts              # Main extension (loads JSX, implements 3 methods)
├── ConfigComponent.jsx   # Settings UI (pure arrow function)
└── config.json           # Default/persisted config file
```

### index.ts Pattern

```typescript
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Extension, ExtensionContext } from '@aiderdesk/extensions';

// Load config JSX at module level (read once)
const configComponentJsx = readFileSync(join(__dirname, './ConfigComponent.jsx'), 'utf-8');

interface MyExtensionConfig {
  ruleFolders: string;
  enabled: boolean;
}

const DEFAULT_CONFIG: MyExtensionConfig = {
  ruleFolders: '',
  enabled: true,
};

export default class MyExtension implements Extension {
  static metadata = {
    name: 'My Extension',
    version: '1.0.0',
    description: 'Description here',
    author: 'author-name',
    capabilities: ['context'],
  };

  private configPath: string;

  constructor() {
    this.configPath = join(__dirname, 'config.json');
  }

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('My Extension loaded', 'info');
  }

  getConfigComponent(_context: ExtensionContext): string {
    return configComponentJsx;
  }

  async getConfigData(_context: ExtensionContext): Promise<MyExtensionConfig> {
    try {
      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, 'utf-8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
      }
    } catch {
      // Ignore errors
    }
    return { ...DEFAULT_CONFIG };
  }

  async saveConfigData(configData: unknown, _context: ExtensionContext): Promise<unknown> {
    const merged: MyExtensionConfig = { ...DEFAULT_CONFIG, ...configData as Partial<MyExtensionConfig> };
    writeFileSync(this.configPath, JSON.stringify(merged, null, 2), 'utf-8');
    return merged;
  }
}
```

### config.json (default)

```json
{
  "ruleFolders": "",
  "enabled": true
}
```

## How hasConfig is Determined

The `InstalledExtension.metadata.hasConfig` flag is set by checking whether `instance.getConfigComponent` exists and returns a truthy (non-empty) JSX string. This means:

- If you implement `getConfigComponent` and return a non-empty string → `hasConfig: true` → gear icon appears on the extension card
- If you don't implement it, or return `undefined`/empty string → `hasConfig: false` → no settings entry point

## Differences from Placement-Based UI Components

| Aspect | Config Components | Placement UI Components |
|--------|-------------------|------------------------|
| **Where they render** | ExtensionSettingsDialog modal | Task page placements |
| **Registration method** | `getConfigComponent()` | `getUIComponents()` |
| **Props received** | `{ config, updateConfig, ui, icons, ... }` | `{ data, task, ui, icons, ... }` |
| **Data loading** | `getConfigData()` always called | `getUIExtensionData()` only if `loadData: true` |
| **Persistence** | `saveConfigData()` on Save click | Via `executeExtensionAction()` |
| **Placement enum** | Not applicable | `UIComponentPlacement` enum |
| **One per extension** | Yes (single) | No (multiple allowed) |

## Best Practices

### Prefer ui.* components over raw HTML elements

Always use components from the `ui` prop (`Input`, `TextArea`, `Select`, `Checkbox`, etc.) instead of raw `<input>`, `<textarea>`, or `<select>` elements. The ui components handle labels, styling, focus states, dark mode, and accessibility automatically.

### Avoid unnecessary inner state

For simple form fields, read directly from `config` and call `updateConfig` on change — no `useState`/`useEffect` needed. The parent re-renders with updated `config` after each `updateConfig` call. Only introduce local state for derived values, transient UI state (tabs, expand/collapse), debounced input, or validation.

### Call updateConfig on every change

Don't wait for blur/submit — call `updateConfig` immediately so the Save button persists the latest value:

```jsx
onChange={(e) => {
  setValue(e.target.value);
  updateConfig({ ...config, myValue: e.target.value });
}}
```

### Merge with defaults in both load and save

Always merge incoming data with defaults to handle missing fields gracefully:

```typescript
// In getConfigData
return { ...DEFAULT_CONFIG, ...parsed };

// In saveConfigData
const merged = { ...DEFAULT_CONFIG, ...configData };
```

### Store config in the extension directory

Use `join(__dirname, 'config.json')` so config lives alongside the extension code. Never write outside the extension directory.

### Keep config serializable

Only use primitive types (string, number, boolean, arrays, plain objects) that can be safely JSON-stringified.
