/**
 * Request Lifecycle module — owns the full lifecycle of a single
 * `/v1/chat/completions` request.
 *
 * Entry point: `handleChatCompletion(req, res, ctx)`.
 *
 * Responsibilities:
 *   1. Parse request body
 *   2. Resolve model (normalize ID, apply Effort Resolution & Max Mode)
 *   3. Parse messages (OpenAI → parsed messages with conversation turns)
 *   4. Resolve Session State (via session-state module)
 *   5. Validate Checkpoint Lineage
 *   6. Build protobuf RunRequest
 *   7. Create Bridge (CursorSession)
 *   8. Retry on transient failures (blob_not_found, resource_exhausted, timeout)
 *   9. Stream or collect response
 *  10. Commit Checkpoint and Lineage after successful turn
 */
import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'

import { create, fromBinary, fromJson, toBinary } from '@bufbuild/protobuf'
import type { JsonValue } from '@bufbuild/protobuf'
import { ValueSchema } from '@bufbuild/protobuf/wkt'

import {
  AgentClientMessageSchema,
  AgentRunRequestSchema,
  ConversationActionSchema,
  ConversationStateStructureSchema,
  McpToolDefinitionSchema,
  type McpToolDefinition,
  ModelDetailsSchema,
  RequestedModelSchema,
  RequestedModel_ModelParameterbytesSchema,
  UserMessageActionSchema,
  UserMessageSchema,
} from '../proto/agent_pb'
import type { NativeToolsMode, CursorConfig } from './config'
import { CursorSession, type RetryHint, type SessionOptions } from './cursor-session'
import {
  debugRequestId,
  logCheckpointCommit,
  logLineageInvalidation,
  logRequestEnd,
  logRequestStart,
  logRetry,
  logSessionCreate,
  logSessionResume,
} from './debug-logger'
import { errorResponse, readBody } from './http-helpers'
import { resolveModelId, type NormalizedModelSet } from './model-normalization'
import { MCP_TOOL_PREFIX, resolveAllowedRoot } from './native-tools'
import { type OpenAIMessage, type OpenAIToolDef, parseMessages, selectToolsForChoice } from './openai-messages'
import {
  collectNonStreamingResponse,
  createSSECtx,
  type PumpResult,
  pumpSession,
  SSE_HEADERS,
} from './openai-stream'
import { buildRequestContext } from './request-context'
import {
  closeBridge,
  commitTurn,
  computeLineageFingerprint,
  deriveBridgeKey,
  deriveConvKey,
  getConversationState,
  persistConversation,
  pruneBlobs,
  registerBridge,
  resetConversation,
  resolveSession,
  type ConversationConfig,
  type StoredConversation,
} from './session-state'

// ── Proxy Context ──

/**
 * Stable per-Proxy state passed into each request lifecycle invocation.
 *
 * Constructed once in `main.ts` and shared across all requests.
 */
export interface ProxyContext {
  /** Returns the current access token, or null if unconfigured. */
  getAccessToken: () => string | null
  /** Returns the current normalized model set for model resolution. */
  getNormalizedSet: () => NormalizedModelSet
  /** Conversation persistence configuration. */
  convConfig: ConversationConfig
  /** Resolved Cursor configuration snapshot. */
  config: Pick<CursorConfig, 'nativeToolsMode' | 'maxMode' | 'fast' | 'thinking' | 'maxRetries'>
}

// ── Context tier suffix parsing ──

/**
 * Parse a context-tier suffix from a model ID.
 * Models with larger context tiers are registered with a ~{tokens} suffix
 * (e.g. "gpt-5.4~1000000" for 1M context).
 */
export function parseContextTierSuffix(modelId: string): { baseModelId: string; longContext: boolean } {
  const tildeIdx = modelId.lastIndexOf('~')
  if (tildeIdx > 0) {
    const contextTokens = Number(modelId.slice(tildeIdx + 1))
    if (Number.isFinite(contextTokens) && contextTokens > 0) {
      return { baseModelId: modelId.slice(0, tildeIdx), longContext: true }
    }
  }
  return { baseModelId: modelId, longContext: false }
}

// ── Request types ──

interface ChatCompletionRequest {
  model: string
  messages: OpenAIMessage[]
  stream?: boolean
  temperature?: number
  max_tokens?: number
  tools?: OpenAIToolDef[]
  tool_choice?: string | { type: string; function: { name: string } }
}

// ── Retry helpers ──

/** Base delay (ms) before retrying based on the failure hint, with jitter. */
function retryDelayMs(hint: RetryHint): number {
  let base: number
  switch (hint) {
    case 'blob_not_found': {
      base = 200
      break
    }
    case 'resource_exhausted': {
      base = 2000
      break
    }
    case 'timeout': {
      base = 1000
      break
    }
  }
  // Add 0-50% jitter to prevent thundering herd
  return Math.round(base * (1 + Math.random() * 0.5))
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms).unref()
  })
}

/** Shared encoder instance — avoids repeated allocation in hot paths. */
const encoder = new TextEncoder()

// ── Validation ──

function isChatCompletionRequest(value: unknown): value is ChatCompletionRequest {
  if (!value || typeof value !== 'object') {
    return false
  }
  const req = value as { model?: unknown; messages?: unknown }
  return (
    typeof req.model === 'string' &&
    Array.isArray(req.messages) &&
    req.messages.every(
      (m: unknown) => m !== null && typeof m === 'object' && typeof (m as { role?: unknown }).role === 'string',
    )
  )
}

// ── Tool definitions ──

function buildMcpToolDefinitions(tools: OpenAIToolDef[]): McpToolDefinition[] {
  return tools.map((t) => {
    const { function: fn } = t
    const jsonSchema: JsonValue =
      fn.parameters && typeof fn.parameters === 'object'
        ? (fn.parameters as JsonValue)
        : ({ type: 'object', properties: {}, required: [] } as JsonValue)
    const inputSchema = toBinary(ValueSchema, fromJson(ValueSchema, jsonSchema))
    return create(McpToolDefinitionSchema, {
      name: `${MCP_TOOL_PREFIX}${fn.name}`,
      description: fn.description ?? '',
      providerIdentifier: 'pi',
      toolName: fn.name,
      inputSchema,
    })
  })
}

// ── Checkpoint decode ──

function decodeCheckpointState(
  checkpoint: Uint8Array,
): ReturnType<typeof create<typeof ConversationStateStructureSchema>> | null {
  try {
    return fromBinary(ConversationStateStructureSchema, checkpoint)
  } catch {
    console.error('[proxy] Ignoring invalid stored checkpoint')
    return null
  }
}

// ── System prompt folding (exported for testing) ──

/**
 * Maximum byte size for the effective system prompt after folding turns.
 * Older turns are dropped (newest-first) when the combined size exceeds this.
 */
const MAX_EFFECTIVE_PROMPT_BYTES = 100_000

/**
 * Fold prior conversation turns into the system prompt so the LLM retains
 * context even when no checkpoint is available (e.g. after compaction).
 *
 * If the combined size exceeds MAX_EFFECTIVE_PROMPT_BYTES, the oldest turns
 * are dropped and a note is prepended indicating truncation.
 */
export function foldTurnsIntoSystemPrompt(
  systemPrompt: string,
  turns: { userText: string; assistantText: string; isCompaction?: boolean }[],
): string {
  if (turns.length === 0) {
    return systemPrompt
  }

  const contextParts = turns.map((t) => {
    if (t.isCompaction) {
      return `<context>\n${t.userText}\n</context>`
    }
    return `User: ${t.userText}${t.assistantText ? `\nAssistant: ${t.assistantText}` : ''}`
  })

  // Try full fold first
  const fullFold = `${systemPrompt}\n\nPrevious conversation context:\n${contextParts.join('\n\n')}`
  if (encoder.encode(fullFold).byteLength <= MAX_EFFECTIVE_PROMPT_BYTES) {
    return fullFold
  }

  // Truncate oldest turns until under the cap.
  // Compaction/context-summary turns are prioritized — they are reserved first
  // so that pre-compaction context survives truncation.  Real conversation turns
  // fill the remaining budget newest-first.
  console.error(
    `[proxy] Folded system prompt exceeds ${String(MAX_EFFECTIVE_PROMPT_BYTES)} bytes — truncating oldest turns`,
  )
  const prefix = `${systemPrompt}\n\nPrevious conversation context (oldest turns truncated):\n`
  let budget = MAX_EFFECTIVE_PROMPT_BYTES - encoder.encode(prefix).byteLength

  // Partition into compaction and regular indices
  const compactionIndices: number[] = []
  const regularIndices: number[] = []
  for (let i = 0; i < turns.length; i++) {
    if (turns[i].isCompaction) {
      compactionIndices.push(i)
    } else {
      regularIndices.push(i)
    }
  }

  // Reserve budget for compaction turns first (in original order)
  const keptIndices = new Set<number>()
  for (const idx of compactionIndices) {
    const partBytes = encoder.encode(contextParts[idx]).byteLength + 2
    if (partBytes > budget) {
      continue // skip oversized turn, try remaining
    }
    budget -= partBytes
    keptIndices.add(idx)
  }

  // Fill remaining budget with regular turns, newest first
  for (let i = regularIndices.length - 1; i >= 0; i--) {
    const idx = regularIndices[i]
    const partBytes = encoder.encode(contextParts[idx]).byteLength + 2
    if (partBytes > budget) {
      continue // skip oversized turn, try remaining
    }
    budget -= partBytes
    keptIndices.add(idx)
  }

  if (keptIndices.size === 0) {
    return systemPrompt
  }

  // Reassemble in original order
  const kept = [...keptIndices].sort((a, b) => a - b).map((i) => contextParts[i])
  return `${prefix}${kept.join('\n\n')}`
}

// ── Request builder (exported for testing) ──

// ---------------------------------------------------------------------------
// RequestedModel parameter builder
// ---------------------------------------------------------------------------

// TODO(context-modes): The parameter name 'long_context' is a guess based on
// Cursor's UI showing per-model context tiers (e.g. 200K / 1M). Verify via
// Cursor DevTools (Network tab → AgentRun request → RequestedModel.parameters)
// and update if the actual key differs.
function buildModelParameters(longContext: boolean) {
  const params = []
  if (longContext) {
    params.push(
      create(RequestedModel_ModelParameterbytesSchema, {
        id: 'long_context',
        value: 'true',
      }),
    )
  }
  return params
}

function buildRunRequest(
  modelId: string,
  systemPrompt: string,
  userText: string,
  turns: { userText: string; assistantText: string; isCompaction?: boolean }[],
  conversationId: string,
  checkpoint: Uint8Array | null,
  blobStore: Map<string, Uint8Array>,
  mcpTools: McpToolDefinition[],
  nativeToolsMode: NativeToolsMode = 'reject',
  longContext = false,
  maxMode = false,
): { requestBytes: Uint8Array; blobStore: Map<string, Uint8Array>; mcpTools: McpToolDefinition[] } {
  // Try decoding a persisted checkpoint
  const decodedCheckpoint = checkpoint ? decodeCheckpointState(checkpoint) : null

  let conversationState: ReturnType<typeof create<typeof ConversationStateStructureSchema>>
  let effectiveSystemPrompt = systemPrompt

  if (decodedCheckpoint) {
    conversationState = decodedCheckpoint
  } else {
    // No checkpoint — start a fresh conversation with empty turns.
    //
    // Cursor's server treats the `turns` field as blob references (not inline
    // data).  Putting serialized turn bytes there causes "Blob not found"
    // errors.  Instead, fold any prior turns into the system prompt so the
    // LLM still sees the conversation context.
    if (turns.length > 0) {
      effectiveSystemPrompt = foldTurnsIntoSystemPrompt(systemPrompt, turns)
    }
    conversationState = create(ConversationStateStructureSchema, { turns: [] })
  }

  const userMessage = create(UserMessageSchema, {
    text: userText,
    messageId: randomUUID(),
  })
  const requestContext = buildRequestContext(mcpTools, effectiveSystemPrompt || undefined, nativeToolsMode)
  const action = create(ConversationActionSchema, {
    action: {
      case: 'userMessageAction',
      value: create(UserMessageActionSchema, { userMessage, requestContext }),
    },
  })

  // Max mode: enabled via config toggle OR by -max suffix on the model ID.
  // The -max suffix is stripped before sending to Cursor.
  const hasMaxSuffix = modelId.endsWith('-max')
  const isMaxMode = maxMode || hasMaxSuffix
  const cursorModelId = hasMaxSuffix ? modelId.slice(0, -4) : modelId

  // Build RequestedModel with parameters (new API path)
  const parameters = buildModelParameters(longContext)
  const requestedModel = create(RequestedModelSchema, {
    modelId: cursorModelId,
    maxMode: isMaxMode,
    parameters,
  })

  // Also send ModelDetails for backward compat (deprecated but still accepted)
  const modelDetails = create(ModelDetailsSchema, {
    modelId: cursorModelId,
    displayModelId: cursorModelId,
    displayName: cursorModelId,
    displayNameShort: cursorModelId,
    maxMode: isMaxMode,
  })

  const runRequest = create(AgentRunRequestSchema, {
    conversationState,
    action,
    modelDetails,
    requestedModel,
    conversationId,
  })

  const clientMessage = create(AgentClientMessageSchema, {
    message: { case: 'runRequest', value: runRequest },
  })

  return {
    requestBytes: toBinary(AgentClientMessageSchema, clientMessage),
    blobStore,
    mcpTools,
  }
}

// ── Lineage & retry context types ──

/**
 * Lineage context for updating lineage after successful turn completion.
 */
interface LineageInfo {
  turns: { userText: string }[]
  userText: string
}

/**
 * Context for creating new sessions on retry. When omitted, retries are
 * disabled (e.g. tool-result resume where session options are unavailable).
 */
interface RetryContext {
  sessionOptions: SessionOptions
  req: IncomingMessage
  maxRetries: number
  /** Rebuild requestBytes without checkpoint for blob_not_found recovery. */
  rebuildWithoutCheckpoint?: (stored: StoredConversation) => Uint8Array
}

// ── Pump & finalize (streaming) ──

/**
 * Pump a session and handle batchReady (keep session alive for tool-result
 * continuation) or done (clean up).  When `retryCtx` is provided and
 * `pumpSession` returns a retryable failure, the failed session is closed
 * and a fresh session is created (up to `maxRetries` times).
 */
async function pumpAndFinalize(
  session: CursorSession,
  ctx: ReturnType<typeof createSSECtx>,
  sessionId: string,
  convConfig: ConversationConfig,
  lineageInfo?: LineageInfo,
  debugInfo?: { sid: string; rid: string; startTime: number },
  retryCtx?: RetryContext,
): Promise<void> {
  let currentSession = session
  let attempt = 0
  let streamCloseHandler: (() => void) | null = null

  try {
    for (;;) {
      const result: PumpResult = await pumpSession(currentSession, ctx)

      if (result.outcome === 'batchReady') {
        // Keep session alive for tool-result continuation
        registerBridge(sessionId, currentSession)
        return
      }

      // ── Retryable failure — create a new session and retry ──
      if (result.outcome === 'retry' && retryCtx && attempt < retryCtx.maxRetries) {
        closeBridge(sessionId)
        currentSession.close()
        attempt++
        const delayMs = retryDelayMs(result.retryHint)
        if (debugInfo) {
          logRetry(debugInfo.sid, debugInfo.rid, { attempt, hint: result.retryHint, delayMs })
        }
        console.error(
          `[proxy] Retry ${attempt}/${retryCtx.maxRetries} after ${result.retryHint}: ${result.error} (delay ${delayMs}ms)`,
        )
        await sleep(delayMs)

        // On blob_not_found: reset conversation (new ID, clear blobs) and
        // rebuild requestBytes so the retry starts a fresh Cursor conversation.
        // Called unconditionally (not guarded by stored?.checkpoint) because
        // the new conversation ID is needed regardless of checkpoint state.
        if (result.retryHint === 'blob_not_found') {
          const stored = getConversationState(sessionId)
          if (stored) {
            resetConversation(stored)
            if (retryCtx.rebuildWithoutCheckpoint) {
              retryCtx.sessionOptions = {
                ...retryCtx.sessionOptions,
                requestBytes: retryCtx.rebuildWithoutCheckpoint(stored),
              }
            }
            persistConversation(sessionId, stored, convConfig)
            console.error('[proxy] blob_not_found: rebuilt request with new conversation ID for retry')
          }
        }

        // New session — either same options (transient error) or
        // rebuilt options (blob_not_found checkpoint discard)
        currentSession = new CursorSession(retryCtx.sessionOptions)
        // Remove previous close handler to prevent listener accumulation
        if (streamCloseHandler) {
          retryCtx.req.removeListener('close', streamCloseHandler)
        }
        const sessionToCancel = currentSession
        streamCloseHandler = () => {
          if (sessionToCancel.alive) {
            sessionToCancel.cancel()
          }
        }
        retryCtx.req.on('close', streamCloseHandler)
        continue
      }

      // ── Done or final retry failure — persist and clean up ──
      // Update lineage only after successful turn completion (outcome === 'done').
      // On retry/error, preserve previous committed lineage.
      if (result.outcome === 'done' && lineageInfo) {
        const completedTurns = [...lineageInfo.turns, { userText: lineageInfo.userText }]
        commitTurn(
          sessionId,
          {
            turnCount: completedTurns.length,
            fingerprint: computeLineageFingerprint(completedTurns),
          },
          convConfig,
        )
      } else {
        const stored = getConversationState(sessionId)
        if (stored) {
          persistConversation(sessionId, stored, convConfig)
        }
      }
      closeBridge(sessionId)
      currentSession.close()

      // Surface the error when retries are exhausted
      if (result.outcome === 'retry') {
        ctx.sendChunk({ content: `\n[Error: ${result.error} (retries exhausted)]` })
        ctx.sendChunk({}, 'stop')
        ctx.sendDone()
      }

      if (debugInfo) {
        const error = result.outcome === 'retry' ? result.error : undefined
        logRequestEnd(debugInfo.sid, debugInfo.rid, {
          durationMs: Date.now() - debugInfo.startTime,
          error,
        })
      }
      return
    }
  } catch (error) {
    console.error('[proxy] pumpSession error:', error)
    closeBridge(sessionId)
    currentSession.close()
    ctx.close()
    if (debugInfo) {
      logRequestEnd(debugInfo.sid, debugInfo.rid, {
        durationMs: Date.now() - debugInfo.startTime,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

// ── Response piping ──

/**
 * Pipe a ReadableStream reader into a Node.js ServerResponse.
 */
async function pipeReaderToResponse(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  res: ServerResponse,
): Promise<void> {
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      if (!res.writableEnded) {
        res.write(value)
      }
    }
  } catch (error) {
    // Expected: client disconnect (ECONNRESET, ERR_STREAM_PREMATURE_CLOSE).
    // Log unexpected errors at debug level.
    const { code } = error as NodeJS.ErrnoException
    if (code !== 'ECONNRESET' && code !== 'ERR_STREAM_PREMATURE_CLOSE') {
      console.error('[proxy] pipeReaderToResponse error:', error)
    }
  } finally {
    if (!res.writableEnded) {
      res.end()
    }
  }
}

// ── Main entry point ──

/**
 * Handle a single `/v1/chat/completions` request through its full lifecycle.
 */
export async function handleChatCompletion(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: ProxyContext,
): Promise<void> {
  const { convConfig } = ctx
  const accessToken = ctx.getAccessToken()
  if (!accessToken) {
    errorResponse(res, 401, 'No access token configured')
    return
  }

  let body: unknown
  try {
    body = JSON.parse(await readBody(req))
  } catch {
    errorResponse(res, 400, 'Invalid JSON body')
    return
  }

  if (!isChatCompletionRequest(body)) {
    errorResponse(res, 400, 'Invalid chat completion request: model and messages required')
    return
  }

  const { model: requestedModelId, messages, stream = true, tools = [], tool_choice } = body

  const { baseModelId, longContext } = parseContextTierSuffix(requestedModelId)

  // Resolve the final Cursor model ID
  const cfg = ctx.config
  const bodyRecord = body as unknown as Record<string, unknown>
  let modelId: string
  {
    const modelSet = ctx.getNormalizedSet()
    const effort = typeof bodyRecord.reasoning_effort === 'string' ? bodyRecord.reasoning_effort : null
    modelId = resolveModelId(baseModelId, effort, cfg.fast, cfg.thinking, modelSet)
  }

  const sessionId =
    (req.headers['x-session-id'] as string | undefined) ??
    'default'
  const projectDir = req.headers['x-project-dir'] as string | undefined
  const requestId = debugRequestId()
  const requestStartTime = Date.now()

  logRequestStart(sessionId, requestId, {
    model: modelId,
    messageCount: messages.length,
    toolsCount: tools.length,
  })

  const { systemPrompt, turns, userText, toolResults } = parseMessages(messages)
  const selectedTools = selectToolsForChoice(tools, tool_choice)
  const mcpTools = buildMcpToolDefinitions(selectedTools)

  // ── Tool-result resume (session still alive) ──
  if (toolResults.length > 0) {
    const { bridge: existingSession } = resolveSession(sessionId, convConfig)
    if (existingSession?.alive) {
      logSessionResume(sessionId, requestId, { sessionKey: deriveBridgeKey(sessionId) })
      const newResults = toolResults.map((r) => ({
        toolCallId: r.toolCallId,
        content: r.content,
        isError: false,
      }))
      existingSession.sendToolResults(newResults)

      // Cancel on client disconnect during tool-result continuation
      req.on('close', () => {
        if (existingSession.alive) {
          existingSession.cancel()
        }
      })

      const toolLineageInfo: LineageInfo = { turns, userText }

      if (stream) {
        const completionId = `chatcmpl-${randomUUID().replaceAll('-', '').slice(0, 28)}`
        const created = Math.floor(Date.now() / 1000)
        const readableStream = new ReadableStream({
          start(controller) {
            const sseCtx = createSSECtx(controller, modelId, completionId, created)
            void pumpAndFinalize(existingSession, sseCtx, sessionId, convConfig, toolLineageInfo, {
              sid: sessionId,
              rid: requestId,
              startTime: requestStartTime,
            })
          },
        })
        res.writeHead(200, SSE_HEADERS)
        const reader = readableStream.getReader() as ReadableStreamDefaultReader<Uint8Array>
        void pipeReaderToResponse(reader, res)
      } else {
        const { response } = await collectNonStreamingResponse(existingSession, modelId)
        // Update lineage after successful tool-result turn completion
        if (response.ok) {
          const completedTurns = [...turns, { userText }]
          commitTurn(
            sessionId,
            {
              turnCount: completedTurns.length,
              fingerprint: computeLineageFingerprint(completedTurns),
            },
            convConfig,
          )
        }
        closeBridge(sessionId)
        logRequestEnd(sessionId, requestId, { durationMs: Date.now() - requestStartTime })
        res.writeHead(response.status, Object.fromEntries(response.headers.entries()))
        res.end(await response.text())
      }
      return
    }
    // Session is gone — fall through to fresh request
    closeBridge(sessionId)
  }

  // ── Fresh request ──
  const { conversation: stored, lineageInvalidated } = resolveSession(sessionId, convConfig, turns)
  logSessionCreate(sessionId, requestId, {
    sessionKey: deriveBridgeKey(sessionId),
    conversationKey: deriveConvKey(sessionId),
  })
  if (lineageInvalidated) {
    logLineageInvalidation(sessionId, requestId, {
      storedTurnCount: stored.lineageTurnCount,
      incomingTurnCount: turns.length,
      blobCount: stored.blobStore.size,
    })
  }

  const effectiveUserText = userText || (toolResults.length > 0 ? toolResults.map((r) => r.content).join('\n') : '')
  const payload = buildRunRequest(
    modelId,
    systemPrompt,
    effectiveUserText,
    turns,
    stored.conversationId,
    stored.checkpoint,
    stored.blobStore,
    mcpTools,
    cfg.nativeToolsMode,
    longContext,
    cfg.maxMode,
  )

  const allowedRoot = cfg.nativeToolsMode === 'native' && projectDir ? resolveAllowedRoot(projectDir) : undefined
  const sessionOptions: SessionOptions = {
    accessToken,
    requestBytes: payload.requestBytes,
    blobStore: payload.blobStore,
    mcpTools,
    cloudRule: systemPrompt || undefined,
    nativeToolsMode: cfg.nativeToolsMode,
    allowedRoot,
    convKey: sessionId,
    onCheckpoint: (checkpointBytes) => {
      stored.checkpoint = checkpointBytes
      // blobStore is a shared Map reference — SetBlob mutations from
      // handleKvMessage are already visible in stored.blobStore.
      // Prune oldest blobs if the store exceeds the size cap.
      pruneBlobs(stored.blobStore)
      persistConversation(sessionId, stored, convConfig)
      logCheckpointCommit(sessionId, requestId, { sizeBytes: checkpointBytes.length })
    },
  }

  const session = new CursorSession(sessionOptions)

  // Cancel the Cursor session on client disconnect — sends CancelAction protobuf
  // and preserves the previous committed checkpoint (no pending checkpoint commit)
  req.on('close', () => {
    if (session.alive) {
      session.cancel()
    }
  })

  const lineageInfo: LineageInfo = { turns, userText: effectiveUserText }

  if (stream) {
    const completionId = `chatcmpl-${randomUUID().replaceAll('-', '').slice(0, 28)}`
    const created = Math.floor(Date.now() / 1000)
    const readableStream = new ReadableStream({
      start(controller) {
        const sseCtx = createSSECtx(controller, modelId, completionId, created)
        void pumpAndFinalize(
          session,
          sseCtx,
          sessionId,
          convConfig,
          lineageInfo,
          {
            sid: sessionId,
            rid: requestId,
            startTime: requestStartTime,
          },
          {
            sessionOptions,
            req,
            maxRetries: cfg.maxRetries,
            rebuildWithoutCheckpoint: (s) =>
              buildRunRequest(
                modelId,
                systemPrompt,
                effectiveUserText,
                turns,
                s.conversationId,
                null,
                s.blobStore,
                mcpTools,
                cfg.nativeToolsMode,
                longContext,
                cfg.maxMode,
              ).requestBytes,
          },
        )
      },
    })
    res.writeHead(200, SSE_HEADERS)
    const reader = readableStream.getReader() as ReadableStreamDefaultReader<Uint8Array>
    void pipeReaderToResponse(reader, res)
  } else {
    // ── Non-streaming with retry ──
    let nonStreamAttempt = 0
    let currentNonStreamSession = session
    let currentNonStreamOptions = sessionOptions
    let result = await collectNonStreamingResponse(currentNonStreamSession, modelId)
    let nonStreamCloseHandler: (() => void) | null = null
    while (!result.response.ok && nonStreamAttempt < cfg.maxRetries) {
      nonStreamAttempt++
      const hint: RetryHint = result.retryHint ?? (result.response.status === 429 ? 'resource_exhausted' : 'timeout')
      const delayMs = retryDelayMs(hint)
      logRetry(sessionId, requestId, { attempt: nonStreamAttempt, hint, delayMs })
      console.error(
        `[proxy] Non-streaming retry ${nonStreamAttempt}/${cfg.maxRetries} (status ${result.response.status})`,
      )
      await sleep(delayMs)

      // On blob_not_found: reset conversation and rebuild request (mirrors streaming path)
      if (hint === 'blob_not_found') {
        resetConversation(stored)
        currentNonStreamOptions = {
          ...currentNonStreamOptions,
          requestBytes: buildRunRequest(
            modelId,
            systemPrompt,
            effectiveUserText,
            turns,
            stored.conversationId,
            null,
            stored.blobStore,
            mcpTools,
            cfg.nativeToolsMode,
            longContext,
            cfg.maxMode,
          ).requestBytes,
        }
        persistConversation(sessionId, stored, convConfig)
        console.error('[proxy] blob_not_found: rebuilt non-streaming request with new conversation ID for retry')
      }

      currentNonStreamSession = new CursorSession(currentNonStreamOptions)
      // Remove previous close handler to prevent listener accumulation
      if (nonStreamCloseHandler) {
        req.removeListener('close', nonStreamCloseHandler)
      }
      const sessionToCancel = currentNonStreamSession
      nonStreamCloseHandler = () => {
        if (sessionToCancel.alive) {
          sessionToCancel.cancel()
        }
      }
      req.on('close', nonStreamCloseHandler)
      result = await collectNonStreamingResponse(currentNonStreamSession, modelId)
    }
    const { response } = result
    // Update lineage after successful non-streaming turn completion
    if (response.ok) {
      const completedTurns = [...turns, { userText: effectiveUserText }]
      commitTurn(
        sessionId,
        {
          turnCount: completedTurns.length,
          fingerprint: computeLineageFingerprint(completedTurns),
        },
        convConfig,
      )
    } else {
      persistConversation(sessionId, stored, convConfig)
    }
    logRequestEnd(sessionId, requestId, { durationMs: Date.now() - requestStartTime })
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()))
    res.end(await response.text())
  }
}
