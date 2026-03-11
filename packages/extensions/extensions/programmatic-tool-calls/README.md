# Programmatic Tool Calls Extension

Execute JavaScript code in a secure sandbox with access to all available tools as async functions.

## Overview

This extension implements the [programmatic tool calling](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/programmatic-tool-calling) pattern, allowing Claude to write code that invokes tools directly rather than requiring multiple round-trips.

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

All tools are available as async functions. Convert tool names by:
1. Replace `---` with `_`
2. Replace `-` with `_`

Examples:
- `power---file-read` → `power_file_read()`
- `power---bash` → `power_bash()`
- `power---semantic_search` → `power_semantic_search()`

### Example

```javascript
// Read multiple files in parallel
const [index, config, readme] = await Promise.all([
  power_file_read({ filePath: 'src/index.ts' }),
  power_file_read({ filePath: 'tsconfig.json' }),
  power_file_read({ filePath: 'README.md' })
]);

// Process and search
const files = await power_glob({ pattern: '**/*.ts' });
const results = await power_semantic_search({ 
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
