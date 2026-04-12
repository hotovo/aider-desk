# In-Repo Installation Flow

This flow covers developing extensions **inside the AiderDesk codebase** at `packages/extensions/extensions/`. These extensions ship with the application and are available to all users by default.

## When to Use This Flow

Only when:
1. The current working project **is** the AiderDesk repository itself
2. The user explicitly chooses "In-Repo" as the installation target
3. The extension is meant to be a built-in feature, not a personal or project-specific tool

## Process

1. **Determine extension type** — single-file or folder
2. **Create extension file(s)** in `packages/extensions/extensions/`
3. **Implement Extension interface methods**
4. **Export metadata and default class**
5. **Update `packages/extensions/extensions.json`** — register the extension
6. **Update `docs-site/docs/extensions/examples.md`** — document it
7. **Verify with type checking and code-checker**

## Directory Structure

### Single-File In-Repo Extension

```
packages/extensions/extensions/
└── my-extension.ts                        # Everything in one file
```

### Folder In-Repo Extension

```
packages/extensions/extensions/
└── my-extension/
    ├── index.ts                           # Main extension file
    ├── package.json                       # npm dependencies (must run npm install)
    ├── tsconfig.json                      # TypeScript config (module: ES2020+)
    ├── README.md                          # Documentation
    ├── config.ts                          # Optional: persistent config storage
    ├── logger.ts                          # Optional: local logger
    ├── constants.ts                       # Optional: extension constants
    └── resources/                         # Optional: WASM, queries, assets
```

## Step-by-Step

### Step 1: Determine type

- **Single-file**: No npm dependencies, simple logic
- **Folder**: Needs npm packages, multiple files, resources

### Step 2: Create the extension

Use the templates:
- [single-file.ts.template](../assets/templates/single-file.ts.template)
- [folder-extension/](../assets/templates/folder-extension/)
- [folder-extension-with-config/index.ts.template](../assets/templates/folder-extension-with-config/index.ts.template)

Create files in `packages/extensions/extensions/{name}/` or `packages/extensions/extensions/{name}.ts`.

### Step 3: Implement interface

Same as any extension — implement required methods, export metadata and class.

Reference: [extension-interface.md](extension-interface.md)

### Step 4: Register in extensions.json

**This step is unique to In-Repo extensions.**

Add an entry to `packages/extensions/extensions.json`:

**Single-file entry:**
```json
{
  "id": "my-extension",
  "name": "My Extension",
  "description": "Description of what it does",
  "file": "extensions/my-extension.ts",
  "type": "single",
  "capabilities": ["onLoad", "onAgentStarted"]
}
```

**Folder entry:**
```json
{
  "id": "my-extension",
  "name": "My Extension",
  "description": "Description",
  "folder": "extensions/my-extension",
  "type": "folder",
  "hasDependencies": true,
  "capabilities": ["onLoad", "getCommands", "onAgentStarted"]
}
```

**Important:** Always set `hasDependencies: true` for folder extensions, even if they don't have dependencies yet.

### Step 5: Document in examples.md

Add an entry to the table in `docs-site/docs/extensions/examples.md`:

| Extension | Description | Capabilities | Type |
|-----------|-------------|-------------|------|
| My Extension | What it does | events, commands | folder |

Include extension name, description, capabilities, and type.

### Step 6: Install dependencies (folder extensions only)

If this is a folder extension with npm dependencies:

```bash
cd packages/extensions
npm install
```

### Step 7: Verify

- Run type checking: `npm run typecheck`
- Run tests if applicable: `npm run test`
- Verify extension loads without errors
- Check that extension appears in extensions list

## What NOT to do (In-Repo)

- Do NOT use `@/` imports in extension files — use relative imports or `@aiderdesk/extensions` package imports only
- Do NOT forget to update `extensions.json` — the extension won't load without registration
- Do NOT forget to update `examples.md` — users won't know about the extension
- Do NOT place files outside `packages/extensions/extensions/` unless there's a specific reason (e.g., shared utilities should go in `packages/extensions/src/`)
