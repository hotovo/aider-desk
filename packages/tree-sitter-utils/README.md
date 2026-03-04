# @aiderdesk/tree-sitter-utils

A comprehensive tree-sitter library for code analysis, symbol extraction, and repository mapping.

## Features

- 🌳 **Tree-Sitter Based**: Uses tree-sitter for accurate AST parsing
- 📦 **On-Demand WASM Loading**: Automatically downloads language WASM files when needed
- 🔍 **Symbol Extraction**: Extract functions, classes, variables, and other symbols from code
- 🗺️ **Repository Mapping**: Generate comprehensive repository maps with PageRank-based symbol ranking
- 💾 **Smart Caching**: SQLite-based caching for fast repeated analysis
- 🌐 **Multi-Language Support**: Supports 18+ programming languages out of the box

## Installation

```bash
npm install @aiderdesk/tree-sitter-utils
```

## Quick Start

### Extract Symbols from Files

```typescript
import { extractSymbols } from '@aiderdesk/tree-sitter-utils';

const symbols = await extractSymbols([
  '/path/to/file.ts',
  '/path/to/another-file.py'
]);

console.log(symbols);
// [
//   { name: 'MyClass', kind: 'def', line: 10, rel_fname: 'file.ts', ... },
//   { name: 'myFunction', kind: 'def', line: 25, rel_fname: 'file.ts', ... }
// ]
```

### Generate Repository Map

```typescript
import { getRepoMap } from '@aiderdesk/tree-sitter-utils';

const map = await getRepoMap('/path/to/project', {
  maxLines: 1000,
  excludePatterns: ['node_modules/**', 'dist/**']
});

console.log(map);
// src/index.ts:
// ├── class MyClass
// ├── function myFunction
// ...
```

### Advanced Usage with TreeSitterAnalyzer

```typescript
import { TreeSitterAnalyzer } from '@aiderdesk/tree-sitter-utils';

const analyzer = new TreeSitterAnalyzer();

// Initialize (optional - lazy initialization supported)
await analyzer.initialize();

// Get repository map
const repoMap = await analyzer.getRepoMap('/path/to/project', {
  maxLines: 500,
  mentionedFiles: new Set(['src/important.ts']),
  mentionedIdents: new Set(['ImportantClass'])
});

// Extract symbols
const symbols = await analyzer.extractSymbols(['/path/to/file.ts'], {
  useCache: true
});

// Parse single file
const parseResult = await analyzer.parseFile('/path/to/file.ts');
```

## Supported Languages

- Python
- JavaScript / JSX
- TypeScript / TSX
- Java
- Go
- Rust
- C / C++
- C#
- Ruby
- PHP
- Scala
- Dart
- OCaml / OCaml Interface
- Haskell
- Julia

## Configuration Options

### RepoMapOptions

```typescript
interface RepoMapOptions {
  root: string;                    // Root directory of the project
  files?: string[];                // Specific files to analyze (optional)
  excludePatterns?: string[];      // Glob patterns to exclude
  mentionedFiles?: Set<string>;    // Files to prioritize in ranking
  mentionedIdents?: Set<string>;   // Identifiers to prioritize
  chatFiles?: Set<string>;         // Files to exclude from output
  maxLines?: number;               // Maximum lines in output
}
```

### SymbolOptions

```typescript
interface SymbolOptions {
  useCache?: boolean;              // Use SQLite cache (default: true)
  rootDir?: string;                // Root directory for relative paths
}
```

## How It Works

1. **On-Demand WASM Loading**: When a language is first encountered, the library automatically downloads its WASM file from unpkg and caches it in `~/.cache/aiderdesk/tree-sitter/wasm/`

2. **Tree-Sitter Parsing**: Uses tree-sitter queries (`.scm` files) to extract definitions and references from source code

3. **PageRank Algorithm**: Builds a dependency graph and applies PageRank to rank symbols by importance

4. **Smart Caching**: SQLite-based caching tracks file modification times to avoid re-parsing unchanged files

## API Reference

### Convenience Functions

- `extractSymbols(filePaths: string[], options?: SymbolOptions): Promise<Symbol[]>`
- `getRepoMap(root: string, options?: RepoMapOptions): Promise<string>`

### TreeSitterAnalyzer Class

- `initialize(): Promise<void>` - Initialize the analyzer
- `getRepoMap(options: RepoMapOptions): Promise<string>` - Generate repository map
- `extractSymbols(filePaths: string[], options?: SymbolOptions): Promise<Symbol[]>` - Extract symbols
- `parseFile(filePath: string): Promise<ParseResult>` - Parse single file

## License

MIT
