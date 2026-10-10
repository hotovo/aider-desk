# Programmatic Tool Calls Extension

Execute JavaScript code in a secure sandbox with access to all available tools as async functions.

## Overview

This extension implements the [programmatic tool calling](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/programmatic-tool-calling) pattern, allowing Claude to write code that invokes tools directly rather than requiring multiple round-trips.

## PTC Mode

The extension provides a **PTC** mode (selectable in the mode selector). In this mode:

- Only the `programmatic_tool_calls` tool is exposed to the model
- All other tools (built-in, MCP, and extension tools) are hidden from direct calling
- Tools remain fully accessible inside the sandbox as async functions

This follows the "Code Mode" pattern: the model orchestrates all tools through code, saving context tokens and enabling batching, filtering, and complex control flow.

In all other modes, the `programmatic_tool_calls` tool is available in addition to the regular toolset.

For more details on advanced tool use patterns, see [Claude Advanced Tool Use](https://github.com/shanraisshan/claude-code-best-practice/blob/main/reports/claude-advanced-tool-use.md).

## Benefits

- **Reduced latency**: Batch multiple tool calls in a single execution
- **Token efficiency**: Process and filter results before returning to context
- **Complex logic**: Implement loops, conditionals, and parallel operations
- **Composability**: Combine multiple tools in sophisticated workflows

## Usage

The `programmatic_tool_calls` tool accepts:

- `code` (string): JavaScript code to execute
- `timeout` (number, optional): Execution timeout in seconds (default: 300)

### Tool Naming Convention

All tools are available as async functions under the `tools` object. Convert tool names by:
1. Replace `---` with `_`
2. Replace `-` with `_`

Examples:
- `power---file-read` → `tools.power_file_read()`
- `power---bash` → `tools.power_bash()`
- `power---semantic_search` → `tools.power_semantic_search()`

### Tool Discovery Inside the Sandbox

The tool signature catalog embedded in the tool description is budgeted — with many tools
it becomes partial. Discovery helpers are available as sandbox globals:

- `searchTools({ query, limit?, namespace? })` — finds tools by topic, name, or parameter name.
  Results include full JSDoc-annotated TypeScript signatures, so query → result → call needs no second lookup. Scoring: exact name-token match (20), name substring (8), description match (4), schema parameter match (2). Plural query terms match singular tool names (`issues` finds `issue`). An empty query browses all tools alphabetically; use `offset` to paginate (`total` reports the full count).
- `describeTool(path)` — full signature of a known path.
- `ALL_TOOLS` — list of `{ path, description }` for all available tools.

### Structured Diagnostics

Failures are returned as stable, model-friendly categories:
`SyntaxError` (code could not be parsed), `UnknownTool` (with a `searchTools` hint),
`ToolFailure` (`<tool> — <message>`), `TimeoutExceeded`, and `Cancelled` (user abort).

### Example

```javascript
// Find a tool not shown in the catalog
const matches = await searchTools({ query: 'edit file', limit: 5 });

// Read multiple files in parallel (no destructuring - use index access)
const r = await Promise.all([
  tools.power_file_read({ filePath: 'src/index.ts' }),
  tools.power_file_read({ filePath: 'tsconfig.json' }),
  tools.power_file_read({ filePath: 'README.md' })
]);
const readme = r[2];

// Process and search
const files = await tools.power_glob({ pattern: '**/*.ts' });
const results = await tools.power_semantic_search({
  query: 'authentication logic',
  maxResults: 10
});

// Return structured result
return {
  totalFiles: files.length,
  searchMatches: results.length,
  hasReadme: readme.length > 0
};
```

## Security

This extension uses [@nyariv/sandboxjs v0.8.33](https://www.npmjs.com/package/@nyariv/sandboxjs) for secure code execution:

- No access to `eval`, `Function`, or other code generation
- Whitelist-based prototype and global access
- Isolated execution environment
- Timeout protection

## Installation

### Via CLI (Recommended)

Install globally (available in all projects):
```bash
npx @aiderdesk/extensions install programmatic-tool-calls --global
```

Install for current project:
```bash
npx @aiderdesk/extensions install programmatic-tool-calls
```

### Manual Installation

1. Download the extension folder
2. Copy to one of these locations:
   - **Global**: `~/.aider-desk/extensions/`
   - **Project**: `<project-folder>/.aider-desk/extensions/`
3. Run `npm install` in the extension folder to install dependencies
