# Context Autocompletion Words Extension

This extension automatically extracts symbols from context files and adds them to the autocompletion system.

## Features

- Automatically extracts function names, class names, variables, and constants from files added to context
- Works with 18+ programming languages using tree-sitter parsing
- Updates autocompletion words in real-time as files are added or dropped
- Filters to include only definitions (functions, classes, methods, variables)

## How It Works

1. When files are added to the context (via `onFilesAdded` or `onFilesDropped` events)
2. The extension uses `@aiderdesk/tree-sitter-utils` to extract symbols from those files
3. Filters symbols to include only definitions (kind='def')
4. Extracts unique symbol names
5. Calls `updateAutocompletionWords()` to update the autocompletion dictionary

## Supported Languages

All languages supported by `@aiderdesk/tree-sitter-utils`:
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
- OCaml
- Haskell
- Julia
- And more...

## Technical Details

This extension uses the `@aiderdesk/tree-sitter-utils` library which provides:
- On-demand WASM loading for language support
- SQLite-based caching for fast repeated analysis
- Tree-sitter queries for accurate symbol extraction

## License

MIT
