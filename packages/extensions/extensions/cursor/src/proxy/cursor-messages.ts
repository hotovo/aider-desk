/**
 * Handlers for Cursor server messages (AgentServerMessage).
 *
 * Processes interactionUpdate (text/thinking deltas, tool lifecycle),
 * kvServerMessage (blobs), and conversationCheckpointUpdate.
 *
 * Tool dispatch (exec messages, interaction queries, exec control) is
 * delegated to the tool-dispatch module via handleToolMessage.
 */
/* oxlint-disable typescript/no-explicit-any, typescript/no-unsafe-member-access, typescript/no-unsafe-assignment, typescript/no-unsafe-argument */
import { create, toBinary } from '@bufbuild/protobuf'

import {
  AgentClientMessageSchema,
  type AgentServerMessage,
  ConversationStateStructureSchema,
  GetBlobResultSchema,
  type InteractionUpdate,
  KvClientMessageSchema,
  type KvServerMessage,
  SetBlobResultSchema,
} from '../proto/agent_pb'
import { frameConnectMessage } from './connect-protocol'
import { type PendingExec, type ToolDispatchContext, handleToolMessage } from './tool-dispatch'

export interface StreamState {
  toolCallIndex: number
  /** Total exec round-trips (MCP + native rejects + requestContext). Tracks Cursor's 25-call limit. */
  totalExecCount: number
  pendingExecs: PendingExec[]
  outputTokens: number
  totalTokens: number
  /** Set when the server sends an endStream frame (clean close or error). */
  endStreamSeen: boolean
  /** Set by batch-complete signals (checkpoint, stepCompleted, turnEnded)
   *  to indicate pending execs should be flushed.
   *  NOT set by toolCallStarted, requestContextArgs, or heartbeat. */
  checkpointAfterExec: boolean
  /** Tracks last delta type for debug logging transitions. */
  lastDeltaType: string | null
}

export function createStreamState(): StreamState {
  return {
    toolCallIndex: 0,
    totalExecCount: 0,
    pendingExecs: [],
    outputTokens: 0,
    totalTokens: 0,
    endStreamSeen: false,
    checkpointAfterExec: false,
    lastDeltaType: null,
  }
}

// ── Interaction update handling ──

function handleInteractionUpdate(
  update: InteractionUpdate,
  state: StreamState,
  onText: (text: string, isThinking: boolean) => void,
): void {
  const msg = update.message

  if (msg.case === 'textDelta') {
    const delta = msg.value.text || ''
    if (delta) {
      state.lastDeltaType = 'text'
      onText(delta, false)
    }
  } else if (msg.case === 'thinkingDelta') {
    const delta = msg.value.text || ''
    if (delta) {
      state.lastDeltaType = 'thinking'
      onText(delta, true)
    }
  } else if (msg.case === 'tokenDelta') {
    state.outputTokens += msg.value.tokens || 0
  } else if (msg.case === 'toolCallStarted') {
    // Just a notification — not a batch delimiter
  } else if (msg.case === 'toolCallCompleted') {
    // Notification only
  } else if (msg.case === 'turnEnded') {
    if (state.pendingExecs.length > 0) {
      state.checkpointAfterExec = true
    }
  } else if (msg.case === 'stepCompleted') {
    if (state.pendingExecs.length > 0) {
      state.checkpointAfterExec = true
    }
  } else if (msg.case === 'heartbeat') {
    // keepalive — not a batch delimiter
  }
  // Ignore: toolCallDelta, partialToolCall, and other unrecognized types
}

// ── KV (Blob Store) handling ──

function sendKvResponse(
  kvMsg: KvServerMessage,
  messageCase: string,
  value: unknown,
  sendFrame: (data: Buffer) => void,
): void {
  const response = create(KvClientMessageSchema, {
    id: kvMsg.id,
    message: { case: messageCase as any, value: value as any },
  })
  const clientMsg = create(AgentClientMessageSchema, {
    message: { case: 'kvClientMessage', value: response },
  })
  sendFrame(frameConnectMessage(toBinary(AgentClientMessageSchema, clientMsg)))
}

function handleKvMessage(
  kvMsg: KvServerMessage,
  blobStore: Map<string, Uint8Array>,
  sendFrame: (data: Buffer) => void,
): void {
  const kvCase = kvMsg.message.case

  if (kvCase === 'getBlobArgs') {
    const { blobId } = kvMsg.message.value
    const blobIdKey = Buffer.from(blobId).toString('hex')
    const blobData = blobStore.get(blobIdKey)
    if (!blobData) {
      console.warn(
        `[cursor-messages] GetBlob miss: key=${blobIdKey.slice(0, 16)}... (store has ${blobStore.size} blobs)`,
      )
    }
    sendKvResponse(kvMsg, 'getBlobResult', create(GetBlobResultSchema, blobData ? { blobData } : {}), sendFrame)
  } else if (kvCase === 'setBlobArgs') {
    const { blobId, blobData } = kvMsg.message.value
    blobStore.set(Buffer.from(blobId).toString('hex'), blobData)
    sendKvResponse(kvMsg, 'setBlobResult', create(SetBlobResultSchema, {}), sendFrame)
  }
}

// ── Message processor context ──

export interface MessageProcessorContext {
  blobStore: Map<string, Uint8Array>
  sendFrame: (data: Buffer) => void
  state: StreamState
  onText: (text: string, isThinking: boolean) => void
  onCheckpoint?: (checkpointBytes: Uint8Array) => void
  onNotify?: (text: string) => void
  /** Tool dispatch context for tool routing. */
  toolDispatch: ToolDispatchContext
}

/** Returns true if the message was a recognized type (real server activity, not keepalive). */
export function processServerMessage(msg: AgentServerMessage, ctx: MessageProcessorContext): boolean {
  const msgCase = msg.message.case

  // Delegate tool-related messages (exec, interaction query, exec control)
  if (handleToolMessage(msg, ctx.toolDispatch)) {
    return true
  }

  if (msgCase === 'interactionUpdate') {
    handleInteractionUpdate(msg.message.value, ctx.state, ctx.onText)
    return true
  }

  if (msgCase === 'kvServerMessage') {
    handleKvMessage(msg.message.value, ctx.blobStore, ctx.sendFrame)
    return true
  }

  if (msgCase === 'conversationCheckpointUpdate') {
    const stateStructure = msg.message.value
    if (stateStructure.tokenDetails) {
      ctx.state.totalTokens = stateStructure.tokenDetails.usedTokens
    }
    ctx.onCheckpoint?.(toBinary(ConversationStateStructureSchema, stateStructure))
    return true
  }

  console.error(`[cursor-messages] unrecognized server message case: ${String(msgCase)}`)
  return false
}
