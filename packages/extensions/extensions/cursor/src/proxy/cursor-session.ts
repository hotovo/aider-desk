/**
 * CursorSession — H2 connection to Cursor's gRPC AgentService with batch
 * state machine, heartbeat keep-alive, and tool result routing.
 *
 * Also exports `callCursorUnaryRpc` for non-streaming RPCs (model discovery).
 */
import { randomUUID } from 'node:crypto'
import { type ClientHttp2Session, type ClientHttp2Stream, connect as h2Connect } from 'node:http2'

import { create, fromBinary, toBinary } from '@bufbuild/protobuf'

import {
  AgentClientMessageSchema,
  AgentServerMessageSchema,
  CancelActionSchema,
  ClientHeartbeatSchema,
  ConversationActionSchema,
  DeleteResultSchema,
  DeleteSuccessSchema,
  ExecClientControlMessageSchema,
  ExecClientMessageSchema,
  ExecClientStreamCloseSchema,
  FetchResultSchema,
  FetchSuccessSchema,
  McpResultSchema,
  McpSuccessSchema,
  McpTextContentSchema,
  McpToolResultContentItemSchema,
  type McpToolDefinition,
  ReadResultSchema,
  ReadSuccessSchema,
  ShellResultSchema,
  ShellSuccessSchema,
  WriteResultSchema,
  WriteSuccessSchema,
} from '../proto/agent_pb'
import type { NativeToolsMode } from './config'
import {
  createConnectFrameParser,
  decodeConnectUnaryBody,
  frameConnectMessage,
  parseConnectEndStream,
} from './connect-protocol'
import { type StreamState, createStreamState, processServerMessage } from './cursor-messages'
import { EventQueue } from './event-queue'
import { buildEnabledToolSet } from './native-tools'
import type { PendingExec } from './tool-dispatch'

const CURSOR_API_URL = 'https://api2.cursor.sh'
const CURSOR_CLIENT_VERSION = 'cli-2026.01.09-231024f'
const HEARTBEAT_INTERVAL_MS = 30_000
const INACTIVITY_THINKING_MS = 120_000
const INACTIVITY_STREAMING_MS = 60_000
const INACTIVITY_FLUSHED_MS = 10 * 60_000

const CLOSE_OK = 0
const CLOSE_ERR = 1

export type RetryHint = 'blob_not_found' | 'resource_exhausted' | 'timeout'

export type SessionEvent =
  | { type: 'text'; text: string; isThinking: boolean }
  | { type: 'toolCall'; exec: PendingExec }
  | { type: 'batchReady' }
  | { type: 'usage'; outputTokens: number; totalTokens: number }
  | { type: 'done'; error?: string; retryHint?: RetryHint }

export interface SessionOptions {
  accessToken: string
  requestBytes: Uint8Array
  blobStore: Map<string, Uint8Array>
  mcpTools: McpToolDefinition[]
  cloudRule?: string
  nativeToolsMode: NativeToolsMode
  allowedRoot?: string
  convKey: string
  onCheckpoint?: (bytes: Uint8Array) => void
}

function classifyConnectError(errorMessage: string): RetryHint | undefined {
  if (/blob not found/i.test(errorMessage)) {
    return 'blob_not_found'
  }
  if (/resource_exhausted/i.test(errorMessage)) {
    return 'resource_exhausted'
  }
  return undefined
}

function makeHeartbeatFrame(): Buffer {
  const heartbeat = create(AgentClientMessageSchema, {
    message: {
      case: 'clientHeartbeat',
      value: create(ClientHeartbeatSchema, {}),
    },
  })
  return frameConnectMessage(toBinary(AgentClientMessageSchema, heartbeat))
}

/** Polyfill for Promise.withResolvers (ES2024). */
function newPromiseWithResolvers<T>(): {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
} {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function generateTraceparent(): string {
  const traceId = randomUUID().replaceAll('-', '')
  const spanId = randomUUID().replaceAll('-', '').slice(0, 16)
  return `00-${traceId}-${spanId}-01`
}

/**
 * Send an MCP result (success with text content) back to Cursor for the given exec.
 */
function sendMcpResultFrame(
  write: (data: Uint8Array) => void,
  exec: PendingExec,
  content: string,
  isError = false,
): void {
  const mcpResult = create(McpResultSchema, {
    result: {
      case: 'success',
      value: create(McpSuccessSchema, {
        content: [
          create(McpToolResultContentItemSchema, {
            content: {
              case: 'text',
              value: create(McpTextContentSchema, { text: content }),
            },
          }),
        ],
        isError,
      }),
    },
  })
  const execClientMessage = create(ExecClientMessageSchema, {
    id: exec.execMsgId,
    execId: exec.execId,
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- protobuf discriminated union requires dynamic case
    message: { case: 'mcpResult' as const, value: mcpResult as never },
  })
  write(
    frameConnectMessage(
      toBinary(
        AgentClientMessageSchema,
        create(AgentClientMessageSchema, {
          message: { case: 'execClientMessage', value: execClientMessage },
        }),
      ),
    ),
  )
  sendExecStreamClose(write, exec.execMsgId)
}

/**
 * Send a native result (read/write/delete/shell/grep/fetch) back to Cursor.
 */
function sendNativeResultFrame(write: (data: Uint8Array) => void, exec: PendingExec, content: string): void {
  const { nativeResultType } = exec
  const args = exec.nativeArgs ?? {}

  let resultValue: unknown
  let resultCase: string

  // oxlint-disable-next-line typescript/switch-exhaustiveness-check -- default branch handles undefined and unknown types
  switch (nativeResultType) {
    case 'readResult': {
      const lines = content.split('\n')
      resultValue = create(ReadResultSchema, {
        result: {
          case: 'success',
          value: create(ReadSuccessSchema, {
            path: args.path || '',
            totalLines: lines.length,
            fileSize: BigInt(new TextEncoder().encode(content).byteLength),
            truncated: false,
            output: { case: 'content', value: content },
          }),
        },
      })
      resultCase = 'readResult'
      break
    }
    case 'writeResult': {
      const bytes = new TextEncoder().encode(content)
      resultValue = create(WriteResultSchema, {
        result: {
          case: 'success',
          value: create(WriteSuccessSchema, {
            path: args.path || '',
            linesCreated: content.split('\n').length,
            fileSize: bytes.byteLength,
          }),
        },
      })
      resultCase = 'writeResult'
      break
    }
    case 'deleteResult': {
      resultValue = create(DeleteResultSchema, {
        result: {
          case: 'success',
          value: create(DeleteSuccessSchema, { path: args.path || '' }),
        },
      })
      resultCase = 'deleteResult'
      break
    }
    case 'shellResult':
    case 'shellStreamResult': {
      resultValue = create(ShellResultSchema, {
        result: {
          case: 'success',
          value: create(ShellSuccessSchema, {
            stdout: content,
            exitCode: 0,
          }),
        },
      })
      resultCase = 'shellResult'
      break
    }
    case 'fetchResult': {
      resultValue = create(FetchResultSchema, {
        result: {
          case: 'success',
          value: create(FetchSuccessSchema, {
            url: args.url || '',
            content,
            statusCode: 200,
          }),
        },
      })
      resultCase = 'fetchResult'
      break
    }
    case 'grepResult':
    case 'lsResult':
    default: {
      // For grep/ls/unknown native types, fall back to MCP text result
      sendMcpResultFrame(write, exec, content)
      return
    }
  }

  const execClientMessage = create(ExecClientMessageSchema, {
    id: exec.execMsgId,
    execId: exec.execId,
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- protobuf discriminated union requires dynamic case
    message: { case: resultCase as 'mcpResult', value: resultValue as never },
  })
  write(
    frameConnectMessage(
      toBinary(
        AgentClientMessageSchema,
        create(AgentClientMessageSchema, {
          message: { case: 'execClientMessage', value: execClientMessage },
        }),
      ),
    ),
  )
  sendExecStreamClose(write, exec.execMsgId)
}

function sendExecStreamClose(write: (data: Uint8Array) => void, execMsgId: number): void {
  const controlMsg = create(ExecClientControlMessageSchema, {
    message: {
      case: 'streamClose',
      value: create(ExecClientStreamCloseSchema, { id: execMsgId }),
    },
  })
  write(
    frameConnectMessage(
      toBinary(
        AgentClientMessageSchema,
        create(AgentClientMessageSchema, {
          message: { case: 'execClientControlMessage', value: controlMsg },
        }),
      ),
    ),
  )
}

export class CursorSession {
  private readonly queue: EventQueue<SessionEvent>
  private readonly streamState: StreamState
  private readonly options: SessionOptions
  private readonly blobStore: Map<string, Uint8Array>
  /**
   * Tool set computed once at session construction from mcpTools.
   * Invariant: mcpTools is immutable for the lifetime of a session.
   * If Pi ever supports mid-session tool changes, this must be recomputed.
   */
  private readonly enabledToolNames: Set<string>

  private batchState: 'streaming' | 'collecting' | 'flushed' = 'streaming'
  private pendingExecs: PendingExec[] = []
  private _flushedExecs: PendingExec[] = []
  private _alive = true
  private doneEventSent = false

  private h2Session!: ClientHttp2Session
  private h2Stream!: ClientHttp2Stream
  private heartbeatTimer!: ReturnType<typeof setInterval>
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null
  private timerPhase: 'thinking' | 'streaming' = 'thinking'

  /** Ordinal incremented per H2 `data` event — detect same-chunk checkpoint+exec. */
  private _chunkSeq = 0
  private _checkpointChunkSeq = -1
  private _batchHasCheckpoint = false

  constructor(options: SessionOptions) {
    this.queue = new EventQueue<SessionEvent>({
      onOverflow: () => {
        this.pushDone({ type: 'done', error: 'Event queue overflow — stream corrupted' })
        this.close()
      },
    })
    this.options = options
    this.blobStore = options.blobStore
    this.enabledToolNames = buildEnabledToolSet(options.mcpTools)
    this.streamState = createStreamState()

    this.startH2Connection()
  }

  // ── Public API ──

  get alive(): boolean {
    return this._alive
  }

  next(): Promise<SessionEvent> {
    return this.queue.next()
  }

  /**
   * Send tool results back to Cursor for the pending execs.
   * After results are sent, the session resumes streaming.
   */
  // fallow-ignore-next-line unused-class-member
  sendToolResults(results: { toolCallId: string; content: string; isError?: boolean }[]): void {
    const remaining: PendingExec[] = []

    for (const exec of this.pendingExecs) {
      if (!this._alive) {
        remaining.push(exec)
        continue
      }

      const match = results.find((r) => r.toolCallId === exec.toolCallId)
      if (match) {
        if (exec.nativeResultType) {
          sendNativeResultFrame((data) => this.write(data), exec, match.content)
        } else {
          sendMcpResultFrame((data) => this.write(data), exec, match.content, match.isError ?? false)
        }
      } else {
        remaining.push(exec)
      }
    }

    this.pendingExecs.length = 0
    this.pendingExecs.push(...remaining)

    // If there are still unmatched execs, re-flush them
    if (remaining.length > 0) {
      for (const exec of remaining) {
        this.queue.push({ type: 'toolCall', exec })
      }
      this.batchState = 'flushed'
      this._flushedExecs = [...remaining]
      this.queue.push({ type: 'batchReady' })
    } else {
      this.batchState = 'streaming'
      this._flushedExecs = []
      this._batchHasCheckpoint = false
      this.resetInactivityTimer()
    }
  }

  close(): void {
    if (this._alive) {
      this._alive = false
      if (!this.doneEventSent) {
        this.doneEventSent = true
        this.queue.pushForce({ type: 'done', error: 'session closed' })
      }
      clearInterval(this.heartbeatTimer)
      this.clearInactivityTimer()
      this.closeTransport()
    }
  }

  /**
   * Send CancelAction protobuf to Cursor and close the session.
   * Does NOT commit the pending checkpoint — preserves the previous committed checkpoint.
   */
  cancel(): void {
    if (!this._alive) {
      return
    }
    try {
      const cancelAction = create(ConversationActionSchema, {
        action: { case: 'cancelAction', value: create(CancelActionSchema, {}) },
      })
      const cancelMsg = create(AgentClientMessageSchema, {
        message: { case: 'conversationAction', value: cancelAction },
      })
      this.h2Stream.write(frameConnectMessage(toBinary(AgentClientMessageSchema, cancelMsg)))
    } catch {
      // Best-effort cancel — transport may already be closed
    }
    // Suppress the onCheckpoint callback so no pending checkpoint is committed
    this.options.onCheckpoint = undefined
    this.close()
  }

  // ── H2 connection setup ──

  private startH2Connection(): void {
    const requestId = randomUUID()
    const traceparent = generateTraceparent()

    this.h2Session = h2Connect(CURSOR_API_URL)

    this.h2Session.on('error', (error: Error) => {
      console.error('[cursor-session] H2 session error:', error.message)
      this.closeTransport()
      this.finish(CLOSE_ERR)
    })

    const headers: Record<string, string> = {
      ':method': 'POST',
      ':path': '/agent.v1.AgentService/Run',
      'content-type': 'application/connect+proto',
      'user-agent': 'connect-es/1.6.1',
      authorization: `Bearer ${this.options.accessToken}`,
      'x-ghost-mode': 'true',
      'x-cursor-client-version': CURSOR_CLIENT_VERSION,
      'x-cursor-client-type': 'cli',
      'x-request-id': requestId,
      'x-original-request-id': requestId,
      traceparent,
      'backend-traceparent': traceparent,
      'connect-protocol-version': '1',
    }

    this.h2Stream = this.h2Session.request(headers)

    // Send the initial request frame
    this.write(frameConnectMessage(this.options.requestBytes))

    // Set up frame parser
    const frameParser = createConnectFrameParser(
      (bytes) => this.handleMessage(bytes),
      (bytes) => this.handleEndStream(bytes),
    )

    this.h2Stream.on('data', (chunk: Buffer | Uint8Array) => {
      this._chunkSeq++
      frameParser(Buffer.from(chunk))
      this.afterParse()
    })

    this.h2Stream.on('end', () => {
      this.closeTransport()
      this.finish(CLOSE_OK)
    })

    this.h2Stream.on('error', (error: Error) => {
      console.error('[cursor-session] H2 stream error:', error.message)
      this.closeTransport()
      this.finish(CLOSE_ERR)
    })

    // Start heartbeat timer
    this.heartbeatTimer = setInterval(() => {
      if (this._alive) {
        this.write(makeHeartbeatFrame())
      }
    }, HEARTBEAT_INTERVAL_MS)
    if (typeof this.heartbeatTimer === 'object' && 'unref' in this.heartbeatTimer) {
      this.heartbeatTimer.unref()
    }

    // Start inactivity timer
    this.resetInactivityTimer()
  }

  // ── Message handling ──

  private handleMessage(messageBytes: Uint8Array): void {
    try {
      const msg = fromBinary(AgentServerMessageSchema, messageBytes)
      const sendFrame = (data: Buffer) => this.write(data)
      const recognized = processServerMessage(msg, {
        blobStore: this.blobStore,
        sendFrame,
        state: this.streamState,
        onText: (text, isThinking) => {
          if (this.timerPhase === 'thinking') {
            this.timerPhase = 'streaming'
          }
          this.queue.push({ type: 'text', text, isThinking })
        },
        onCheckpoint: (checkpointBytes) => {
          this._checkpointChunkSeq = this._chunkSeq
          this.streamState.checkpointAfterExec = true
          this.options.onCheckpoint?.(checkpointBytes)
        },
        onNotify: (note) => {
          this.queue.push({ type: 'text', text: `\n${note}\n`, isThinking: false })
        },
        toolDispatch: {
          sendFrame,
          mcpTools: this.options.mcpTools,
          enabledToolNames: this.enabledToolNames,
          cloudRule: this.options.cloudRule,
          nativeToolsMode: this.options.nativeToolsMode,
          allowedRoot: this.options.allowedRoot,
          onMcpExec: (exec) => {
            this.pendingExecs.push(exec)
            if (this.batchState === 'streaming') {
              this.batchState = 'collecting'
            }
            this.queue.push({ type: 'toolCall', exec })
          },
          state: this.streamState,
        },
      })

      // Emit usage if we have token counts
      if (recognized && (this.streamState.outputTokens > 0 || this.streamState.totalTokens > 0)) {
        this.queue.push({
          type: 'usage',
          outputTokens: this.streamState.outputTokens,
          totalTokens: this.streamState.totalTokens,
        })
      }

      if (recognized) {
        this.resetInactivityTimer()
      }
    } catch (error) {
      console.error('[cursor-session] processServerMessage failed:', error)
      this.pushDone({ type: 'done', error: 'Failed to process server message' })
      this.close()
    }
  }

  private handleEndStream(endStreamBytes: Uint8Array): void {
    this.streamState.endStreamSeen = true
    const err = parseConnectEndStream(endStreamBytes)
    if (err) {
      const hint = classifyConnectError(err.message)
      this.pushDone({ type: 'done', error: err.message, retryHint: hint })
      this.finish(CLOSE_ERR)
      return
    }
    // If we have pending execs in collecting state, trigger flush
    if (this.pendingExecs.length > 0 && this.batchState === 'collecting') {
      this.streamState.checkpointAfterExec = true
    }
  }

  // ── Batch state machine ──

  /**
   * Called after each H2 data event to check if batch should be flushed
   * or if the stream is done.
   */
  private afterParse(): void {
    // Flush when: collecting with pending execs, no prior batch awaiting results,
    // and either (a) checkpoint arrived cross-chunk or (b) checkpoint in same H2 data event.
    if (
      this.batchState === 'collecting' &&
      this.pendingExecs.length > 0 &&
      this._flushedExecs.length === 0 &&
      (this.streamState.checkpointAfterExec || this._checkpointChunkSeq === this._chunkSeq)
    ) {
      this._batchHasCheckpoint = true
      this.flushBatch()
    }

    // Emit done if endStream arrived and we're not in collecting state
    if (
      this.streamState.endStreamSeen &&
      this.batchState !== 'collecting' &&
      !this.doneEventSent &&
      this.pendingExecs.length === 0
    ) {
      this.pushDone({ type: 'done' })
    }
  }

  private flushBatch(): void {
    if (!this._batchHasCheckpoint) {
      console.error('[cursor-session] flushing tool calls without a persisted checkpoint — recovery may fail', {
        pendingExecs: this.pendingExecs.length,
        convKey: this.options.convKey,
      })
    }

    this.batchState = 'flushed'
    this.streamState.checkpointAfterExec = false
    this._flushedExecs = [...this.pendingExecs]
    this.clearInactivityTimer()
    this.queue.push({ type: 'batchReady' })
  }

  // ── Transport ──

  write(data: Uint8Array): void {
    if (!this._alive) {
      return
    }
    try {
      this.h2Stream.write(data)
    } catch (error) {
      console.error('[cursor-session] write failed:', error)
      this.closeTransport()
      this.finish(CLOSE_ERR)
    }
  }

  private closeTransport(): void {
    try {
      this.h2Stream.close()
    } catch {
      /* ignore */
    }
    try {
      this.h2Session.close()
    } catch {
      /* ignore */
    }
  }

  // ── Lifecycle ──

  private finish(code: number): void {
    const sawEndStream = this.streamState.endStreamSeen
    if (this._alive) {
      this._alive = false
      clearInterval(this.heartbeatTimer)
      this.clearInactivityTimer()
      this.closeTransport()
    }
    if (!this.doneEventSent) {
      if (this.pendingExecs.length > 0) {
        this.pushDone({ type: 'done', error: 'session closed with pending tool calls' })
      } else if (code !== CLOSE_OK || !sawEndStream) {
        this.pushDone({ type: 'done', error: 'bridge connection lost' })
      } else {
        this.pushDone({ type: 'done' })
      }
    }
  }

  private pushDone(event: SessionEvent & { type: 'done' }): void {
    if (this.doneEventSent) {
      return
    }
    this.doneEventSent = true
    this.queue.pushForce(event)
  }

  // ── Inactivity timer ──

  private resetInactivityTimer(): void {
    this.clearInactivityTimer()

    let timeout: number
    if (this.batchState === 'flushed') {
      timeout = INACTIVITY_FLUSHED_MS
    } else if (this.timerPhase === 'thinking') {
      timeout = INACTIVITY_THINKING_MS
    } else {
      timeout = INACTIVITY_STREAMING_MS
    }

    this.inactivityTimer = setTimeout(() => {
      console.error('[cursor-session] inactivity timeout', {
        phase: this.timerPhase,
        batchState: this.batchState,
        convKey: this.options.convKey,
      })
      this.pushDone({ type: 'done', error: 'inactivity timeout', retryHint: 'timeout' })
      this.close()
    }, timeout)

    if (typeof this.inactivityTimer === 'object' && 'unref' in this.inactivityTimer) {
      this.inactivityTimer.unref()
    }
  }

  private clearInactivityTimer(): void {
    if (this.inactivityTimer !== null) {
      clearTimeout(this.inactivityTimer)
      this.inactivityTimer = null
    }
  }
}

export interface CursorUnaryRpcOptions {
  rpcPath: string
  requestBody: Uint8Array
  accessToken: string
}

/**
 * Make a unary (non-streaming) H2 RPC to Cursor.
 * Used for model discovery (`AvailableModels`).
 */
export async function callCursorUnaryRpc(options: CursorUnaryRpcOptions): Promise<Uint8Array> {
  const requestId = randomUUID()
  const { promise, resolve, reject } = newPromiseWithResolvers<Uint8Array>()

  let settled = false
  const timeoutMs = 15_000

  const timeout = setTimeout(() => {
    if (!settled) {
      settled = true
      try {
        session.close()
      } catch {
        /* ignore */
      }
      reject(new Error('Cursor unary RPC timed out'))
    }
  }, timeoutMs)
  if (typeof timeout === 'object' && 'unref' in timeout) {
    timeout.unref()
  }

  const session = h2Connect(CURSOR_API_URL)

  session.on('error', (err) => {
    if (!settled) {
      settled = true
      clearTimeout(timeout)
      reject(new Error(`H2 session error: ${err instanceof Error ? err.message : String(err)}`))
    }
  })

  const headers: Record<string, string> = {
    ':method': 'POST',
    ':path': options.rpcPath,
    'content-type': 'application/proto',
    'user-agent': 'connect-es/1.6.1',
    authorization: `Bearer ${options.accessToken}`,
    'x-ghost-mode': 'true',
    'x-cursor-client-version': CURSOR_CLIENT_VERSION,
    'x-cursor-client-type': 'cli',
    'x-request-id': requestId,
    'connect-protocol-version': '1',
  }

  const stream = session.request(headers)
  const chunks: Buffer[] = []

  stream.on('data', (chunk: Buffer) => {
    chunks.push(Buffer.from(chunk))
  })

  stream.on('end', () => {
    if (settled) {
      return
    }
    settled = true
    clearTimeout(timeout)
    try {
      session.close()
    } catch {
      /* ignore */
    }

    const fullBody = Buffer.concat(chunks)
    // For unary RPC the response might be raw proto or Connect-framed
    const payload = decodeConnectUnaryBody(fullBody)
    resolve(payload ?? fullBody)
  })

  stream.on('error', (err) => {
    if (!settled) {
      settled = true
      clearTimeout(timeout)
      try {
        session.close()
      } catch {
        /* ignore */
      }
      reject(new Error(`H2 stream error: ${err instanceof Error ? err.message : String(err)}`))
    }
  })

  if (options.requestBody.length > 0) {
    stream.end(Buffer.from(options.requestBody))
  } else {
    stream.end()
  }

  return promise
}
