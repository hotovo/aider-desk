# ChunkHound Search Tool Extension

This extension demonstrates how to **override a native Power tool** (`power---semantic_search`) by registering a custom tool with the same name via `getTools()`.

## What This Extension Does

- **Overrides `power---semantic_search`**: Registers a tool with the same name as the built-in semantic search, replacing it with ChunkHound-powered search
- **Uses ChunkHound's embedding-based search**: Better semantic understanding of code
- **Per-project indexing**: Each project gets its own `.chunkhound.db` database in the project root
- **Auto-indexing on project open**: Starts background indexing when a project is opened
- **Auto-reindexing**: Detects file modifications and reindexes before the next search
- **Pagination support**: Includes `pageSize` and `offset` parameters for result pagination
- **Abort support**: Properly handles interrupted operations

## How Tool Override Works

This extension uses `getTools()` to register a tool with the **same name** as the built-in `power---semantic_search`:

```typescript
getTools(_context: ExtensionContext): ToolDefinition[] {
  const searchTool: ToolDefinition<typeof inputSchema> = {
    // override power---semantic_search tool
    name: 'power---semantic_search',
    description: 'Search code in repository using semantic search powered by ChunkHound...',
    inputSchema,
    execute: async (input, signal) => {
      return chunkhoundSearch(query, projectDir, context, signal, pageSize, offset);
    },
  };

  return [searchTool];
}
```

When an extension registers a tool with the same name as a native Power tool, AiderDesk uses the extension's implementation instead of the built-in one. This allows you to:

- Replace built-in tools with custom implementations
- Add enhanced functionality to existing tools
- Integrate external services (like ChunkHound) seamlessly

## Prerequisites

### 1. Install uv (if you don't have it)

**macOS and Linux:**
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

**Windows:**
```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

### 2. Install ChunkHound

```bash
uv tool install chunkhound
```

### 3. Install the Extension

Copy this folder to your AiderDesk global extensions directory:

```bash
cp -r . ~/.aider-desk/extensions/chunkhound-search
```

### 4. Configure Embedding Provider

Create a `.chunkhound.json` file in the **extension folder** (`~/.aider-desk/extensions/chunkhound-search/`):

**VoyageAI (Recommended - fastest, most accurate, cost-effective):**
```json
{
  "embedding": {
    "provider": "voyageai",
    "api_key": "pa-your-voyage-key"
  }
}
```
Get an API key from [VoyageAI Console](https://dash.voyageai.com/)

**OpenAI:**
```json
{
  "embedding": {
    "provider": "openai",
    "api_key": "sk-your-openai-key"
  }
}
```
Get an API key from [OpenAI Platform](https://platform.openai.com/api-keys)

**Ollama (Local/Offline - best for privacy):**
```json
{
  "embedding": {
    "provider": "openai",
    "base_url": "http://localhost:11434/v1",
    "model": "dengcao/Qwen3-Embedding-8B:Q5_K_M",
    "api_key": "dummy-key"
  }
}
```

For Ollama, you'll need to:
```bash
# Install and start Ollama
ollama pull dengcao/Qwen3-Embedding-8B:Q5_K_M
ollama serve
```

## Usage

Once installed, the extension automatically replaces the built-in `power---semantic_search` tool with ChunkHound-powered search.

Your AI assistant can now search your codebase using natural language queries:

- "Find authentication functions"
- "Search for database models and their relationships"
- "How is rate limiting implemented?"

## Configuration Options

The extension supports these parameters:

- `query` - Search query with Elasticsearch syntax. Use `+` for important terms (required)
- `pageSize` - Number of results per page (default: 10)
- `offset` - Page offset for results, 0-based (default: 0)

## How It Works

1. **Project Open**: Starts background indexing when a project is opened
2. **First Search**: If index doesn't exist, waits for indexing to complete (or starts it)
3. **Subsequent Searches**: Uses existing index for fast results
4. **File Modifications**: Detects when files are edited/written and marks project for reindexing
5. **Next Search**: Reindexes automatically before searching to include latest changes
6. **Concurrent Safety**: If indexing is already running, waits for it instead of starting a new one
7. **Abort Handling**: Properly terminates running processes when operations are interrupted

## Troubleshooting

### "ChunkHound is not installed"

Make sure ChunkHound is installed and in your PATH:
```bash
chunkhound --version
```

### "ChunkHound config not found"

Make sure `.chunkhound.json` exists in the extension folder:
```bash
ls ~/.aider-desk/extensions/chunkhound-search/.chunkhound.json
```

### Indexing Issues

- Check your `.chunkhound.json` configuration
- Ensure your API key is valid
- For Ollama, make sure the server is running

### Performance Tips

- ChunkHound respects `.gitignore` files
- Re-running `chunkhound index` only processes changed files
- The database is stored in `.chunkhound.db` in your project root
- Add `.chunkhound.db` to your `.gitignore`

## Files

- `index.ts` - Extension source code
- `.chunkhound.json` - Your embedding provider config (create this)
- `README.md` - This file

## Resources

- [ChunkHound Documentation](https://chunkhound.github.io/)
- [ChunkHound GitHub](https://github.com/chunkhound/chunkhound)
- [Discord Community](https://discord.gg/BAepHEXXnX)
