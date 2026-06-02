/**
 * Canonical event shapes for pi-agent-observability compatibility.
 * Ported from https://github.com/disler/pi-agent-observability/shared/types.ts
 * Both the extension and the obs server MUST agree on these shapes.
 */

// ─── Event envelope ─────────────────────────────────────────────────────────

export type ObsEventType =
  | "session_start"
  | "session_shutdown"
  | "agent_start"
  | "agent_end"
  | "turn_start"
  | "turn_end"
  | "user_message"
  | "assistant_message"
  | "tool_call"
  | "tool_result"
  | "model_change"
  | "thinking"
  | "error"
  | "custom";

export interface ObsEventEnvelope<P = unknown> {
  event_id: string;
  ts: string;
  type: ObsEventType;
  session_id: string;
  session_file?: string;
  cwd: string;
  agent_name?: string;
  pool: string;
  tags: string[];
  provider?: string;
  model?: string;
  payload: P;
  seq: number;
}

// ─── Payloads ───────────────────────────────────────────────────────────────

export interface SessionStartPayload {
  reason: "startup" | "reload" | "new" | "resume" | "fork";
  pi_version?: string;
  previous_session_file?: string;
}

export interface SessionShutdownPayload {
  reason: "quit" | "reload" | "new" | "resume" | "fork";
}

export interface AgentStartPayload {
  prompt: string;
  images_count: number;
  session_id?: string;
  session_file?: string;
  system_prompt?: string;
  system_prompt_bytes?: number;
  system_prompt_sha256?: string;
  system_prompt_truncated?: boolean;
}

export interface AgentEndPayload {
  message_count: number;
}

export interface TurnStartPayload {
  turn_index: number;
}

export interface TurnEndPayload {
  turn_index: number;
  usage?: UsageSummary;
}

export interface UserMessagePayload {
  text: string;
  images_count: number;
}

export interface AssistantMessagePayload {
  text: string;
  thinking: string;
  tool_call_ids: string[];
  stop_reason: "stop" | "length" | "toolUse" | "error" | "aborted" | string;
  usage: UsageSummary;
  error_message?: string;
  latency_ms?: number;
  prefill_ms?: number;
  generation_ms?: number;
  output_tps?: number;
  turn_index?: number;
}

export interface ToolCallPayload {
  tool_call_id: string;
  tool_name: string;
  args: Record<string, unknown>;
  args_truncated: boolean;
}

export interface ToolResultPayload {
  tool_call_id: string;
  tool_name: string;
  content_text: string;
  content_truncated: boolean;
  is_error: boolean;
  details_summary?: Record<string, unknown>;
}

export interface ModelChangePayload {
  provider: string;
  model: string;
  previous_provider?: string;
  previous_model?: string;
  source: "set" | "cycle" | "restore" | string;
}

export interface ThinkingPayload {
  text: string;
}

export interface ErrorPayload {
  message: string;
  where: string;
}

export interface UsageSummary {
  input: number;
  output: number;
  cache_read: number;
  cache_write: number;
  total_tokens: number;
  cost_total: number;
}

// ─── Limits ─────────────────────────────────────────────────────────────────

export const MAX_TEXT_FIELD = 32_000;
export const MAX_ARGS_BYTES = 16_000;
export const MAX_RESULT_BYTES = 32_000;

export function truncateToBytes(s: string, max: number): { text: string; truncated: boolean } {
  if (!s) return { text: s ?? "", truncated: false };
  const buf = Buffer.byteLength(s, "utf8");
  if (buf <= max) return { text: s, truncated: false };
  const head = max - 64;
  let lo = 0,
    hi = s.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (Buffer.byteLength(s.slice(0, mid), "utf8") <= head) lo = mid;
    else hi = mid - 1;
  }
  return { text: s.slice(0, lo) + `\n…[truncated ${buf - max} bytes]`, truncated: true };
}
