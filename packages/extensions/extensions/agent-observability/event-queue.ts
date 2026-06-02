import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";

import type {
  ObsEventEnvelope,
  ObsEventType,
  UsageSummary,
  AgentStartPayload,
  AssistantMessagePayload,
  ToolCallPayload,
  ToolResultPayload,
  UserMessagePayload,
} from "./types";
import { truncateToBytes, MAX_TEXT_FIELD, MAX_ARGS_BYTES, MAX_RESULT_BYTES } from "./types";

// ─── Helpers ────────────────────────────────────────────────────────────────

export function sha256hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

export function createEventEnvelope<T>(
  type: ObsEventType,
  payload: T,
  sessionInfo: SessionInfo,
  seq: number,
): ObsEventEnvelope<T> {
  const envelope: ObsEventEnvelope<T> = {
    event_id: randomUUID(),
    ts: new Date().toISOString(),
    type,
    session_id: sessionInfo.sessionId,
    session_file: sessionInfo.sessionFile,
    cwd: sessionInfo.cwd,
    agent_name: sessionInfo.agentName,
    pool: sessionInfo.pool,
    tags: sessionInfo.tags,
    provider: sessionInfo.provider,
    model: sessionInfo.model,
    payload,
    seq,
  };
  return envelope;
}

export function extractUserMessage(content: unknown): { text: string; images_count: number } {
  if (typeof content === "string") {
    return { text: content, images_count: 0 };
  }
  let text = "";
  let images_count = 0;
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block && (block as Record<string, unknown>).type === "text") {
        text += ((block as Record<string, unknown>).text as string || "") + "\n";
      } else if (block && (block as Record<string, unknown>).type === "image") {
        images_count++;
      } else if (block && (block as Record<string, unknown>).type === "file") {
        images_count++;
      }
    }
  }
  return { text: text.trim(), images_count };
}

export function truncateArgs(
  args: Record<string, unknown>,
): { args: Record<string, unknown>; truncated: boolean } {
  let truncated = false;
  let copy: Record<string, unknown>;
  try {
    copy = JSON.parse(JSON.stringify(args));
  } catch {
    return { args, truncated: false };
  }

  function walk(obj: unknown) {
    if (!obj || typeof obj !== "object") return;
    const record = obj as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (typeof record[key] === "string") {
        const res = truncateToBytes(record[key] as string, MAX_ARGS_BYTES);
        if (res.truncated) {
          record[key] = res.text;
          truncated = true;
        }
      } else if (typeof record[key] === "object") {
        walk(record[key]);
      }
    }
  }

  walk(copy);
  return { args: copy, truncated };
}

export function extractAssistantContent(
  content: unknown,
): { text: string; thinking: string; tool_call_ids: string[] } {
  let text = "";
  let thinking = "";
  const tool_call_ids: string[] = [];

  if (typeof content === "string") {
    text = content;
  } else if (Array.isArray(content)) {
    for (const block of content) {
      if (!block || typeof block !== "object") continue;
      const b = block as Record<string, unknown>;
      if (b.type === "text") {
        text += (b.text as string || "") + "\n";
      } else if (b.type === "reasoning") {
        thinking += (b.text as string || "") + "\n";
      } else if (b.type === "tool-call") {
        if (b.toolCallId) {
          tool_call_ids.push(b.toolCallId as string);
        }
      }
    }
  }

  return {
    text: truncateToBytes(text.trim(), MAX_TEXT_FIELD).text,
    thinking: truncateToBytes(thinking.trim(), MAX_TEXT_FIELD).text,
    tool_call_ids,
  };
}

export function extractToolResultContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  let text = "";
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block && (block as Record<string, unknown>).type === "tool-result") {
        const output = (block as Record<string, unknown>).output;
        if (output && typeof output === "object") {
          const o = output as Record<string, unknown>;
          if (o.type === "text" && typeof o.value === "string") {
            text += o.value + "\n";
          } else if (o.type === "error-text" && typeof o.value === "string") {
            text += o.value + "\n";
          } else if (o.type === "content" && Array.isArray(o.value)) {
            for (const part of o.value) {
              if (part && (part as Record<string, unknown>).type === "text") {
                text += ((part as Record<string, unknown>).text as string || "") + "\n";
              }
            }
          }
        }
      }
    }
  }
  return text.trim();
}

export function buildUsageSummary(
  usageReport?: { model: string; sentTokens: number; receivedTokens: number; messageCost: number; cacheWriteTokens?: number; cacheReadTokens?: number; aiderTotalCost?: number; agentTotalCost?: number } | null,
): UsageSummary | undefined {
  if (!usageReport) return undefined;
  return {
    input: usageReport.sentTokens ?? 0,
    output: usageReport.receivedTokens ?? 0,
    cache_read: usageReport.cacheReadTokens ?? 0,
    cache_write: usageReport.cacheWriteTokens ?? 0,
    total_tokens: (usageReport.sentTokens ?? 0) + (usageReport.receivedTokens ?? 0),
    cost_total: usageReport.agentTotalCost ?? usageReport.aiderTotalCost ?? usageReport.messageCost ?? 0,
  };
}

// ─── Event Queue ────────────────────────────────────────────────────────────

export interface SessionInfo {
  sessionId: string;
  sessionFile?: string;
  cwd: string;
  agentName?: string;
  pool: string;
  tags: string[];
  provider?: string;
  model?: string;
}

export class EventQueue {
  private queue: ObsEventEnvelope[] = [];
  private readonly maxQueueSize = 10000;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = 250;
  private readonly maxBackoffMs = 5000;
  private isFlushing = false;
  private consecutiveFailures = 0;
  private droppedEventsCount = 0;
  private totalSent = 0;

  public serverUrl: string;
  public token: string;

  constructor(
    serverUrl: string,
    token: string,
    private readonly onPostFailed: (err: unknown) => void,
    private readonly getNextSeq: () => number,
    private readonly onLog?: (msg: string) => void,
  ) {
    this.serverUrl = serverUrl;
    this.token = token;
  }

  push(event: ObsEventEnvelope) {
    if (this.queue.length >= this.maxQueueSize) {
      this.queue.shift();
      this.droppedEventsCount++;
      if (this.droppedEventsCount === 1) {
        this.queue.push(
          createEventEnvelope(
            "error",
            {
              message: "Extension event queue overflowed. Oldest events dropped.",
              where: "extension-queue",
            },
            {
              sessionId: event.session_id,
              cwd: event.cwd,
              pool: event.pool,
              tags: event.tags,
            },
            this.getNextSeq(),
          ),
        );
      }
    }
    this.queue.push(event);

    if (this.queue.length >= 50) {
      void this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  private scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, this.backoffMs);
  }

  async flush() {
    if (this.isFlushing || this.queue.length === 0) return;
    this.isFlushing = true;

    const batch = this.queue.slice(0, 50);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (this.token) {
        headers["Authorization"] = `Bearer ${this.token}`;
      }
      this.onLog?.(`POST ${this.serverUrl.replace(/\/+$/, "")}/events — ${batch.length} events, auth=${this.token ? "Bearer ***" : "none"}`);
      this.onLog?.(`First event sample: ${JSON.stringify(batch[0]).slice(0, 500)}`);

      const response = await fetch(`${this.serverUrl.replace(/\/+$/, "")}/events`, {
        method: "POST",
        headers,
        body: JSON.stringify(batch),
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json() as { ingested?: number; rejected?: string[] };
      if (result.rejected && result.rejected.length > 0) {
        this.onLog?.(`Server rejected ${result.rejected.length} event(s): ${JSON.stringify(result.rejected)}`);
      }
      if (result.ingested !== undefined && result.ingested === 0) {
        this.onLog?.(`Server accepted POST but ingested 0 events (rejected: ${JSON.stringify(result.rejected)})`);
      }

      this.queue.splice(0, batch.length);
      this.consecutiveFailures = 0;
      this.backoffMs = 250;
      this.droppedEventsCount = 0;
      this.totalSent += batch.length;
      this.onLog?.(`Flushed ${batch.length} events to server (total sent: ${this.totalSent}, queue remaining: ${this.queue.length})`);
    } catch (err) {
      this.consecutiveFailures++;
      this.onLog?.(`Flush failed (${this.consecutiveFailures} consecutive): ${err instanceof Error ? err.message : String(err)}. Backoff: ${this.backoffMs}ms`);
      this.onPostFailed(err);
      this.backoffMs = Math.min(this.backoffMs * 2, this.maxBackoffMs);
    } finally {
      this.isFlushing = false;
      if (this.queue.length > 0) {
        this.scheduleFlush();
      }
    }
  }

  async stop() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.queue.length > 0) {
      await this.flush();
    }
  }
}
