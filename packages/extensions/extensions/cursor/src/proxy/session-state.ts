/**
 * Session State module — manages the active Bridge (CursorSession) and
 * Conversation State (Checkpoint, Blob Store, Checkpoint Lineage) as a
 * unit, keyed by Session ID.
 *
 * Callers pass the raw Session ID and never see derived hash keys.
 *
 * Asymmetric lifetime:
 *   - cleanup(sessionId): closes Bridge, keeps conversation
 *   - evict(): removes both stale Bridges AND conversations; evicting a
 *     conversation also closes its Bridge
 */
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import type { CursorSession } from './cursor-session'
import type { ParsedConversationTurn } from './openai-messages'

// ── Constants ──

/** Maximum number of blobs retained per conversation. LRU-evicted on overflow. */
const MAX_BLOB_COUNT = 128

/** Single TTL for both Bridge and Conversation entries. */
const SESSION_TTL_MS = 30 * 60 * 1000 // 30 minutes

// ── Types ──

export interface StoredConversation {
  conversationId: string
  checkpoint: Uint8Array | null
  blobStore: Map<string, Uint8Array>
  lastAccessMs: number
  checkpointHistory: Map<string, Uint8Array>
  checkpointArchive: Map<string, Uint8Array>
  lineageTurnCount: number
  lineageFingerprint: string | null
}

export interface LineageMetadata {
  turnCount: number
  fingerprint: string
}

export interface ConversationConfig {
  conversationDiskDir: string
}

interface DiskFormat {
  conversationId: string
  checkpoint: string | null
  blobStore: Record<string, string>
  checkpointHistory: Record<string, string>
  checkpointArchive: Record<string, string>
  lineageTurnCount?: number
  lineageFingerprint?: string | null
}

interface ActiveBridge {
  bridge: CursorSession
  lastAccessMs: number
}

/**
 * Result of resolveSession — provides the active Bridge (if any) and
 * the conversation state.  `lineageInvalidated` is true when the stored
 * lineage did not match the incoming history and the conversation was reset.
 */
export interface SessionResolution {
  bridge: CursorSession | undefined
  conversation: StoredConversation
  lineageInvalidated: boolean
}

// ── Internal state ──

const bridges = new Map<string, ActiveBridge>()
const conversationCache = new Map<string, StoredConversation>()

// ── Internal helpers ──

/** Derive the bridge (session) map key from a raw Session ID. */
export function deriveBridgeKey(sessionId: string): string {
  return createHash('sha256').update(`session:${sessionId}`).digest('hex').slice(0, 16)
}

/** Derive the conversation cache/disk key from a raw Session ID.
 *  Uses `conv:` prefix for backward compatibility with existing disk files. */
export function deriveConvKey(sessionId: string): string {
  return createHash('sha256').update(`conv:${sessionId}`).digest('hex').slice(0, 16)
}

function diskPath(key: string, config: ConversationConfig): string {
  return join(config.conversationDiskDir, `${key}.json`)
}

function encodeMap(map: Map<string, Uint8Array>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of map) {
    out[k] = Buffer.from(v).toString('base64')
  }
  return out
}

function decodeMap(obj: Record<string, string> | undefined): Map<string, Uint8Array> {
  const map = new Map<string, Uint8Array>()
  if (!obj) {
    return map
  }
  for (const [k, v] of Object.entries(obj)) {
    map.set(k, Uint8Array.from(Buffer.from(v, 'base64')))
  }
  return map
}

function createFreshConversation(): StoredConversation {
  return {
    conversationId: randomUUID(),
    checkpoint: null,
    blobStore: new Map(),
    lastAccessMs: Date.now(),
    checkpointHistory: new Map(),
    checkpointArchive: new Map(),
    lineageTurnCount: 0,
    lineageFingerprint: null,
  }
}

function loadFromDisk(key: string, config: ConversationConfig): StoredConversation | null {
  const filePath = diskPath(key, config)
  if (!existsSync(filePath)) {
    return null
  }
  try {
    const raw = readFileSync(filePath, 'utf-8')
    const data = JSON.parse(raw) as DiskFormat
    const stored: StoredConversation = {
      conversationId: data.conversationId,
      checkpoint: data.checkpoint ? Uint8Array.from(Buffer.from(data.checkpoint, 'base64')) : null,
      blobStore: decodeMap(data.blobStore),
      lastAccessMs: Date.now(),
      checkpointHistory: decodeMap(data.checkpointHistory),
      checkpointArchive: decodeMap(data.checkpointArchive),
      lineageTurnCount: data.lineageTurnCount ?? 0,
      lineageFingerprint: data.lineageFingerprint ?? null,
    }
    return stored
  } catch {
    return null
  }
}

/**
 * Check whether the stored lineage matches the incoming lineage.
 * Returns false if turn count or fingerprint mismatch.
 */
function validateLineage(stored: StoredConversation, incoming: LineageMetadata): boolean {
  if (stored.lineageTurnCount !== incoming.turnCount) {
    return false
  }
  // Fresh conversations (no fingerprint stored yet) are always valid
  if (stored.lineageFingerprint === null) {
    return true
  }
  return stored.lineageFingerprint === incoming.fingerprint
}

// ── Exported utility functions ──

/**
 * Compute a SHA256 fingerprint from the completed conversation turns.
 * The fingerprint covers only user text of each turn in order, so that
 * it can be computed after turn completion without capturing the streamed
 * assistant response text.
 */
export function computeLineageFingerprint(turns: Pick<ParsedConversationTurn, 'userText'>[]): string {
  const hash = createHash('sha256')
  for (const turn of turns) {
    hash.update(turn.userText)
    hash.update('\0')
  }
  return hash.digest('hex')
}

/**
 * Discard checkpoint, history, and blobs, and assign a new conversation ID.
 * Use on lineage mismatch (compaction, fork, branch switch).
 */
export function resetConversation(stored: StoredConversation): void {
  stored.conversationId = randomUUID()
  stored.checkpoint = null
  stored.checkpointHistory.clear()
  stored.checkpointArchive.clear()
  stored.blobStore.clear()
  stored.lineageTurnCount = 0
  stored.lineageFingerprint = null
}

/**
 * Evict oldest blobs when the store exceeds MAX_BLOB_COUNT.
 * Map iteration order is insertion-order, so deleting from the front
 * evicts the oldest entries first (LRU approximation).
 */
export function pruneBlobs(blobStore: Map<string, Uint8Array>): number {
  const excess = blobStore.size - MAX_BLOB_COUNT
  if (excess <= 0) {
    return 0
  }
  let evicted = 0
  for (const key of blobStore.keys()) {
    if (evicted >= excess) {
      break
    }
    blobStore.delete(key)
    evicted++
  }
  return evicted
}

/**
 * Persist conversation state to disk atomically (write to temp file, then rename).
 */
export function persistConversation(sessionId: string, stored: StoredConversation, config: ConversationConfig): void {
  mkdirSync(config.conversationDiskDir, { recursive: true, mode: 0o700 })
  const key = deriveConvKey(sessionId)

  const data: DiskFormat = {
    conversationId: stored.conversationId,
    checkpoint: stored.checkpoint ? Buffer.from(stored.checkpoint).toString('base64') : null,
    blobStore: encodeMap(stored.blobStore),
    checkpointHistory: encodeMap(stored.checkpointHistory),
    checkpointArchive: encodeMap(stored.checkpointArchive),
    lineageTurnCount: stored.lineageTurnCount,
    lineageFingerprint: stored.lineageFingerprint,
  }

  const filePath = diskPath(key, config)
  const tmpPath = `${filePath}.tmp.${randomUUID()}`
  writeFileSync(tmpPath, JSON.stringify(data, null, 2), { encoding: 'utf-8', mode: 0o600 })
  renameSync(tmpPath, filePath)
}

// ── Primary interface ──

/**
 * Resolve a session by ID: returns the active Bridge (if any), the
 * conversation state (from cache → disk → fresh), and whether lineage
 * was invalidated.
 *
 * When `history` is provided and the conversation has a checkpoint,
 * lineage validation is performed.  On mismatch the conversation is
 * reset (new ID, cleared checkpoint/blobs) and `lineageInvalidated`
 * is set to true.
 */
export function resolveSession(
  sessionId: string,
  config: ConversationConfig,
  history?: Pick<ParsedConversationTurn, 'userText'>[],
): SessionResolution {
  const bKey = deriveBridgeKey(sessionId)
  const cKey = deriveConvKey(sessionId)

  // ── Bridge ──
  const bridgeEntry = bridges.get(bKey)
  if (bridgeEntry) {
    bridgeEntry.lastAccessMs = Date.now()
  }
  const bridge = bridgeEntry?.bridge

  // ── Conversation ──
  let conversation = conversationCache.get(cKey)
  if (conversation) {
    conversation.lastAccessMs = Date.now()
  } else {
    const fromDisk = loadFromDisk(cKey, config)
    if (fromDisk) {
      conversationCache.set(cKey, fromDisk)
      conversation = fromDisk
    } else {
      const fresh = createFreshConversation()
      conversationCache.set(cKey, fresh)
      conversation = fresh
    }
  }

  // ── Lineage validation ──
  let lineageInvalidated = false
  if (history && conversation.checkpoint !== null) {
    const incoming: LineageMetadata = {
      turnCount: history.length,
      fingerprint: computeLineageFingerprint(history),
    }
    if (!validateLineage(conversation, incoming)) {
      resetConversation(conversation)
      lineageInvalidated = true
    }
  }

  return { bridge, conversation, lineageInvalidated }
}

/**
 * Register a Bridge (CursorSession) for a session.
 */
export function registerBridge(sessionId: string, bridge: CursorSession): void {
  const key = deriveBridgeKey(sessionId)
  bridges.set(key, { bridge, lastAccessMs: Date.now() })
}

/**
 * Commit a completed turn: update lineage metadata and persist to disk.
 * Prunes blobs before persisting.
 */
export function commitTurn(sessionId: string, lineage: LineageMetadata, config: ConversationConfig): void {
  const key = deriveConvKey(sessionId)
  const stored = conversationCache.get(key)
  if (!stored) {
    return
  }
  stored.lineageTurnCount = lineage.turnCount
  stored.lineageFingerprint = lineage.fingerprint
  pruneBlobs(stored.blobStore)
  persistConversation(sessionId, stored, config)
}

/**
 * Close the Bridge for a session but keep the conversation state.
 * Asymmetric lifetime — a Bridge without conversation state is useless,
 * but a conversation without a Bridge is normal (future turns reopen).
 *
 * Cancels (rather than closes) the Bridge so that in-flight requests
 * are terminated immediately.
 */
export function cleanup(sessionId: string): void {
  const key = deriveBridgeKey(sessionId)
  const entry = bridges.get(key)
  if (entry) {
    entry.bridge.cancel()
    bridges.delete(key)
  }
}

/**
 * Close and remove the Bridge for a session.  Used when a request
 * completes normally and the Bridge is no longer needed.
 */
export function closeBridge(sessionId: string): void {
  const key = deriveBridgeKey(sessionId)
  const entry = bridges.get(key)
  if (entry) {
    entry.bridge.close()
    bridges.delete(key)
  }
}

/**
 * Get the conversation state from the in-memory cache only.
 * Returns undefined if not cached.  Does NOT load from disk.
 */
export function getConversationState(sessionId: string): StoredConversation | undefined {
  const key = deriveConvKey(sessionId)
  const stored = conversationCache.get(key)
  if (stored) {
    stored.lastAccessMs = Date.now()
  }
  return stored
}

/**
 * Evict stale entries — both Bridges and Conversations — using a
 * independent TTL sweeps.  Bridge and Conversation keys are derived
 * separately, so each is evicted based on its own `lastAccessMs`.
 */
export function evict(): void {
  const now = Date.now()

  // Evict stale conversations
  for (const [key, stored] of conversationCache) {
    if (now - stored.lastAccessMs > SESSION_TTL_MS) {
      conversationCache.delete(key)
    }
  }

  // Evict stale bridges
  for (const [key, entry] of bridges) {
    if (now - entry.lastAccessMs > SESSION_TTL_MS) {
      entry.bridge.close()
      bridges.delete(key)
    }
  }
}

/**
 * Remove a session's conversation from the in-memory cache.
 */
export function invalidateSession(sessionId: string): void {
  const bKey = deriveBridgeKey(sessionId)
  const cKey = deriveConvKey(sessionId)
  bridges.delete(bKey)
  conversationCache.delete(cKey)
}

/**
 * Close all active Bridges.
 */
export function closeAll(): void {
  for (const [, entry] of bridges) {
    entry.bridge.close()
  }
  bridges.clear()
}
