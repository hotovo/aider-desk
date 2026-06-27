/**
 * Internal API endpoints for proxy management.
 *
 * Handles heartbeat, token updates, health checks, and model refresh
 * from Pi extension sessions communicating with the shared proxy.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'

import { jsonResponse, readBody } from './http-helpers'
import { discoverCursorModels, type CursorModel } from './models'
import { cleanup } from './session-state'

interface SessionHeartbeat {
  sessionId: string
  lastHeartbeatMs: number
}

const heartbeatClients = new Map<string, SessionHeartbeat>()
const HEARTBEAT_TIMEOUT_MS = 30_000

let currentAccessToken: string | null = null
let cachedModels: CursorModel[] = []
let onModelsRefreshed: ((models: CursorModel[]) => void) | null = null
let shutdownCallback: (() => void) | null = null

export function configureInternalApi(opts: {
  initialToken: string | null
  initialModels: CursorModel[]
  onModelsRefreshed?: (models: CursorModel[]) => void
  onShutdown?: () => void
}): void {
  currentAccessToken = opts.initialToken
  cachedModels = opts.initialModels
  onModelsRefreshed = opts.onModelsRefreshed ?? null
  shutdownCallback = opts.onShutdown ?? null
}

export function getAccessToken(): string | null {
  return currentAccessToken
}

export function getCachedModels(): CursorModel[] {
  return cachedModels
}

export function startHeartbeatMonitor(): NodeJS.Timeout {
  const timer = setInterval(() => {
    const now = Date.now()
    for (const [id] of heartbeatClients) {
      const session = heartbeatClients.get(id)
      if (session && now - session.lastHeartbeatMs > HEARTBEAT_TIMEOUT_MS) {
        heartbeatClients.delete(id)
      }
    }
    if (heartbeatClients.size === 0) {
      console.error('[proxy] No active sessions, shutting down')
      shutdownCallback?.()
    }
  }, 10_000)
  if (typeof timer === 'object' && 'unref' in timer) {
    timer.unref()
  }
  return timer
}

export async function handleInternalRequest(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  if (path === '/internal/health' && req.method === 'GET') {
    jsonResponse(res, 200, {
      status: 'ok',
      sessions: heartbeatClients.size,
      hasToken: currentAccessToken !== null,
      modelCount: cachedModels.length,
    })
    return
  }

  if (path === '/internal/heartbeat' && req.method === 'POST') {
    let body: { sessionId?: string }
    try {
      body = JSON.parse(await readBody(req)) as { sessionId?: string }
    } catch {
      jsonResponse(res, 400, { error: 'invalid JSON' })
      return
    }
    const { sessionId } = body
    if (!sessionId) {
      jsonResponse(res, 400, { error: 'sessionId required' })
      return
    }
    heartbeatClients.set(sessionId, { sessionId, lastHeartbeatMs: Date.now() })
    jsonResponse(res, 200, { ok: true })
    return
  }

  if (path === '/internal/token' && req.method === 'POST') {
    let body: { access?: string }
    try {
      body = JSON.parse(await readBody(req)) as { access?: string }
    } catch {
      jsonResponse(res, 400, { error: 'invalid JSON' })
      return
    }
    if (body.access) {
      currentAccessToken = body.access
      jsonResponse(res, 200, { ok: true })
    } else {
      jsonResponse(res, 400, { error: 'access token required' })
    }
    return
  }

  if (path === '/internal/models' && req.method === 'GET') {
    jsonResponse(res, 200, { models: cachedModels })
    return
  }

  if (path === '/internal/refresh-models' && req.method === 'POST') {
    if (!currentAccessToken) {
      jsonResponse(res, 400, { error: 'no access token' })
      return
    }
    try {
      const models = await discoverCursorModels(currentAccessToken)
      cachedModels = models
      onModelsRefreshed?.(models)
      jsonResponse(res, 200, { models })
    } catch (error) {
      jsonResponse(res, 500, { error: String(error) })
    }
    return
  }

  if (path === '/internal/cleanup-session' && req.method === 'POST') {
    let body: { sessionId?: string }
    try {
      body = JSON.parse(await readBody(req)) as { sessionId?: string }
    } catch {
      jsonResponse(res, 400, { error: 'invalid JSON' })
      return
    }
    const { sessionId } = body
    if (!sessionId) {
      jsonResponse(res, 400, { error: 'sessionId required' })
      return
    }
    cleanup(sessionId)
    jsonResponse(res, 200, { ok: true })
    return
  }

  jsonResponse(res, 404, { error: 'not found' })
}
