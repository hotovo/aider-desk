const THINKING_TAG_NAMES = ['think', 'thinking', 'reasoning', 'thought', 'think_intent']
const MAX_THINKING_TAG_LEN = 16

/**
 * Streaming filter that splits text into `content` and `reasoning` based on
 * XML-style thinking tags (e.g. `<thinking>`, `<reasoning>`). Handles partial
 * tags across chunk boundaries by buffering incomplete `<` sequences.
 */
export function createThinkingTagFilter(): {
  process(text: string): { content: string; reasoning: string }
  flush(): { content: string; reasoning: string }
} {
  let buffer = ''
  let inThinking = false

  return {
    process(text: string) {
      const input = buffer + text
      buffer = ''
      let content = ''
      let reasoning = ''
      let lastIdx = 0

      const re = new RegExp(`<(/?)(?:${THINKING_TAG_NAMES.join('|')})\\s*>`, 'gi')
      let match: RegExpExecArray | null
      while ((match = re.exec(input)) !== null) {
        const before = input.slice(lastIdx, match.index)
        if (inThinking) {
          reasoning += before
        } else {
          content += before
        }
        inThinking = match[1] !== '/'
        lastIdx = re.lastIndex
      }

      const rest = input.slice(lastIdx)
      const ltPos = rest.lastIndexOf('<')
      if (ltPos >= 0 && rest.length - ltPos < MAX_THINKING_TAG_LEN && /^<\/?[a-z_]*$/i.test(rest.slice(ltPos))) {
        buffer = rest.slice(ltPos)
        const before = rest.slice(0, ltPos)
        if (inThinking) {
          reasoning += before
        } else {
          content += before
        }
      } else if (inThinking) {
        reasoning += rest
      } else {
        content += rest
      }

      return { content, reasoning }
    },
    flush() {
      const b = buffer
      buffer = ''
      if (!b) {
        return { content: '', reasoning: '' }
      }
      return inThinking ? { content: '', reasoning: b } : { content: b, reasoning: '' }
    },
  }
}
