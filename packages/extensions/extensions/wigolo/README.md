# wigolo

Local-first web search, fetch, crawl & research tools powered by [wigolo](https://github.com/KnockOutEZ/wigolo).

## Features

- **6 tools**: `web-search`, `web-fetch`, `web-crawl`, `find-similar`, `research`, `web-agent`
- **No API keys required** for core search/fetch/crawl functionality
- **Local-first**: all intelligence (ranking, embeddings, browser) runs on your machine — $0/query
- **Auto-start**: the wigolo daemon is automatically spawned via `wigolo-sdk` and reused if already running
- **Configurable**: custom command override and environment variables

## How It Works

The extension uses the [`wigolo-sdk`](https://www.npmjs.com/package/wigolo-sdk) TypeScript client to communicate with a local wigolo daemon over its REST API. On load, it calls `createLocalClient()` which:

1. Probes for an existing daemon on port 3333
2. If found and healthy — reuses it
3. If not found — spawns `wigolo serve --port 3333 --host 127.0.0.1` and waits for it to become healthy

The daemon lifecycle is fully managed: the extension stops the daemon on unload (only if it spawned it).

### Tools

| Tool | wigolo Method | Description |
|------|--------------|-------------|
| `web-search` | `search` | 18-engine meta-search with ML reranking |
| `web-fetch` | `fetch` | Fetch a URL with tiered escalation (HTTP → headless browser) |
| `web-crawl` | `crawl` | Crawl a site with BFS/DFS/sitemap strategies |
| `find-similar` | `findSimilar` | Semantic similarity search over cached content |
| `research` | `research` | Multi-step autonomous research with citations |
| `web-agent` | `agent` | Full agentic research loop for complex multi-hop tasks |

## Configuration

Click the gear icon on the extension card to configure:

| Setting | Description | Default |
|---------|-------------|---------|
| **Command override** | Custom command to spawn wigolo (e.g. `npx -y wigolo`). Leave empty for auto-detect on PATH | Auto-detect |
| **Environment Variables** | Custom env vars for the daemon | — |

### Enhanced Results (Optional)

For research and agent synthesis, set these environment variables:

| Variable | Description |
|----------|-------------|
| `WIGOLO_LLM_PROVIDER` | `gemini`, `anthropic`, `openai`, `groq`, or `ollama` |
| `GEMINI_API_KEY` | Required if using Gemini as LLM provider |
| `WIGOLO_SEARCH` | Set to `hybrid` for wider retrieval (core engines + aggregator fallback) |

## Prerequisites

- **Node.js 20+** (required by wigolo)
- **wigolo installed** — install globally with `npm install -g wigolo`, or let the command override use `npx -y wigolo`
- **~1.5 GB disk** for full functionality (browser engine + ML models, lazy-loaded on first use)

## Dependencies

- `wigolo-sdk` — Thin TypeScript REST client for the wigolo daemon

## License

MIT — wigolo itself is [AGPL-3.0-only](https://github.com/KnockOutEZ/wigolo/blob/main/LICENSE).
