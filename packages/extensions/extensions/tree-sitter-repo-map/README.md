# Tree-Sitter Repo Map Extension

Provides an enhanced repository map using tree-sitter parsing with PageRank-based symbol ranking for AiderDesk.

## Features

- **Tree-Sitter Parsing**: Parses source code using tree-sitter for accurate symbol extraction
- **Multi-Language Support**: Supports 18+ programming languages including TypeScript, JavaScript, Python, Java, Go, Rust, and more
- **PageRank Algorithm**: Ranks symbols by importance using the PageRank algorithm
- **Dependency Analysis**: Builds and analyzes dependency graphs between symbols
- **Smart Filtering**: Prioritizes mentioned files and identifiers from context

## Supported Languages

- Python
- JavaScript
- TypeScript / TSX
- Java
- Go
- Rust
- C / C++
- Ruby
- PHP
- Scala
- Dart
- OCaml / OCaml Interface
- C#
- Haskell
- Julia

## Installation

### 1. Copy Extension

Copy the entire `tree-sitter-repo-map` directory to your AiderDesk extensions folder:

```bash
# Global extensions (available to all projects)
cp -r tree-sitter-repo-map ~/.aider-desk/extensions/

# Project-specific extensions
cp -r tree-sitter-repo-map .aider-desk/extensions/
```

### 2. Install Dependencies

Navigate to the extension directory and install dependencies:

```bash
cd ~/.aider-desk/extensions/tree-sitter-repo-map
npm install
```

The installation process will automatically download the required tree-sitter WASM files (~20MB total) for all supported languages.

> **Note**: If the automatic download fails, you can manually download the WASM files by running:
> ```bash
> npm run download-wasm
> ```

## Usage

The extension automatically activates when an agent profile has `includeRepoMap: true`. It will:

1. Generate a comprehensive repository map using tree-sitter parsing
2. Extract definitions and references from source files
3. Build a dependency graph between symbols
4. Calculate symbol importance using PageRank
5. Add the map to the agent's context as user/assistant messages
6. Prevent the default repo map from being added

### Commands

The extension provides a `/repo-map` command to manage settings:

```bash
# Show current settings
/repo-map

# Show current maxLines value
/repo-map maxLines

# Set maxLines to a new value (minimum 100)
/repo-map maxLines 2500
```

**Configuration Options:**

| Setting | Default | Description |
|---------|---------|-------------|
| `maxLines` | 5000 | Maximum number of lines in the repository map. When exceeded, the map is truncated and `<repo map truncated>` is appended. |

Settings are persisted in the extension's `config.json` file.

## How It Works

When an agent starts with `includeRepoMap` enabled:

1. **File Discovery**: Scans the project directory for source files
2. **Parsing**: Uses tree-sitter WASM parsers to extract syntax trees
3. **Symbol Extraction**: Identifies definitions and references using language-specific queries
4. **Graph Building**: Constructs a dependency graph of symbols
5. **PageRank Calculation**: Ranks symbols by importance
6. **Tree Rendering**: Formats the output as a readable tree structure

## Configuration

The extension uses default ignore patterns for common directories:
- `node_modules/**`
- `.git/**`
- `dist/**`, `build/**`
- `.next/**`, `out/**`
- `coverage/**`
- Lock files (package-lock.json, yarn.lock, etc.)

## Resources

The extension includes:
- **WASM Files**: Tree-sitter language parsers (in `resources/wasm/`)
- **Query Files**: Language-specific symbol extraction queries (in `resources/queries/`)

These are automatically downloaded using the `scripts/download-tree-sitter-wasm.mjs` script during development.

## Technical Details

- **Singleton Pattern**: Uses a singleton RepoMapManager for efficiency
- **Lazy Initialization**: Parsers and languages are loaded on first use
- **Error Handling**: Gracefully handles parsing errors and unsupported languages
- **Performance**: Caches parsed files and reuses them across runs

## Development

To update the tree-sitter WASM files:

```bash
node scripts/download-tree-sitter-wasm.mjs
```

## License

MIT
