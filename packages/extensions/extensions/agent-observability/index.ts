import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type {
  AgentFinishedEvent,
  AgentStartedEvent,
  AgentStepFinishedEvent,
  AgentStepStartedEvent,
  Extension,
  ExtensionContext,
  PromptFinishedEvent,
  PromptStartedEvent,
  ResponseChunkEvent,
  ResponseCompletedEvent,
  TaskClosedEvent,
  TaskCreatedEvent,
  TaskInitializedEvent,
  ToolCalledEvent,
  ToolFinishedEvent,
} from "@aiderdesk/extensions";

import {
  truncateToBytes,
  MAX_TEXT_FIELD,
  MAX_RESULT_BYTES,
} from "./types";
import type {
  SessionStartPayload,
  SessionShutdownPayload,
  AgentStartPayload,
  AgentEndPayload,
  TurnStartPayload,
  TurnEndPayload,
  UserMessagePayload,
  AssistantMessagePayload,
  ThinkingPayload,
  ToolCallPayload,
  ToolResultPayload,
} from "./types";

import {
  createEventEnvelope,
  extractUserMessage,
  extractToolResultContent,
  truncateArgs,
  buildUsageSummary,
  EventQueue,
  sha256hex,
} from "./event-queue";
import type { SessionInfo } from "./event-queue";

// ─── Config ──────────────────────────────────────────────────────────────────

interface ObsConfig {
  serverUrl: string;
  authToken: string;
  pool: string;
  tags: string;
  agentName: string;
  disabled: boolean;
}

const DEFAULT_CONFIG: ObsConfig = {
  serverUrl: "http://127.0.0.1:43190",
  authToken: "",
  pool: "default",
  tags: "",
  agentName: "",
  disabled: false,
};

// ─── Extension ──────────────────────────────────────────────────────────────

export default class AgentObservabilityExtension implements Extension {
  static metadata = {
    name: "Agent Observability",
    version: "1.0.0",
    description:
      "Records agent events and sends them to a pi-agent-observability server for real-time monitoring",
    author: "hotovo",
    iconUrl:
      "https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/agent-observability/icon.png",
    capabilities: ["tracking", "observability"],
  };

  private configPath: string;
  private config: ObsConfig = { ...DEFAULT_CONFIG };
  private context: ExtensionContext | null = null;

  private queue: EventQueue | null = null;
  private sessionInfo: SessionInfo | null = null;
  private seqCounter = 0;

  private activeStepIndex = 0;
  private stepStartTimes = new Map<number, number>();
  private firstTokenTimes = new Map<number, number>();
  private bootSnapshotEmitted = false;
  private pendingPromptText = "";

  constructor() {
    this.configPath = join(__dirname, "config.json");
  }

  private loadConfig(): ObsConfig {
    try {
      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, "utf-8");
        return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
      }
    } catch {
      // Ignore errors
    }
    return { ...DEFAULT_CONFIG };
  }

  private log(msg: string): void {
    this.context?.log(`[observability] ${msg}`, "info");
  }

  private getNextSeq(): number {
    return this.seqCounter++;
  }

  private parseTags(raw: string): string[] {
    return raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  private async probeServer(url: string): Promise<boolean> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(`${url.replace(/\/+$/, "")}/health`, {
        signal: controller.signal,
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async onLoad(context: ExtensionContext): Promise<void> {
    this.context = context;
    this.config = this.loadConfig();
    context.log("Agent Observability extension loaded", "info");
  }

  async onUnload(): Promise<void> {
    if (this.queue) {
      await this.queue.stop();
      this.queue = null;
    }
    this.stepStartTimes.clear();
    this.firstTokenTimes.clear();
    this.pendingPromptText = "";
  }

  // ── Config Component ─────────────────────────────────────────────────────

  getConfigComponent(_context: ExtensionContext): string {
    const jsx = readFileSync(join(__dirname, "./ConfigComponent.jsx"), "utf-8");
    return jsx;
  }

  async getConfigData(_context: ExtensionContext): Promise<unknown> {
    return this.loadConfig();
  }

  async saveConfigData(configData: unknown, _context: ExtensionContext): Promise<unknown> {
    const merged: ObsConfig = { ...DEFAULT_CONFIG, ...(configData as Partial<ObsConfig>) };
    writeFileSync(this.configPath, JSON.stringify(merged, null, 2), "utf-8");
    this.config = merged;

    if (this.queue) {
      this.queue.serverUrl = merged.serverUrl || DEFAULT_CONFIG.serverUrl;
      this.queue.token = merged.authToken;
      this.log(`Config updated — server=${this.queue.serverUrl}, auth=${this.queue.token ? "token set" : "no token"}`);
    }

    return merged;
  }

  // ── Task Events (session lifecycle) ──────────────────────────────────────

  async onTaskCreated(_event: TaskCreatedEvent, _context: ExtensionContext): Promise<void> {
    this.config = this.loadConfig();
    if (this.config.disabled) {
      this.log("Extension is disabled, skipping task creation");
      return;
    }

    this.seqCounter = 0;
    this.bootSnapshotEmitted = false;
    this.stepStartTimes.clear();
    this.firstTokenTimes.clear();

    this.log("Task created — session will be initialized when agent starts");
  }

  async onTaskInitialized(_event: TaskInitializedEvent, _context: ExtensionContext): Promise<void> {
    // Session is initialized in onAgentStarted where task ID is guaranteed
  }

  async onTaskClosed(event: TaskClosedEvent, _context: ExtensionContext): Promise<void> {
    if (this.config.disabled || !this.queue || !this.sessionInfo) return;

    this.log(`Task closed — session_id=${this.sessionInfo.sessionId}`);

    const shutdownPayload: SessionShutdownPayload = {
      reason: "quit",
    };
    this.queue.push(createEventEnvelope("session_shutdown", shutdownPayload, this.sessionInfo, this.getNextSeq()));
    this.log("Enqueued session_shutdown event, draining queue…");

    await this.queue.stop();
    this.queue = null;
    this.sessionInfo = null;
  }

  private enqueueUserMessage(promptText: string): void {
    const { text, images_count } = extractUserMessage(promptText);
    this.log(`Prompt started — ${text.length} chars, ${images_count} images`);

    const payload: UserMessagePayload = {
      text: truncateToBytes(text, MAX_TEXT_FIELD).text,
      images_count,
    };
    this.queue!.push(createEventEnvelope("user_message", payload, this.sessionInfo!, this.getNextSeq()));
    this.log("Enqueued user_message event");
  }

  // ── Prompt Events (user_message) ─────────────────────────────────────────

  async onPromptStarted(event: PromptStartedEvent, _context: ExtensionContext): Promise<void> {
    if (this.config.disabled) return;

    this.pendingPromptText = typeof event.prompt === "string" ? event.prompt : "";

    if (!this.queue || !this.sessionInfo) {
      this.log("Prompt started — session not yet initialized, user_message will be emitted on agent start");
      return;
    }

    this.enqueueUserMessage(this.pendingPromptText);
  }

  async onPromptFinished(_event: PromptFinishedEvent, _context: ExtensionContext): Promise<void> {
    // PromptFinished doesn't carry additional data we need beyond what's in
    // the agent events. We rely on agent events for the full lifecycle.
  }

  // ── Agent Events ─────────────────────────────────────────────────────────

  async onAgentStarted(event: AgentStartedEvent, context: ExtensionContext): Promise<void> {
    if (this.config.disabled) return;

    const serverUrl = this.config.serverUrl || DEFAULT_CONFIG.serverUrl;
    const token = this.config.authToken;
    const pool = this.config.pool || DEFAULT_CONFIG.pool;
    const agentName = this.config.agentName || undefined;
    const tags = this.parseTags(this.config.tags);

    const taskContext = context.getTaskContext();
    const taskId = taskContext?.data?.id;
    if (!taskId) {
      this.log("Agent started but no task ID available — skipping session initialization");
      return;
    }

    if (this.queue) {
      this.log("Stopping previous event queue before creating new one");
      await this.queue.stop();
      this.queue = null;
    }

    this.sessionInfo = {
      sessionId: taskId,
      cwd: context.getProjectDir(),
      agentName,
      pool,
      tags,
    };

    this.sessionInfo.provider = event.providerProfile?.name ?? event.model;
    this.sessionInfo.model = event.model;

    this.log(`Session initialized — session_id=${this.sessionInfo.sessionId}, server=${serverUrl}, pool=${pool}, tags=[${tags.join(",")}]`);

    if (!token) {
      this.log("WARNING: No auth token configured. Set the Auth Token in extension settings to match OBS_AUTH_TOKEN on the server.");
    }

    this.queue = new EventQueue(serverUrl, token, (err) => {
      context.log(`Observability POST failed: ${err instanceof Error ? err.message : String(err)}`, "error");
    }, () => this.getNextSeq(), (msg) => this.log(msg));

    const startPayload: SessionStartPayload = {
      reason: "new",
      pi_version: "aiderdesk",
    };
    this.queue.push(createEventEnvelope("session_start", startPayload, this.sessionInfo, this.getNextSeq()));
    this.log("Enqueued session_start event");

    if (this.pendingPromptText) {
      this.enqueueUserMessage(this.pendingPromptText);
      this.pendingPromptText = "";
    }

    void this.probeServer(serverUrl).then((connected) => {
      if (connected) {
        this.log(`Server health check OK — ${serverUrl}`);
      } else {
        this.log(`Server health check FAILED — ${serverUrl}. Is the observability server running?`);
      }
    });

    this.log(`Agent started — model=${event.model}, provider=${this.sessionInfo.provider}`);

    const payload: AgentStartPayload = {
      prompt: event.prompt ?? "",
      images_count: 0,
      session_id: this.sessionInfo.sessionId,
    };

    if (!this.bootSnapshotEmitted && event.systemPrompt) {
      const sys = event.systemPrompt;
      payload.system_prompt = truncateToBytes(sys, MAX_TEXT_FIELD).text;
      payload.system_prompt_bytes = Buffer.byteLength(sys, "utf8");
      payload.system_prompt_sha256 = sha256hex(sys);
      payload.system_prompt_truncated = Buffer.byteLength(sys, "utf8") > MAX_TEXT_FIELD;
      this.bootSnapshotEmitted = true;
      this.log(`System prompt captured — ${Buffer.byteLength(sys, "utf8")} bytes`);
    }

    this.queue.push(createEventEnvelope("agent_start", payload, this.sessionInfo, this.getNextSeq()));
    this.log("Enqueued agent_start event");
  }

  async onAgentFinished(event: AgentFinishedEvent, _context: ExtensionContext): Promise<void> {
    if (this.config.disabled || !this.queue || !this.sessionInfo) return;

    this.log(`Agent finished — ${event.resultMessages?.length ?? 0} result messages`);

    const payload: AgentEndPayload = {
      message_count: event.resultMessages?.length ?? 0,
    };
    this.queue.push(createEventEnvelope("agent_end", payload, this.sessionInfo, this.getNextSeq()));
    this.log("Enqueued agent_end event");
  }

  async onAgentStepStarted(event: AgentStepStartedEvent, _context: ExtensionContext): Promise<void> {
    if (this.config.disabled || !this.queue || !this.sessionInfo) return;

    this.activeStepIndex = event.iterationCount;
    this.stepStartTimes.set(event.iterationCount, Date.now());

    this.log(`Step started — turn_index=${event.iterationCount}`);

    const payload: TurnStartPayload = {
      turn_index: event.iterationCount,
    };
    this.queue.push(createEventEnvelope("turn_start", payload, this.sessionInfo, this.getNextSeq()));
  }

  async onAgentStepFinished(event: AgentStepFinishedEvent, _context: ExtensionContext): Promise<void> {
    if (this.config.disabled || !this.queue || !this.sessionInfo) return;

    let usage: ReturnType<typeof buildUsageSummary> = undefined;
    if (event.responseMessages?.length) {
      const lastMsg = event.responseMessages[event.responseMessages.length - 1];
      if (lastMsg && "usageReport" in lastMsg) {
        usage = buildUsageSummary(
          (lastMsg as unknown as { usageReport?: { model: string; sentTokens: number; receivedTokens: number; messageCost: number; cacheWriteTokens?: number; cacheReadTokens?: number; aiderTotalCost?: number; agentTotalCost?: number; } }).usageReport ?? null,
        );
      }
    }

    this.log(`Step finished — turn_index=${this.activeStepIndex}, usage=${usage ? `in=${usage.input}/out=${usage.output}` : "n/a"}`);

    const payload: TurnEndPayload = {
      turn_index: event.currentResponseId ? this.activeStepIndex : 0,
      usage,
    };
    this.queue.push(createEventEnvelope("turn_end", payload, this.sessionInfo, this.getNextSeq()));

    this.stepStartTimes.delete(this.activeStepIndex);
    this.firstTokenTimes.delete(this.activeStepIndex);
  }

  // ── Response Events (assistant_message, thinking, TTFT) ────────────────

  async onResponseChunk(event: ResponseChunkEvent, _context: ExtensionContext): Promise<void> {
    if (this.config.disabled) return;

    if (this.firstTokenTimes.has(this.activeStepIndex)) return;
    if (event.chunk?.chunk) {
      this.firstTokenTimes.set(this.activeStepIndex, Date.now());
      this.log(`First token received — step=${this.activeStepIndex}`);
    }
  }

  async onResponseCompleted(event: ResponseCompletedEvent, _context: ExtensionContext): Promise<void> {
    if (this.config.disabled || !this.queue || !this.sessionInfo) return;

    const text = truncateToBytes(event.response.content || "", MAX_TEXT_FIELD).text;

    const usage = buildUsageSummary(event.response.usageReport ?? null);

    const startTs = this.stepStartTimes.get(this.activeStepIndex);
    const firstTs = this.firstTokenTimes.get(this.activeStepIndex);
    const endTs = Date.now();
    const latency_ms = startTs ? endTs - startTs : undefined;
    const prefill_ms = startTs && firstTs ? firstTs - startTs : undefined;
    const generation_ms = firstTs ? endTs - firstTs : undefined;
    const output_tps =
      generation_ms && generation_ms >= 50 && usage && usage.output > 0
        ? Math.round((usage.output / generation_ms) * 1000)
        : undefined;

    this.log(`Response completed — ${text.length} chars, latency=${latency_ms ?? "?"}ms, tps=${output_tps ?? "?"}`);

    const payload: AssistantMessagePayload = {
      text,
      thinking: "",
      tool_call_ids: [],
      stop_reason: "stop",
      usage: usage ?? { input: 0, output: 0, cache_read: 0, cache_write: 0, total_tokens: 0, cost_total: 0 },
      error_message: undefined,
      latency_ms,
      prefill_ms,
      generation_ms,
      output_tps,
      turn_index: this.activeStepIndex,
    };

    this.queue.push(createEventEnvelope("assistant_message", payload, this.sessionInfo, this.getNextSeq()));
    this.log("Enqueued assistant_message event");
  }

  // ── Tool Events ─────────────────────────────────────────────────────────

  async onToolCalled(event: ToolCalledEvent, _context: ExtensionContext): Promise<void> {
    if (this.config.disabled || !this.queue || !this.sessionInfo) return;

    const { args, truncated } = truncateArgs(event.input || {});
    this.log(`Tool called — ${event.toolName} (id=${event.toolCallId})`);

    const payload: ToolCallPayload = {
      tool_call_id: event.toolCallId,
      tool_name: event.toolName,
      args,
      args_truncated: truncated,
    };
    this.queue.push(createEventEnvelope("tool_call", payload, this.sessionInfo, this.getNextSeq()));
  }

  async onToolFinished(event: ToolFinishedEvent, _context: ExtensionContext): Promise<void> {
    if (this.config.disabled || !this.queue || !this.sessionInfo) return;

    let content_text = "";
    if (event.output !== undefined) {
      if (typeof event.output === "string") {
        content_text = event.output;
      } else if (Array.isArray(event.output)) {
        content_text = extractToolResultContent(event.output);
      } else if (typeof event.output === "object" && event.output !== null) {
        const out = event.output as Record<string, unknown>;
        if (out.content && Array.isArray(out.content)) {
          content_text = extractToolResultContent(out.content);
        } else {
          try {
            content_text = JSON.stringify(event.output);
          } catch {
            content_text = String(event.output);
          }
        }
      } else {
        content_text = String(event.output);
      }
    }

    this.log(`Tool finished — ${event.toolName} (id=${event.toolCallId}, ${content_text.length} chars)`);

    const tr = truncateToBytes(content_text.trim(), MAX_RESULT_BYTES);

    const payload: ToolResultPayload = {
      tool_call_id: event.toolCallId,
      tool_name: event.toolName,
      content_text: tr.text,
      content_truncated: tr.truncated,
      is_error: false,
    };
    this.queue.push(createEventEnvelope("tool_result", payload, this.sessionInfo, this.getNextSeq()));
  }
}
