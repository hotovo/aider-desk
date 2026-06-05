# SearXNG Search Extension

Web search tool using [SearXNG](https://docs.searxng.org/) with auto-starting Docker container support.

## Features

- Adds a `search` tool for web searching via a SearXNG instance
- **Docker mode**: Automatically starts a SearXNG container using [Testcontainers](https://testcontainers.com/)
- **URL mode**: Connect to an existing SearXNG instance
- Search result formatting as markdown with titles, URLs, and snippets
- Language filtering and category selection support

## Configuration

Click the gear icon on the extension card to configure:

| Setting | Description | Default |
|---------|-------------|---------|
| **Source** | `Docker` (auto-start container) or `Existing SearXNG instance` (provide URL) | Docker |
| **SearXNG URL** | URL of existing SearXNG instance (only shown when Source is "Existing SearXNG instance") | — |

### Docker Mode

Requires Docker to be installed and running. The extension will:

1. Pull the `searxng/searxng:latest` image (on first use)
2. Start the container with JSON API enabled
3. Manage the container lifecycle (start/stop)

### URL Mode

Provide the URL of a running SearXNG instance. Make sure the JSON format is enabled in its `settings.yml`:

```yaml
search:
  formats:
    - html
    - json
```

## Tool: `search`

Searches the web using a SearXNG instance.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | The search query |
| `language` | string | No | Language code (e.g., "en", "es", "fr"). Default: "en" |
| `categories` | string | No | Comma-separated categories (e.g., "news,science", "images", "it") |
| `maxResults` | number | No | Maximum results to return. Default: 5 |

## Dependencies

- `searchxng` — CLI client for querying SearXNG instances
- `testcontainers` — Docker container management for auto-starting SearXNG

## Prerequisites

For Docker mode:
- [Docker](https://docs.docker.com/get-docker/) installed and running
