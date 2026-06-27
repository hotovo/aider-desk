// src/proxy/openai-messages.ts
// Parse OpenAI chat completion message format into internal types for Cursor bridge consumption.

export interface ContentPart {
  type: string
  text?: string
  image_url?: { url: string; detail?: string }
}

export interface ImagePart {
  url: string
  detail?: string
}

export interface OpenAIToolCall {
  id: string
  type: string
  function: { name: string; arguments: string }
}

export interface OpenAIMessage {
  role: string
  content: string | ContentPart[] | null
  tool_calls?: OpenAIToolCall[]
  tool_call_id?: string
}

export interface OpenAIToolDef {
  type: string
  function: { name: string; description?: string; parameters?: unknown }
}

export interface ToolResultInfo {
  toolCallId: string
  name: string
  content: string
}

export interface ParsedConversationTurn {
  userText: string
  assistantText: string
  images: ImagePart[]
  /** True when this turn's user message is a compaction or branch summary, not a real user message. */
  isCompaction: boolean
}

export interface ParsedMessages {
  systemPrompt: string
  turns: ParsedConversationTurn[]
  userText: string
  images: ImagePart[]
  toolResults: ToolResultInfo[]
}

/**
 * Prefix strings used by pi-core to wrap compaction and branch summaries.
 * These are used to detect non-user turns in `parseMessages`.
 *
 * Source: `@earendil-works/pi-coding-agent` — COMPACTION_SUMMARY_PREFIX and
 * BRANCH_SUMMARY_PREFIX from `dist/core/messages.js`.  Not imported directly
 * to avoid a heavy/circular dependency; kept in sync manually.
 */
export const COMPACTION_MARKERS = [
  'The conversation history before this point was compacted into the following summary:',
  'The following is a summary of a branch that this conversation came back from:',
] as const

/** Returns true if the text starts with a known compaction/branch summary prefix. */
export function isCompactionText(text: string): boolean {
  return COMPACTION_MARKERS.some((marker) => text.startsWith(marker))
}

/**
 * Normalize message content to a plain string.
 * - string → passthrough
 * - null/undefined → empty string
 * - ContentPart[] → join text parts with newline
 */
export function textContent(content: string | ContentPart[] | null | undefined): string {
  if (content === null || content === undefined) {
    return ''
  }
  if (typeof content === 'string') {
    return content
  }
  return content
    .filter((part): part is ContentPart & { text: string } => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n')
}

/**
 * Extract image content parts from a message's content.
 * Returns empty array for string or null content.
 */
export function extractImageParts(content: string | ContentPart[] | null): ImagePart[] {
  if (content === null || typeof content === 'string') {
    return []
  }
  return content
    .filter(
      (part): part is ContentPart & { image_url: { url: string; detail?: string } } =>
        part.type === 'image_url' && typeof part.image_url?.url === 'string',
    )
    .map((part) => {
      const result: ImagePart = { url: part.image_url.url }
      if (part.image_url.detail !== undefined) {
        result.detail = part.image_url.detail
      }
      return result
    })
}

/**
 * Parse an array of OpenAI messages into structured internal representation.
 *
 * Extracts:
 * - systemPrompt: content of the first system message (or empty string)
 * - turns: paired user/assistant exchanges (all but the last user message)
 * - userText: the final user message content
 * - toolResults: all tool-role messages matched to their tool_call_ids
 */
export function parseMessages(messages: OpenAIMessage[]): ParsedMessages {
  let systemPrompt = ''
  const turns: ParsedConversationTurn[] = []
  const toolResults: ToolResultInfo[] = []

  // Build a map of tool_call_id → tool name from assistant messages
  const toolCallNames = new Map<string, string>()
  for (const msg of messages) {
    if (msg.role === 'assistant' && msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        toolCallNames.set(tc.id, tc.function.name)
      }
    }
  }

  // Collect user messages for turn pairing
  const userMessages: { index: number; text: string; images: ImagePart[] }[] = []
  const assistantMessages: { index: number; text: string }[] = []

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    switch (msg.role) {
      case 'system': {
        if (!systemPrompt) {
          systemPrompt = textContent(msg.content)
        }
        break
      }
      case 'user': {
        userMessages.push({ index: i, text: textContent(msg.content), images: extractImageParts(msg.content) })
        break
      }
      case 'assistant': {
        assistantMessages.push({ index: i, text: textContent(msg.content) })
        break
      }
      case 'tool': {
        if (msg.tool_call_id) {
          toolResults.push({
            toolCallId: msg.tool_call_id,
            name: toolCallNames.get(msg.tool_call_id) ?? '',
            content: textContent(msg.content),
          })
        }
        break
      }
    }
  }

  // Pair user/assistant messages into turns.
  // The last user message becomes userText; earlier ones pair with assistants.
  const lastUserMsg = userMessages.length > 0 ? userMessages.at(-1) : undefined
  const userText = lastUserMsg?.text ?? ''
  const images: ImagePart[] = lastUserMsg?.images ?? []

  // Build turns from sequential user→assistant pairs
  let userIdx = 0
  let assistantIdx = 0
  while (userIdx < userMessages.length - 1 && assistantIdx < assistantMessages.length) {
    const user = userMessages[userIdx]
    const assistant = assistantMessages[assistantIdx]
    // Only pair if assistant comes after user
    if (assistant.index > user.index) {
      turns.push({
        userText: user.text,
        assistantText: assistant.text,
        images: user.images,
        isCompaction: isCompactionText(user.text),
      })
      userIdx++
      assistantIdx++
    } else {
      assistantIdx++
    }
  }

  return { systemPrompt, turns, userText, images, toolResults }
}

/**
 * Filter tools based on the tool_choice parameter.
 * - 'none' → empty array
 * - 'auto', 'required', undefined → all tools
 * - { type: 'function', function: { name } } → filter to matching tool
 */
export function selectToolsForChoice(
  tools: OpenAIToolDef[],
  choice: string | { type: string; function: { name: string } } | undefined,
): OpenAIToolDef[] {
  if (choice === 'none') {
    return []
  }
  if (choice === undefined || choice === 'auto' || choice === 'required') {
    return tools
  }
  if (typeof choice === 'object' && choice.type === 'function') {
    return tools.filter((t) => t.function.name === choice.function.name)
  }
  return tools
}
