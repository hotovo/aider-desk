# LSP Integration Extension

This extension provides Language Server Protocol (LSP) integration for AiderDesk, enabling automatic error detection after file edits and LSP-powered tools for the AI assistant.

## Features

### Automatic Diagnostics
After using `power---file_edit` or `power---file_write` tools, the extension automatically:
1. Notifies the appropriate LSP server about the file change
2. Waits for diagnostics (up to 3 seconds)
3. Appends any errors to the tool output for the AI to see

### LSP Tools

| Tool | Description |
|------|-------------|
| `lsp-find-references` | Find all references to a symbol at a given position |

## Supported Languages

| Language | Extensions | LSP Server | Auto-detect |
|----------|------------|------------|-------------|
| TypeScript/JavaScript | .ts, .tsx, .js, .jsx, .mjs, .cjs, .mts, .cts | typescript-language-server | TypeScript in dependencies |
| Python | .py, .pyi, .pyw | pyright-langserver | Always enabled |
| Vue | .vue | @vue/language-server | Vue in dependencies |
| Rust | .rs | rust-analyzer | Cargo.toml exists |
| Go | .go | gopls | go.mod exists |
| Java | .java, .gradle, .groovy | jdtls | pom.xml or build.gradle exists |
| Lua | .lua | lua-language-server | Always enabled |
| Svelte | .svelte | svelte-language-server | Svelte in dependencies |
| Astro | .astro | @astrojs/language-server | Astro in dependencies |
| C# | .cs, .csx | omnisharp | .csproj or .sln exists |
| Deno | .ts, .tsx, .js, .jsx, .mjs | deno lsp | deno.json exists |

## Prerequisites

The extension requires the language servers to be available in your system PATH or project:

### TypeScript/JavaScript
```bash
npm install -g typescript-language-server typescript
# Or add to devDependencies
npm install -D typescript typescript-language-server
```

### Python
```bash
npm install -g pyright
# Or use npx (automatic)
```

### Vue
```bash
npm install -D vue @vue/language-server
```

### Rust
```bash
# Install via rustup
rustup component add rust-analyzer
# Or download from https://github.com/rust-lang/rust-analyzer
```

### Go
```bash
go install golang.org/x/tools/gopls@latest
```

### Java
```bash
# Install Eclipse JDT Language Server
# See: https://github.com/eclipse-jdtls/eclipse.jdt.ls
```

### Lua
```bash
# Install from https://github.com/LuaLS/lua-language-server
# Or via package manager (brew, scoop, etc.)
```

### Svelte
```bash
npm install -D svelte svelte-language-server
```

### Astro
```bash
npm install -D astro @astrojs/language-server
```

### C#
```bash
# Install OmniSharp
# See: https://github.com/OmniSharp/omnisharp-roslyn
```

### Deno
```bash
# Install Deno runtime (includes LSP)
# See: https://deno.land
```

## How It Works

1. **Project Started**: When a project is opened, the extension prepares to manage LSP clients
2. **File Edit/Write**: After a file is edited, the extension:
   - Detects the file type
   - Gets or creates an LSP client for that language
   - Sends `textDocument/didChange` notification
   - Waits for `textDocument/publishDiagnostics` response
   - Appends errors to the tool output
3. **Project Stopped**: When a project is closed, all LSP clients are shut down

## Example Output

When a file has errors after editing:

```
Successfully edited src/utils.ts

⚠️ utils.ts has 2 error(s):
<file_diagnostics>
error [10:5] Cannot find name 'undefinedVar'.
error [15:12] Type 'string' is not assignable to type 'number'.
</file_diagnostics>
```

## Configuration

Currently, the extension uses default settings. Future versions may support:
- Custom LSP server configurations
- Diagnostic severity filtering
- Timeout configuration
- Additional language servers

## Adding New Language Servers

To add support for a new language, edit `lsp-servers.ts` and add a new `LspServerInfo` object:

```typescript
export const GoServer: LspServerInfo = {
  id: 'go',
  languageId: 'go',
  extensions: ['.go'],
  async spawn(rootDir: string, context: ExtensionContext): Promise<LspServerHandle | undefined> {
    const proc = spawn('gopls', ['serve'], {
      cwd: rootDir,
      env: process.env,
    });
    return { process: proc };
  },
};

// Then add it to the SERVERS array
export const SERVERS: LspServerInfo[] = [TypescriptServer, PythonServer, GoServer];
```
