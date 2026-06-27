/**
 * OpenAI SSE stream writer — consumes SessionEvent from CursorSession
 * and produces OpenAI chat.completion.chunk SSE format.
 *
 * Also provides a non-streaming collector for `stream: false` requests.
 */
import type { CursorSession, RetryHint, SessionEvent } from './cursor-session'
import { createThinkingTagFilter } from './thinking-filter'

export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
} as const

const SSE_KEEPALIVE_MS = 15_000

/** Prevents a timer from keeping the process alive. */
function unrefTimer(timer: ReturnType<typeof setInterval>): void {
  if (typeof timer === 'object' && 'unref' in timer) {
    timer.unref()
  }
}

function generateCompletionId(): string {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 28)
}

export interface OpenAIUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface SSECtx {
  sendChunk(delta: Record<string, unknown>, finishReason?: string | null): void
  sendUsage(usage: OpenAIUsage): void
  sendDone(): void
  close(): void
  readonly closed: boolean
}

export type PumpResult =
  | { outcome: 'done' }
  | { outcome: 'batchReady' }
  | { outcome: 'retry'; retryHint: RetryHint; error: string }

function sanitizeTokenCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0
}

function buildUsage(completionTokens: number, totalTokens: number): OpenAIUsage | null {
  const completion = sanitizeTokenCount(completionTokens)
  const reportedTotal = sanitizeTokenCount(totalTokens)
  if (completion === 0 && reportedTotal === 0) {
    return null
  }
  if (reportedTotal === 0) {
    return null
  }
  const total = Math.max(completion, reportedTotal)
  return {
    prompt_tokens: Math.max(0, total - completion),
    completion_tokens: completion,
    total_tokens: total,
  }
}

function pickBetterUsage(current: OpenAIUsage | null, candidate: OpenAIUsage | null): OpenAIUsage | null {
  if (!candidate) {
    return current
  }
  if (!current) {
    return candidate
  }
  if (candidate.total_tokens > current.total_tokens) {
    return candidate
  }
  if (candidate.total_tokens === current.total_tokens) {
    if (candidate.completion_tokens > current.completion_tokens) {
      return candidate
    }
    if (candidate.completion_tokens === current.completion_tokens && candidate.prompt_tokens > current.prompt_tokens) {
      return candidate
    }
  }
  return current
}

/**
 * Wraps a ReadableStreamDefaultController with helpers for emitting
 * OpenAI-format SSE chunks, keepalive pings, and clean shutdown.
 */
export function createSSECtx(
  controller: ReadableStreamDefaultController,
  modelId: string,
  completionId: string,
  created: number,
): SSECtx {
  const encoder = new TextEncoder()
  let closed = false

  const markClosed = (): boolean => {
    if (closed) {
      return false
    }
    closed = true
    clearInterval(keepaliveTimer)
    return true
  }

  const safeEnqueue = (bytes: Uint8Array): void => {
    if (closed) {
      return
    }
    try {
      controller.enqueue(bytes)
    } catch {
      markClosed() // stream aborted by client — stop all further writes
    }
  }

  const sendRaw = (data: object): void => {
    safeEnqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
  }

  // Note: `keepaliveTimer` is referenced in markClosed above;
  // JS hoists the `const` binding so `clearInterval(keepaliveTimer)` works
  // in closures (they capture the binding, not the value).
  const keepaliveTimer = setInterval(() => {
    safeEnqueue(encoder.encode(': keep-alive\n\n'))
  }, SSE_KEEPALIVE_MS)
  // Prevent keepalive from keeping the process alive.
  // In Node.js, setInterval returns a Timeout object with .unref().
  unrefTimer(keepaliveTimer)

  return {
    sendChunk(delta, finishReason = null) {
      sendRaw({
        id: completionId,
        object: 'chat.completion.chunk',
        created,
        model: modelId,
        choices: [{ index: 0, delta, finish_reason: finishReason }],
      })
    },

    sendUsage(usage) {
      sendRaw({
        id: completionId,
        object: 'chat.completion.chunk',
        created,
        model: modelId,
        choices: [],
        usage,
      })
    },

    sendDone() {
      if (!markClosed()) {
        return
      }
      try {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch {
        /* stream already aborted */
      }
    },

    // Idempotent teardown: always attempts controller.close() even if
    // sendDone already closed it, so finally-blocks can call unconditionally.
    close() {
      markClosed()
      try {
        controller.close()
      } catch {
        /* already closed or aborted */
      }
    },

    get closed() {
      return closed
    },
  }
}

/**
 * Drain events from a CursorSession and write them as SSE chunks.
 *
 * Returns when the session emits `batchReady` (tool_calls pause) or `done`.
 * Also returns early with `'done'` if the SSE context is already closed
 * (e.g. client disconnect). For retryable errors, returns `'retry'` without
 * writing stop/DONE — the caller can create a new session and call
 * pumpSession again on the same ctx.
 */
export async function pumpSession(session: CursorSession, ctx: SSECtx): Promise<PumpResult> {
  const tagFilter = createThinkingTagFilter()
  let hasNativeThinking = false
  let toolCallIndex = 0
  let bestUsage: OpenAIUsage | null = null

  const sendUsageIfBetter = (completionTokens: number, totalTokens: number): void => {
    const nextUsage = pickBetterUsage(bestUsage, buildUsage(completionTokens, totalTokens))
    if (!nextUsage || nextUsage === bestUsage) {
      return
    }
    ctx.sendUsage(nextUsage)
    bestUsage = nextUsage
  }

  for (;;) {
    if (ctx.closed) {
      return { outcome: 'done' }
    }

    const event: SessionEvent = await session.next()

    switch (event.type) {
      case 'text': {
        if (event.isThinking) {
          hasNativeThinking = true
          ctx.sendChunk({ reasoning_content: event.text })
        } else if (hasNativeThinking) {
          // Once native thinking is detected, skip tag filter — the model
          // already separates thinking from content at the protocol level.
          ctx.sendChunk({ content: event.text })
        } else {
          // No native thinking detected: use XML tag filter as fallback.
          const { content, reasoning } = tagFilter.process(event.text)
          if (reasoning) {
            ctx.sendChunk({ reasoning_content: reasoning })
          }
          if (content) {
            ctx.sendChunk({ content })
          }
        }
        break
      }

      case 'toolCall': {
        // Flush any buffered thinking content before emitting tool calls
        const flushed = tagFilter.flush()
        if (flushed.reasoning) {
          ctx.sendChunk({ reasoning_content: flushed.reasoning })
        }
        if (flushed.content) {
          ctx.sendChunk({ content: flushed.content })
        }

        ctx.sendChunk({
          tool_calls: [
            {
              index: toolCallIndex++,
              id: event.exec.toolCallId,
              type: 'function',
              function: {
                name: event.exec.toolName,
                arguments: event.exec.decodedArgs,
              },
            },
          ],
        })
        break
      }

      case 'batchReady': {
        const flushed = tagFilter.flush()
        if (flushed.reasoning) {
          ctx.sendChunk({ reasoning_content: flushed.reasoning })
        }
        if (flushed.content) {
          ctx.sendChunk({ content: flushed.content })
        }
        ctx.sendChunk({}, 'tool_calls')
        ctx.sendDone()
        return { outcome: 'batchReady' }
      }

      case 'usage': {
        sendUsageIfBetter(event.outputTokens, event.totalTokens)
        break
      }

      case 'done': {
        // Retryable errors: don't write stop/DONE so the caller can retry.
        if (event.retryHint) {
          return { outcome: 'retry', retryHint: event.retryHint, error: event.error ?? 'retryable error' }
        }

        // Flush any remaining buffered thinking content
        const flushed = tagFilter.flush()
        if (flushed.reasoning) {
          ctx.sendChunk({ reasoning_content: flushed.reasoning })
        }
        if (flushed.content) {
          ctx.sendChunk({ content: flushed.content })
        }

        // If there was an error, surface it as inline text so the user sees it
        if (event.error) {
          ctx.sendChunk({ content: `\n[Error: ${event.error}]` })
        }

        ctx.sendChunk({}, 'stop')
        ctx.sendDone()
        return { outcome: 'done' }
      }
    }
  }
}

function nonStreamingErrorResponse(message: string, code = 'non_streaming_error'): Response {
  return new Response(
    JSON.stringify({
      error: {
        message,
        type: 'server_error',
        code,
      },
    }),
    {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

/**
 * Collect all events from a CursorSession and return a complete
 * non-streaming chat.completion response (for `stream: false` requests).
 */
export interface NonStreamingResult {
  response: Response
  retryHint?: RetryHint
}

export async function collectNonStreamingResponse(
  session: CursorSession,
  modelId: string,
): Promise<NonStreamingResult> {
  const tagFilter = createThinkingTagFilter()
  let text = ''
  let usage: OpenAIUsage | null = null

  const finalizeSession = (): void => {
    session.close()
  }

  for (;;) {
    const event: SessionEvent = await session.next()

    if (event.type === 'text' && !event.isThinking) {
      const { content } = tagFilter.process(event.text)
      text += content
    } else if (event.type === 'usage') {
      usage = pickBetterUsage(usage, buildUsage(event.outputTokens, event.totalTokens))
    } else if (event.type === 'toolCall' || event.type === 'batchReady') {
      finalizeSession()
      return {
        response: nonStreamingErrorResponse(
          'Unexpected tool activity while collecting a non-streaming response',
          'unexpected_tool_activity',
        ),
      }
    } else if (event.type === 'done') {
      if (event.retryHint || event.error) {
        finalizeSession()
        return {
          response: nonStreamingErrorResponse(
            event.error ?? 'Cursor session ended before a non-streaming response was complete',
          ),
          retryHint: event.retryHint,
        }
      }
      text += tagFilter.flush().content
      break
    }
  }

  finalizeSession()

  return {
    response: new Response(
      JSON.stringify({
        id: `chatcmpl-${generateCompletionId()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: modelId,
        choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
        ...(usage ? { usage } : {}),
      }),
      { headers: { 'Content-Type': 'application/json' } },
    ),
  }
}
