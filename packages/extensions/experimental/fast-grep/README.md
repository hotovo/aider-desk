# Fast Grep Extension

Fast regex search using sparse n-gram indexing for significantly faster searches in large codebases. This extension replaces the internal `power---grep` tool with an optimized implementation based on [Cursor's fast regex search algorithm](https://cursor.com/blog/fast-regex-search).

## How It Works

The extension implements sparse n-gram indexing, a technique that dramatically speeds up regex searches in large codebases by:

1. **Sparse N-gram Extraction**: Instead of indexing every consecutive trigram, this approach extracts variable-length n-grams where the weights at both ends are strictly greater than all weights inside. This reduces redundancy while maintaining search accuracy.

2. **Frequency-Based Weighting**: Uses a frequency table of character pairs common in source code to select more discriminative n-grams. Rare pairs get higher weights, making them better candidates for indexing.

3. **Covering Algorithm at Query Time**: When searching, only the minimal set of n-grams needed to find matches is extracted, reducing the number of index lookups required.

4. **Probabilistic Filtering**: The index quickly narrows down candidate files, then full regex matching is performed only on those candidates.

## Performance Benefits

- **10-100x faster** for regex searches in large monorepos
- **Incremental indexing** that updates as files change
- **Low memory footprint** with efficient on-disk storage
- **Git-aware** indexing tied to commit hashes for fast synchronization

## Installation

```bash
npx @aiderdesk/extensions install fast-grep
```

Or manually:

```bash
cd ~/.aider-desk/extensions
git clone --depth 1 https://github.com/hotovo/aider-desk temp-aider
cp -r temp-aider/packages/extensions/extensions/fast-grep ./
cd fast-grep
npm install
rm -rf temp-aider
```

## Usage

Once installed, the extension automatically replaces the built-in `power---grep` tool. No configuration needed - just use grep as you normally would:

```
Search for "useEffect" in all TypeScript files
```

The agent will use the fast-grep extension transparently.

## Technical Details

### Index Storage

The index is stored in `.aiderdesk/fast-grep-index/` within your project:

- `metadata.json` - Index metadata (version, file count, timestamps)
- `files.bin` - File entry mapping
- `lookup.bin` - Sorted n-gram hash table for binary search
- `postings.bin` - Posting lists (file IDs per n-gram)

### Supported File Types

The extension indexes common source code files:

- JavaScript/TypeScript (`.js`, `.jsx`, `.ts`, `.tsx`)
- Python (`.py`, `.pyw`, `.pyi`)
- Java/Kotlin (`.java`, `.kt`, `.kts`)
- C/C++ (`.c`, `.cpp`, `.h`, `.hpp`)
- Go (`.go`)
- Rust (`.rs`)
- And many more...

### Ignored Paths

The following are automatically excluded from indexing:

- `node_modules/`, `.git/`, `dist/`, `build/`
- Minified files (`.min.js`, `.min.css`)
- Lock files (`package-lock.json`, `yarn.lock`)
- `.d.ts` declaration files

## Configuration

The extension works out of the box with sensible defaults. Advanced configuration options:

| Option | Default | Description |
|--------|---------|-------------|
| `minNgramLength` | 2 | Minimum n-gram length |
| `maxNgramLength` | 32 | Maximum n-gram length |
| `maxNgramsPerFile` | 10000 | Maximum n-grams extracted per file |
| `maxFileSize` | 1MB | Maximum file size to index |
| `reindexDebounceMs` | 2000 | Debounce delay for reindexing |

## Algorithm Reference

This implementation is based on the algorithm described in [Cursor's blog post](https://cursor.com/blog/fast-regex-search), which covers:

- Trigram decomposition for regex matching
- Probabilistic masks for phrase-aware indexing
- Sparse n-grams for smarter trigram selection
- Frequency-based weight functions

## License

MIT
