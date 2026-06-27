/**
 * Proxy HTTP server — main entry point.
 *
 * Reads config from stdin, discovers models, starts an HTTP server on
 * an ephemeral port, and writes a ready signal to stdout.  Routes:
 *
 *   GET  /v1/models            → OpenAI-format model list
 *   POST /v1/chat/completions  → chat completion (SSE or non-streaming)
 *   /internal/*                → delegate to internal-api
 *   *                          → 404
 *
 * Adapted from pi-cursor (github.com/schultzp2020/pi-extensions) by Paul Schultz.
 */
import { createServer, type ServerResponse } from 'node:http'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

import { validateConfig, type CursorProxyConfig } from './config'
import { errorResponse, jsonResponse } from './http-helpers'
import {
  configureInternalApi,
  getAccessToken,
  getCachedModels,
  handleInternalRequest,
  startHeartbeatMonitor,
} from './internal-api'
import { processModels, type NormalizedModelSet } from './model-normalization'
import { discoverCursorModels, type CursorModel } from './models'
import { handleChatCompletion, type ProxyContext } from './request-lifecycle'
import { closeAll, evict, type ConversationConfig } from './session-state'

// ── Types ──

interface ProxyStartupConfig {
  accessToken: string
  conversationDir: string
  nativeToolsMode?: string
  maxMode?: boolean
  fast?: boolean
  thinking?: boolean
  maxRetries?: number
}

// ── Model management ──

let cachedNormalizedSet: NormalizedModelSet | null = null

function getNormalizedModelSet(): NormalizedModelSet {
  cachedNormalizedSet ??= processModels(getCachedModels())
  return cachedNormalizedSet
}

function invalidateNormalizedModels(): void {
  cachedNormalizedSet = null
}

function handleModelsRequest(res: ServerResponse): void {
  const effectiveModels = getNormalizedModelSet().models

  const data = effectiveModels.map((m) => ({
    id: m.id,
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'cursor',
  }))
  jsonResponse(res, 200, { object: 'list', data })
}

// ── Startup ──

async function main(): Promise<void> {
  // 1. Read config from stdin
  const rl = createInterface({ input: process.stdin })
  const configLine = await new Promise<string>((resolve) => {
    rl.once('line', resolve)
  })
  rl.close()

  let startupConfig: ProxyStartupConfig
  try {
    startupConfig = JSON.parse(configLine) as ProxyStartupConfig
  } catch {
    console.error('[cursor-proxy] Invalid JSON config on stdin')
    process.exit(1)
  }

  if (!startupConfig.accessToken) {
    console.error('[cursor-proxy] accessToken is required')
    process.exit(1)
  }

  if (!startupConfig.conversationDir) {
    console.error('[cursor-proxy] conversationDir is required')
    process.exit(1)
  }

  const cfg: CursorProxyConfig = validateConfig(startupConfig as unknown as Record<string, unknown>)

  const convConfig: ConversationConfig = {
    conversationDiskDir: startupConfig.conversationDir,
  }

  function shutdown(): void {
    console.error('[cursor-proxy] Shutdown requested')
    closeAll()
    process.exit(0)
  }

  // 2. Discover models
  let models: CursorModel[] = []
  try {
    models = await discoverCursorModels(startupConfig.accessToken)
    console.error(`[cursor-proxy] Discovered ${String(models.length)} models`)
  } catch (error) {
    console.error('[cursor-proxy] Model discovery failed:', error)
  }

  // 3. Configure internal API
  configureInternalApi({
    initialToken: startupConfig.accessToken,
    initialModels: models,
    onModelsRefreshed: () => invalidateNormalizedModels(),
    onShutdown: shutdown,
  })

  // 4. Build ProxyContext for request handling
  const proxyCtx: ProxyContext = {
    getAccessToken,
    getNormalizedSet: getNormalizedModelSet,
    convConfig,
    get config() {
      return {
        nativeToolsMode: cfg.nativeToolsMode,
        maxMode: cfg.maxMode,
        fast: cfg.fast,
        thinking: cfg.thinking,
        maxRetries: cfg.maxRetries,
      }
    },
  }

  // 5. Start HTTP server
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')

    if (url.pathname.startsWith('/internal/')) {
      void handleInternalRequest(req, res, url.pathname)
      return
    }

    if (req.method === 'GET' && url.pathname === '/v1/models') {
      handleModelsRequest(res)
      return
    }

    if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
      void handleChatCompletion(req, res, proxyCtx).catch((error) => {
        console.error('[cursor-proxy] Chat completion error:', error)
        if (!res.headersSent) {
          errorResponse(res, 500, 'Internal server error')
        }
      })
      return
    }

    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not Found' }))
  })

  // 6. Start periodic session eviction
  const evictionTimer = setInterval(() => {
    evict()
  }, 60_000)
  if (typeof evictionTimer === 'object' && 'unref' in evictionTimer) {
    evictionTimer.unref()
  }

  server.listen(0, '127.0.0.1', () => {
    const addr = server.address()
    const port = typeof addr === 'object' && addr !== null ? addr.port : 0

    // 7. Write ready signal to stdout (extension reads this)
    const readySignal = JSON.stringify({
      type: 'ready',
      port,
      models: models.map((m) => ({
        id: m.id,
        name: m.name,
        reasoning: m.reasoning,
        contextWindow: m.contextWindow,
        maxTokens: m.maxTokens,
        supportsImages: m.supportsImages,
        contextWindowMaxMode: m.contextWindowMaxMode,
      })),
    })
    console.log(readySignal)

    // 8. Start heartbeat monitor
    startHeartbeatMonitor()

    console.error(`[cursor-proxy] Listening on port ${String(port)}`)
  })
}

process.on('SIGTERM', () => {
  console.error('[cursor-proxy] Received SIGTERM, shutting down...')
  try {
    closeAll()
  } catch {
    // Ignore cleanup errors during shutdown
  }
  process.exit(0)
})

process.on('SIGINT', () => {
  console.error('[cursor-proxy] Received SIGINT, shutting down...')
  try {
    closeAll()
  } catch {
    // Ignore cleanup errors during shutdown
  }
  process.exit(0)
})

main().catch((error) => {
  console.error('[cursor-proxy] Fatal:', error)
  process.exit(1)
})
