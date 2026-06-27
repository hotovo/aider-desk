/**
 * Structured JSONL debug logger for the Cursor proxy.
 *
 * Gated behind `PI_CURSOR_PROVIDER_DEBUG=1`. When disabled, all log
 * functions are zero-cost no-ops (function references point to empty stubs).
 *
 * Log entries are appended to `~/.pi/agent/cursor-debug.jsonl` by default.
 * Override the path via `PI_CURSOR_PROVIDER_EXTENSION_DEBUG_FILE`.
 */
import { appendFileSync, mkdirSync, statSync, renameSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

// ── Types ──

type DebugEventType =
  | 'request_start'
  | 'request_end'
  | 'session_create'
  | 'session_resume'
  | 'checkpoint_commit'
  | 'checkpoint_discard'
  | 'retry'
  | 'tool_call'
  | 'bridge_open'
  | 'bridge_close'
  | 'lineage_invalidation'
  | 'lifecycle'

interface DebugLogEntry {
  timestamp: string
  type: DebugEventType
  sessionId: string
  requestId: string
  [key: string]: unknown
}

// ── Logger implementation ──

let _enabled = false
let _logFilePath = ''
let _dirEnsured = false

/** Max log file size before rotation (50 MB) */
const MAX_LOG_SIZE_BYTES = 50 * 1024 * 1024

/** Track size in-memory to avoid statSync on every write */
let _estimatedSize = 0
/** Only stat the real file every N writes to re-sync */
const STAT_INTERVAL = 100
let _writesSinceStat = 0

function ensureDir(): void {
  if (_dirEnsured) {
    return
  }
  try {
    mkdirSync(dirname(_logFilePath), { recursive: true })
    _dirEnsured = true
  } catch {
    // best-effort
  }
}

/** Sync in-memory size estimate with actual file size */
function syncFileSize(): void {
  try {
    if (existsSync(_logFilePath)) {
      _estimatedSize = statSync(_logFilePath).size
    } else {
      _estimatedSize = 0
    }
  } catch {
    _estimatedSize = 0
  }
}

/** Rotate the log file if it exceeds the size limit */
function rotateIfNeeded(): void {
  if (_estimatedSize <= MAX_LOG_SIZE_BYTES) {
    return
  }
  try {
    const rotatedPath = `${_logFilePath}.old`
    renameSync(_logFilePath, rotatedPath)
    _estimatedSize = 0
  } catch {
    // best-effort
  }
}

function writeEntry(entry: DebugLogEntry): void {
  if (!_enabled) {
    return
  }
  ensureDir()
  try {
    // Periodic re-sync with actual file size
    _writesSinceStat++
    if (_writesSinceStat >= STAT_INTERVAL) {
      _writesSinceStat = 0
      syncFileSize()
    }
    rotateIfNeeded()
    const line = `${JSON.stringify(entry)}\n`
    appendFileSync(_logFilePath, line, { mode: 0o600 })
    _estimatedSize += Buffer.byteLength(line)
  } catch {
    // best-effort — never crash the proxy for debug logging
  }
}

// ── Public API ──

/** Generate a per-request UUID. Returns empty string when disabled. */
export function debugRequestId(): string {
  if (!_enabled) {
    return ''
  }
  return crypto.randomUUID()
}

/** Log a new chat completion request. */
export function logRequestStart(
  sessionId: string,
  requestId: string,
  payload: { model: string; messageCount: number; toolsCount: number },
): void {
  if (!_enabled) {
    return
  }
  writeEntry({
    timestamp: new Date().toISOString(),
    type: 'request_start',
    sessionId,
    requestId,
    model: payload.model,
    messageCount: payload.messageCount,
    toolsCount: payload.toolsCount,
  })
}

/** Log a completed request. */
export function logRequestEnd(
  sessionId: string,
  requestId: string,
  payload: { durationMs: number; error?: string },
): void {
  if (!_enabled) {
    return
  }
  writeEntry({
    timestamp: new Date().toISOString(),
    type: 'request_end',
    sessionId,
    requestId,
    durationMs: payload.durationMs,
    ...(payload.error ? { error: payload.error } : {}),
  })
}

/** Log session creation. */
export function logSessionCreate(
  sessionId: string,
  requestId: string,
  payload: { sessionKey: string; conversationKey: string },
): void {
  if (!_enabled) {
    return
  }
  writeEntry({
    timestamp: new Date().toISOString(),
    type: 'session_create',
    sessionId,
    requestId,
    sessionKey: payload.sessionKey,
    conversationKey: payload.conversationKey,
  })
}

/** Log session reuse. */
export function logSessionResume(sessionId: string, requestId: string, payload: { sessionKey: string }): void {
  if (!_enabled) {
    return
  }
  writeEntry({
    timestamp: new Date().toISOString(),
    type: 'session_resume',
    sessionId,
    requestId,
    sessionKey: payload.sessionKey,
  })
}

/** Log checkpoint commit. */
export function logCheckpointCommit(sessionId: string, requestId: string, payload: { sizeBytes: number }): void {
  if (!_enabled) {
    return
  }
  writeEntry({
    timestamp: new Date().toISOString(),
    type: 'checkpoint_commit',
    sessionId,
    requestId,
    sizeBytes: payload.sizeBytes,
  })
}

/** Log a retry attempt. */
export function logRetry(
  sessionId: string,
  requestId: string,
  payload: { attempt: number; hint: string; delayMs: number },
): void {
  if (!_enabled) {
    return
  }
  writeEntry({
    timestamp: new Date().toISOString(),
    type: 'retry',
    sessionId,
    requestId,
    attempt: payload.attempt,
    hint: payload.hint,
    delayMs: payload.delayMs,
  })
}

/** Log lineage invalidation (compaction, fork, branch switch). */
export function logLineageInvalidation(
  sessionId: string,
  requestId: string,
  payload: { storedTurnCount: number; incomingTurnCount: number; blobCount: number },
): void {
  if (!_enabled) {
    return
  }
  writeEntry({
    timestamp: new Date().toISOString(),
    type: 'lineage_invalidation',
    sessionId,
    requestId,
    storedTurnCount: payload.storedTurnCount,
    incomingTurnCount: payload.incomingTurnCount,
    blobCount: payload.blobCount,
  })
}

/** Log extension lifecycle event. */
export function logLifecycle(sessionId: string, requestId: string, payload: { event: string }): void {
  if (!_enabled) {
    return
  }
  writeEntry({
    timestamp: new Date().toISOString(),
    type: 'lifecycle',
    sessionId,
    requestId,
    event: payload.event,
  })
}

// ── Initialization ──

/**
 * Initialize the debug logger from environment variables.
 * Call once at startup. Safe to call multiple times (idempotent).
 */
export function initDebugLogger(): void {
  _enabled = process.env.PI_CURSOR_PROVIDER_DEBUG === '1'
  if (!_enabled) {
    return
  }

  _logFilePath =
    process.env.PI_CURSOR_PROVIDER_EXTENSION_DEBUG_FILE ?? join(homedir(), '.pi', 'agent', 'cursor-debug.jsonl')
  _dirEnsured = false
}

// Initialization is done explicitly via initDebugLogger() in index.ts
