# CodeGraph

Code intelligence using [CodeGraph](https://github.com/colbymchenry/codegraph) — a local-first knowledge graph that builds a semantic index of your codebase.

## Features

Provides 10 tools that give AI agents deep code intelligence:

| Tool | Purpose |
|------|---------|
| `codegraph-search` | Find symbols by name across the codebase |
| `codegraph-context` | Build relevant code context for a task |
| `codegraph-trace` | Trace the call path between two symbols |
| `codegraph-callers` | Find what calls a function |
| `codegraph-callees` | Find what a function calls |
| `codegraph-impact` | Analyze what code is affected by changing a symbol |
| `codegraph-node` | Get details about a specific symbol (optionally with source) |
| `codegraph-explore` | Deep exploration of related symbols in one call (PRIMARY tool) |
| `codegraph-files` | Get the indexed file structure |
| `codegraph-status` | Check index health and statistics |

## Auto-Initialization

When a tool is called on a project that hasn't been indexed yet, the extension automatically:

1. Initializes the CodeGraph index (creates `.codegraph/` directory)
2. Runs a full index of the codebase
3. Logs progress to the task chat
4. Proceeds with the tool execution

Subsequent calls use the cached instance and incremental sync.

## Prerequisites

- Node.js ≥ 22.5 (required by `@colbymchenry/codegraph` for `node:sqlite`)
- The `@colbymchenry/codegraph` package with the matching platform bundle must be installed

## How Agents Should Use It

- **codegraph-explore** is the primary tool — ONE call usually answers the whole question
- For "how does X work?", architecture, or "where is X?" → `codegraph-explore`
- For "what calls this?" → `codegraph-callers`; "what would break?" → `codegraph-impact`
- For a specific symbol's full source → `codegraph-node` with `includeCode: true`
- Trust CodeGraph results — they come from a full AST parse, faster and more accurate than grep
