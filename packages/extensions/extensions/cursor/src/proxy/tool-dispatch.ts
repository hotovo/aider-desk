/**
 * Tool Dispatch — routes Cursor exec messages, interaction queries, and
 * exec control messages to the appropriate handler.
 *
 * Owns three server message cases:
 * 1. execServerMessage — classify → reject/redirect/execute via native-tools
 * 2. interactionQuery — web search, exa, ask question (all rejected)
 * 3. execServerControlMessage — abort handling
 *
 * This module wraps native-tools.ts for execution without modifying its interface.
 */
/* oxlint-disable typescript/no-explicit-any, typescript/no-unsafe-member-access, typescript/no-unsafe-assignment, typescript/no-unsafe-argument */
import { create, fromBinary, toBinary, toJson } from '@bufbuild/protobuf'
import { ValueSchema } from '@bufbuild/protobuf/wkt'

import {
  AgentClientMessageSchema,
  type AgentServerMessage,
  AskQuestionInteractionResponseSchema,
  AskQuestionRejectedSchema,
  AskQuestionResultSchema,
  BackgroundShellSpawnResultSchema,
  CreatePlanRequestResponseSchema,
  DiagnosticsResultSchema,
  ExaFetchRequestResponse_RejectedSchema,
  ExaFetchRequestResponseSchema,
  ExaSearchRequestResponse_RejectedSchema,
  ExaSearchRequestResponseSchema,
  ExecClientControlMessageSchema,
  ExecClientMessageSchema,
  ExecClientStreamCloseSchema,
  type ExecServerMessage,
  type InteractionQuery,
  InteractionResponseSchema,
  type McpToolDefinition,
  McpResultSchema,
  McpSuccessSchema,
  McpTextContentSchema,
  McpToolResultContentItemSchema,
  RequestContextResultSchema,
  RequestContextSuccessSchema,
  ShellRejectedSchema,
  ShellResultSchema,
  SwitchModeRequestResponseSchema,
  WebSearchRequestResponse_RejectedSchema,
  WebSearchRequestResponseSchema,
  WriteShellStdinErrorSchema,
  WriteShellStdinResultSchema,
} from '../proto/agent_pb'
import type { NativeToolsMode } from './config'
import { frameConnectMessage } from './connect-protocol'
import { classifyExecMessage, executeNativeLocally, fixMcpArgNames, stripMcpToolPrefix } from './native-tools'
import { buildRequestContext } from './request-context'

// ── Types ──

type NativeResultType =
  | 'readResult'
  | 'writeResult'
  | 'deleteResult'
  | 'fetchResult'
  | 'shellResult'
  | 'shellStreamResult'
  | 'lsResult'
  | 'grepResult'

export interface PendingExec {
  execId: string
  execMsgId: number
  toolCallId: string
  toolName: string
  /** Decoded arguments JSON string for SSE tool_calls emission. */
  decodedArgs: string
  /** Set when this exec originated from a native Cursor tool redirected to MCP. */
  nativeResultType?: NativeResultType
  /** Original native args needed for result construction (e.g., path, url). */
  nativeArgs?: Record<string, string>
}

/** Minimal state interface — satisfied by StreamState in cursor-messages. */
interface ToolDispatchState {
  totalExecCount: number
}

export interface ToolDispatchContext {
  sendFrame: (data: Buffer) => void
  mcpTools: McpToolDefinition[]
  enabledToolNames: Set<string>
  cloudRule: string | undefined
  nativeToolsMode: NativeToolsMode
  allowedRoot?: string
  onMcpExec: (exec: PendingExec) => void
  state?: ToolDispatchState
}

// ── Private helpers ──

function decodeMcpArgValue(value: Uint8Array): unknown {
  try {
    const parsed = fromBinary(ValueSchema, value)
    return toJson(ValueSchema, parsed)
  } catch {
    // Fallback to text decoding
  }
  return new TextDecoder().decode(value)
}

function decodeMcpArgsMap(args: Record<string, Uint8Array>): Record<string, unknown> {
  const decoded: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(args)) {
    decoded[key] = decodeMcpArgValue(value)
  }
  return decoded
}

interface NativeRedirectInfo {
  toolCallId: string
  toolName: string
  decodedArgs: string
  nativeResultType: NativeResultType
  nativeArgs: Record<string, string>
}

function nativeToMcpRedirect(execMsg: ExecServerMessage): NativeRedirectInfo | null {
  const msg = execMsg.message

  if (msg.case === 'readArgs') {
    const args = msg.value
    const mcpArgs: Record<string, unknown> = { path: args.path }
    if (args.offset !== undefined && args.offset !== 0) {
      mcpArgs.offset = args.offset
    }
    if (args.limit !== undefined && args.limit !== 0) {
      mcpArgs.limit = args.limit
    }
    return {
      toolCallId: args.toolCallId || crypto.randomUUID(),
      toolName: 'read',
      decodedArgs: JSON.stringify(mcpArgs),
      nativeResultType: 'readResult',
      nativeArgs: { path: args.path },
    }
  }

  if (msg.case === 'writeArgs') {
    const args = msg.value
    // fileBytes is present in the proto but not in the generated TS type
    const fileContent =
      (args as any).fileBytes?.length > 0 ? new TextDecoder().decode((args as any).fileBytes) : args.fileText
    return {
      toolCallId: args.toolCallId || crypto.randomUUID(),
      toolName: 'write',
      decodedArgs: JSON.stringify({ path: args.path, content: fileContent }),
      nativeResultType: 'writeResult',
      nativeArgs: { path: args.path },
    }
  }

  if (msg.case === 'deleteArgs') {
    const args = msg.value
    if (!args.path) {
      return {
        toolCallId: args.toolCallId || crypto.randomUUID(),
        toolName: 'bash',
        decodedArgs: JSON.stringify({ command: 'true' }),
        nativeResultType: 'deleteResult',
        nativeArgs: { path: '' },
      }
    }
    const safePath = args.path.replaceAll('\0', '').replaceAll("'", "'\\''")
    return {
      toolCallId: args.toolCallId || crypto.randomUUID(),
      toolName: 'bash',
      decodedArgs: JSON.stringify({ command: `rm -f '${safePath}'` }),
      nativeResultType: 'deleteResult',
      nativeArgs: { path: args.path },
    }
  }

  if (msg.case === 'shellArgs' || msg.case === 'shellStreamArgs') {
    const args = msg.value
    const resultType: NativeResultType = msg.case === 'shellStreamArgs' ? 'shellStreamResult' : 'shellResult'
    return {
      toolCallId: args.toolCallId || crypto.randomUUID(),
      toolName: 'bash',
      decodedArgs: JSON.stringify({ command: args.command }),
      nativeResultType: resultType,
      nativeArgs: { command: args.command },
    }
  }

  if (msg.case === 'grepArgs') {
    const args = msg.value
    const path = args.path ?? '.'
    return {
      toolCallId: crypto.randomUUID(),
      toolName: 'grep',
      decodedArgs: JSON.stringify({ pattern: args.pattern, path }),
      nativeResultType: 'grepResult',
      nativeArgs: { pattern: args.pattern, path },
    }
  }

  if (msg.case === 'lsArgs') {
    const args = msg.value
    return {
      toolCallId: crypto.randomUUID(),
      toolName: 'ls',
      decodedArgs: JSON.stringify({ path: args.path }),
      nativeResultType: 'lsResult',
      nativeArgs: { path: args.path },
    }
  }

  if (msg.case === 'fetchArgs') {
    const args = msg.value
    const safeUrl = args.url.replaceAll('\0', '').replaceAll("'", "'\\''")
    return {
      toolCallId: args.toolCallId || crypto.randomUUID(),
      toolName: 'bash',
      decodedArgs: JSON.stringify({ command: `curl -sL '${safeUrl}'` }),
      nativeResultType: 'fetchResult',
      nativeArgs: { url: args.url },
    }
  }

  return null
}

// ── Send helpers ──

function sendExecResult(
  execMsg: ExecServerMessage,
  messageCase: string,
  value: unknown,
  sendFrame: (data: Buffer) => void,
): void {
  const execClientMessage = create(ExecClientMessageSchema, {
    id: execMsg.id,
    execId: execMsg.execId,
    message: { case: messageCase as any, value: value as any },
  })
  const clientMessage = create(AgentClientMessageSchema, {
    message: { case: 'execClientMessage', value: execClientMessage },
  })
  sendFrame(frameConnectMessage(toBinary(AgentClientMessageSchema, clientMessage)))
  sendExecStreamClose(execMsg.id, sendFrame)
}

function sendExecStreamClose(execId: number, sendFrame: (data: Buffer) => void): void {
  const controlMsg = create(ExecClientControlMessageSchema, {
    message: {
      case: 'streamClose',
      value: create(ExecClientStreamCloseSchema, { id: execId }),
    },
  })
  const clientMessage = create(AgentClientMessageSchema, {
    message: { case: 'execClientControlMessage', value: controlMsg },
  })
  sendFrame(frameConnectMessage(toBinary(AgentClientMessageSchema, clientMessage)))
}

function toolNotEnabledMessage(toolName: string): string {
  return `Tool '${toolName}' is not enabled in this session`
}

function sendMcpResult(
  execMsg: ExecServerMessage,
  content: string,
  sendFrame: (data: Buffer) => void,
  isError = false,
): void {
  const result = create(McpResultSchema, {
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
  sendExecResult(execMsg, 'mcpResult', result, sendFrame)
}

/**
 * Send a best-effort empty result for an exec type not in our proto schema.
 * Extracts the unknown oneof field number from $unknown and mirrors it back
 * as an empty message on the ExecClientMessage, preventing the server from
 * waiting indefinitely.
 */
function sendUnknownExecResult(execMsg: ExecServerMessage, sendFrame: (data: Buffer) => void): void {
  const unknowns: { no: number; wireType: number; data: Uint8Array }[] | undefined = (execMsg as any).$unknown
  const argsField = unknowns?.find((f) => f.wireType === 2 && f.no !== 1 && f.no !== 15 && f.no !== 19)
  if (!argsField) {
    console.error('[tool-dispatch] unhandled exec: no recoverable field number', {
      case: execMsg.message.case,
      id: execMsg.id,
    })
    // Send a bare stream-close so the server doesn't hang waiting for a response
    sendExecStreamClose(execMsg.id, sendFrame)
    return
  }
  const resultFieldNo = argsField.no
  console.warn('[tool-dispatch] rejected unknown exec type', {
    case: execMsg.message.case,
    field: resultFieldNo,
    id: execMsg.id,
  })
  const execClientMsg = create(ExecClientMessageSchema, {
    id: execMsg.id,
    execId: execMsg.execId,
  })
  ;(execClientMsg as any).$unknown = [{ no: resultFieldNo, wireType: 2, data: new Uint8Array(0) }]
  const clientMessage = create(AgentClientMessageSchema, {
    message: { case: 'execClientMessage', value: execClientMsg },
  })
  sendFrame(frameConnectMessage(toBinary(AgentClientMessageSchema, clientMessage)))
  sendExecStreamClose(execMsg.id, sendFrame)
}

// ── Exec dispatch ──

const REJECT_OVERLAPPING_REASON = 'Tool not available in this environment. Use the MCP tools provided instead.'

/** Reject an overlapping native tool exec with the appropriate result type. */
function rejectOverlappingExec(execMsg: ExecServerMessage, sendFrame: (data: Buffer) => void): void {
  const execCase = execMsg.message.case
  if (execCase === 'shellArgs' || execCase === 'shellStreamArgs') {
    const args = execMsg.message.value
    const result = create(ShellResultSchema, {
      result: {
        case: 'rejected',
        value: create(ShellRejectedSchema, {
          command: args.command || '',
          workingDirectory: args.workingDirectory || '',
          reason: REJECT_OVERLAPPING_REASON,
          isReadonly: false,
        }),
      },
    })
    sendExecResult(execMsg, 'shellResult', result, sendFrame)
    return
  }
  sendMcpResult(execMsg, REJECT_OVERLAPPING_REASON, sendFrame, true)
}

/** Dispatch a redirected native tool call to MCP, checking tool enablement first. */
function dispatchRedirect(
  execMsg: ExecServerMessage,
  redirect: NativeRedirectInfo,
  enabledToolNames: Set<string>,
  sendFrame: (data: Buffer) => void,
  onMcpExec: (exec: PendingExec) => void,
): void {
  const execCase = execMsg.message.case
  if (!enabledToolNames.has(redirect.toolName)) {
    const rejectReason = toolNotEnabledMessage(redirect.toolName)
    if (execCase === 'shellArgs' || execCase === 'shellStreamArgs') {
      const args = execMsg.message.value
      const result = create(ShellResultSchema, {
        result: {
          case: 'rejected',
          value: create(ShellRejectedSchema, {
            command: args.command || '',
            workingDirectory: args.workingDirectory || '',
            reason: rejectReason,
            isReadonly: false,
          }),
        },
      })
      sendExecResult(execMsg, 'shellResult', result, sendFrame)
      return
    }
    sendMcpResult(execMsg, rejectReason, sendFrame, true)
    return
  }

  onMcpExec({
    execId: execMsg.execId,
    execMsgId: execMsg.id,
    toolCallId: redirect.toolCallId,
    toolName: redirect.toolName,
    decodedArgs: redirect.decodedArgs,
    nativeResultType: redirect.nativeResultType,
    nativeArgs: redirect.nativeArgs,
  })
}

export function handleExecMessage(execMsg: ExecServerMessage, ctx: ToolDispatchContext): void {
  const { mcpTools, enabledToolNames, cloudRule, nativeToolsMode, sendFrame, onMcpExec, state } = ctx
  const execCase = execMsg.message.case

  // MCP tool calls — decode args and pass through
  if (execCase === 'mcpArgs') {
    if (state) {
      state.totalExecCount++
    }
    const mcpArgs = execMsg.message.value
    const decoded = decodeMcpArgsMap(mcpArgs.args)
    const resolvedToolName = stripMcpToolPrefix(mcpArgs.toolName || mcpArgs.name || '')
    fixMcpArgNames(resolvedToolName, decoded)
    if (!enabledToolNames.has(resolvedToolName)) {
      sendMcpResult(execMsg, toolNotEnabledMessage(resolvedToolName), sendFrame, true)
      return
    }
    onMcpExec({
      execId: execMsg.execId,
      execMsgId: execMsg.id,
      toolCallId: mcpArgs.toolCallId || crypto.randomUUID(),
      toolName: resolvedToolName,
      decodedArgs: JSON.stringify(decoded),
    })
    return
  }

  // RequestContext — respond inline with MCP tools and cloud rule
  if (execCase === 'requestContextArgs') {
    const requestContext = buildRequestContext(mcpTools, cloudRule, nativeToolsMode)
    const result = create(RequestContextResultSchema, {
      result: {
        case: 'success',
        value: create(RequestContextSuccessSchema, { requestContext }),
      },
    })
    sendExecResult(execMsg, 'requestContextResult', result, sendFrame)
    return
  }

  // --- Route overlapping native tools based on nativeToolsMode ---
  const classification = classifyExecMessage(execCase ?? '')

  if (classification === 'redirect') {
    if (state) {
      state.totalExecCount++
    }

    // reject mode: reject all overlapping tools with explicit error
    if (nativeToolsMode === 'reject') {
      rejectOverlappingExec(execMsg, sendFrame)
      return
    }

    // native mode: dispatch to proxy-local execution
    if (nativeToolsMode === 'native' && ctx.allowedRoot) {
      const { allowedRoot } = ctx
      executeNativeLocally(execMsg, allowedRoot)
        .then((nativeResult) => {
          sendExecResult(execMsg, nativeResult.resultType, nativeResult.result, sendFrame)
        })
        .catch((error) => {
          sendMcpResult(
            execMsg,
            `Native execution failed: ${error instanceof Error ? error.message : String(error)}`,
            sendFrame,
            true,
          )
        })
      return
    }

    // redirect mode (default): redirect overlapping tools to MCP
    const nativeRedirect = nativeToMcpRedirect(execMsg)
    if (nativeRedirect) {
      dispatchRedirect(execMsg, nativeRedirect, enabledToolNames, sendFrame, onMcpExec)
      return
    }
  }

  // --- Reject unsupported native tools ---
  const REJECT_REASON = 'Tool not available in this environment. Use the MCP tools provided instead.'

  if (execCase === 'backgroundShellSpawnArgs') {
    const args = execMsg.message.value
    const result = create(BackgroundShellSpawnResultSchema, {
      result: {
        case: 'rejected',
        value: create(ShellRejectedSchema, {
          command: args.command || '',
          workingDirectory: args.workingDirectory || '',
          reason: REJECT_REASON,
          isReadonly: false,
        }),
      },
    })
    sendExecResult(execMsg, 'backgroundShellSpawnResult', result, sendFrame)
    return
  }

  if (execCase === 'writeShellStdinArgs') {
    const result = create(WriteShellStdinResultSchema, {
      result: {
        case: 'error',
        value: create(WriteShellStdinErrorSchema, { error: REJECT_REASON }),
      },
    })
    sendExecResult(execMsg, 'writeShellStdinResult', result, sendFrame)
    return
  }

  if (execCase === 'diagnosticsArgs') {
    const result = create(DiagnosticsResultSchema, {})
    sendExecResult(execMsg, 'diagnosticsResult', result, sendFrame)
    return
  }

  // Unknown exec type — try to send an empty result to avoid server hanging
  if (state) {
    state.totalExecCount++
  }
  sendUnknownExecResult(execMsg, sendFrame)
}

// ── Interaction query handling ──

/**
 * Interaction queries (web search, exa search/fetch, questions) are Cursor-internal
 * features with no Pi tool equivalent. They are always rejected regardless of
 * enabledToolNames — they were never in Pi's tool set to begin with.
 */
function handleInteractionQuery(query: InteractionQuery, sendFrame: (data: Buffer) => void): void {
  const queryId = query.id
  const queryCase = query.query.case
  const rejectReason = 'Tool not available in this environment. Use the MCP tools provided instead.'

  let responseResult: { case: string; value: unknown } | undefined

  if (queryCase === 'webSearchRequestQuery') {
    const searchTerm = query.query.value.args?.searchTerm ?? ''
    console.warn('[tool-dispatch] rejected interaction query', { type: queryCase, searchTerm })
    responseResult = {
      case: 'webSearchRequestResponse',
      value: create(WebSearchRequestResponseSchema, {
        result: {
          case: 'rejected',
          value: create(WebSearchRequestResponse_RejectedSchema, { reason: rejectReason }),
        },
      }),
    }
  } else if (queryCase === 'exaSearchRequestQuery') {
    console.warn('[tool-dispatch] rejected interaction query', { type: queryCase })
    responseResult = {
      case: 'exaSearchRequestResponse',
      value: create(ExaSearchRequestResponseSchema, {
        result: {
          case: 'rejected',
          value: create(ExaSearchRequestResponse_RejectedSchema, { reason: rejectReason }),
        },
      }),
    }
  } else if (queryCase === 'exaFetchRequestQuery') {
    console.warn('[tool-dispatch] rejected interaction query', { type: queryCase })
    responseResult = {
      case: 'exaFetchRequestResponse',
      value: create(ExaFetchRequestResponseSchema, {
        result: {
          case: 'rejected',
          value: create(ExaFetchRequestResponse_RejectedSchema, { reason: rejectReason }),
        },
      }),
    }
  } else if (queryCase === 'askQuestionInteractionQuery') {
    responseResult = {
      case: 'askQuestionInteractionResponse',
      value: create(AskQuestionInteractionResponseSchema, {
        result: create(AskQuestionResultSchema, {
          result: { case: 'rejected', value: create(AskQuestionRejectedSchema, {}) },
        }),
      }),
    }
  } else if (queryCase === 'switchModeRequestQuery') {
    responseResult = {
      case: 'switchModeRequestResponse',
      value: create(SwitchModeRequestResponseSchema, {}),
    }
  } else if (queryCase === 'createPlanRequestQuery') {
    responseResult = {
      case: 'createPlanRequestResponse',
      value: create(CreatePlanRequestResponseSchema, {}),
    }
  } else {
    // Unknown query type — send empty interaction response
    console.error(
      `[tool-dispatch] interactionQuery: unknown type ${queryCase} -- sending empty response for id=${String(queryId)}`,
    )
  }

  // Build and send the interaction response
  const interactionResponse = create(InteractionResponseSchema, {
    id: queryId,
    result: responseResult ? ({ case: responseResult.case, value: responseResult.value } as any) : undefined,
  })
  const clientMsg = create(AgentClientMessageSchema, {
    message: { case: 'interactionResponse', value: interactionResponse },
  })
  sendFrame(frameConnectMessage(toBinary(AgentClientMessageSchema, clientMsg)))
}

// ── Public entry point ──

/**
 * Handle a tool-related server message. Returns true if the message was
 * recognized and handled, false otherwise (caller should try other handlers).
 */
export function handleToolMessage(msg: AgentServerMessage, ctx: ToolDispatchContext): boolean {
  const msgCase = msg.message.case

  if (msgCase === 'execServerMessage') {
    handleExecMessage(msg.message.value, ctx)
    return true
  }

  if (msgCase === 'execServerControlMessage') {
    const ctrl = msg.message.value
    if (ctrl.message.case === 'abort') {
      console.error(`[tool-dispatch] exec ABORT for id=${String(ctrl.message.value.id)}`)
    }
    return true
  }

  if (msgCase === 'interactionQuery') {
    handleInteractionQuery(msg.message.value, ctx.sendFrame)
    return true
  }

  return false
}
