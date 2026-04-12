# Project / Global Installation Flow

This flow covers installing extensions to **Current Project** (`.aider-desk/extensions/`) or **Global** (`~/.aider-desk/extensions/`).

These two targets share the same creation process — only the destination directory differs.

## Process

1. **Determine extension type** — single-file or folder
2. **Create extension file(s)** in the target directory
3. **Implement Extension interface methods**
4. **Export metadata and default class**
5. **Verify** the extension loads correctly

That's it. No registry updates, no manifest files, no documentation changes.

## Directory Structure

### Single-File Extension

```
{targetDir}/                              # .aider-desk/extensions/ or ~/.aider-desk/extensions/
└── my-extension.ts                        # Everything in one file
```

### Folder Extension

```
{targetDir}/                              # .aider-desk/extensions/ or ~/.aider-desk/extensions/
└── my-extension/
    ├── index.ts                           # Main extension file
    ├── package.json                       # npm dependencies
    ├── tsconfig.json                      # TypeScript config
    ├── config.json                        # Optional: persistent config
    ├── ConfigComponent.jsx                # Optional: settings UI
    └── resources/                         # Optional: WASM, queries, assets
```

## Step-by-Step

### Step 1: Determine type

- **Single-file**: No npm dependencies, simple logic, one file is enough
- **Folder**: Needs npm packages, multiple files, or resources (WASM, queries)

### Step 2: Create the extension

For single-file, create `{targetDir}/{name}.ts`.
For folder, create `{targetDir}/{name}/` with `index.ts`, `package.json`, `tsconfig.json`.

Use the templates:
- [single-file.ts.template](../assets/templates/single-file.ts.template)
- [folder-extension/](../assets/templates/folder-extension/)
- [folder-extension-with-config/index.ts.template](../assets/templates/folder-extension-with-config/index.ts.template)

### Step 3: Implement interface

Follow the same rules regardless of target:

- Import types from `@aiderdesk/extensions`
- Implement required lifecycle and registration methods
- Export metadata with all required fields
- Export class as default

Reference: [extension-interface.md](extension-interface.md)

### Step 4: Verify

The extension will be auto-discovered by AiderDesk from the target directory. No restart needed — extensions are watched and loaded dynamically.

## What NOT to do (Project/Global)

- Do NOT modify `packages/extensions/extensions.json` — that registry is only for In-Repo extensions
- Do NOT update `docs-site/docs/extensions/examples.md` — that's for documenting built-in extensions
- Do NOT use `@/` imports — they won't resolve outside the AiderDesk monorepo
- Do NOT add to `packages/common/src/` or any other AiderDesk source directory
