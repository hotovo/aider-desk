import { AsyncLocalStorage } from 'node:async_hooks';
import { isDeepStrictEqual } from 'node:util';

import { createToolRecoveryNotice, isToolRecoveryNotice, ToolRecoveryCode } from '@common/tool-recovery';
import {
  AgentProfile,
  ContextAssistantMessage,
  ContextFile,
  ContextMessage,
  ContextToolMessage,
  Mode,
  PromptContext,
  ToolRecoveryMode,
  JSONValue,
  ProviderOptions,
} from '@common/types';

import type { ToolSet, LanguageModelCallEndEvent } from 'ai';
import type { DataManager } from '@/data-manager';

enum CallStatus {
  Pending = 'pending',
  Running = 'running',
  Executed = 'executed',
  Completed = 'completed',
}

enum ExecutionStatus {
  Running = 'running',
  Cancelled = 'cancelled',
  Completed = 'completed',
}

type ToolCallCheckpoint = {
  id: string;
  parentToolCallId?: string;
  name: string;
  owner?: string;
  requestInput?: Record<string, unknown>;
  input: Record<string, unknown> | undefined;
  recoveryMode: ToolRecoveryMode;
  status: CallStatus;
  output?: JSONValue;
  modelOutput?: ContextToolMessage['content'][number]['output'];
  resultFinalized?: boolean;
  attempt: number;
};

type StepCheckpoint = {
  id: string;
  assistant: ContextAssistantMessage;
  calls: ToolCallCheckpoint[];
  messages?: ContextMessage[];
  assistantCaptured?: boolean;
};

export type ExecutionCheckpoint = {
  version: 1;
  promptContext: PromptContext;
  parentPromptContextId?: string;
  parentToolCallId?: string;
  profile: AgentProfile;
  mode: Mode;
  contextMessages: ContextMessage[];
  contextFiles: ContextFile[];
  systemPrompt?: string;
  history: ContextMessage[];
  conversationReplaced?: boolean;
  status: ExecutionStatus;
  step?: StepCheckpoint;
  outcome?: JSONValue;
};

type ExecutionInput = Omit<ExecutionCheckpoint, 'version' | 'history' | 'status' | 'step' | 'outcome'>;
export type ReplayCall = {
  id: string;
  name: string;
  input: Record<string, unknown> | undefined;
  attempt: number;
  owner?: string;
  requestInput?: Record<string, unknown>;
};

// Maximum number of times a safe tool may be executed across process restarts (initial run + replays).
// Once reached, recovery stops replaying the tool and reports it as interrupted so a tool that
// repeatedly crashes the process cannot keep the app from starting.
const MAX_RECOVERY_ATTEMPTS = 2;

const interruptedOutput = createToolRecoveryNotice(ToolRecoveryCode.Interrupted);
const jsonValue = (value: unknown): JSONValue => JSON.parse(JSON.stringify(value ?? null)) as JSONValue;

export class DurabilityManager {
  private readonly toolContext = new AsyncLocalStorage<{
    executionId: string;
    callId: string;
    childIndex: number;
    toolIndex: number;
    abortSignal?: AbortSignal;
  }>();
  private readonly lastCheckpointAt = new Map<string, number>();
  private readonly runtimeTools = new Map<string, ToolSet>();
  private executions: Map<string, ExecutionCheckpoint> | undefined;
  private readonly suspended = new Set<string>();
  private readonly discarded = new Set<string>();

  constructor(
    private readonly dataManager: Pick<DataManager, 'getAgentExecutions' | 'saveAgentExecution' | 'deleteAgentExecution'>,
    private readonly project: string,
    private readonly taskId: string,
  ) {}

  registerTools(id: string, tools: ToolSet): void {
    this.runtimeTools.set(id, { ...this.runtimeTools.get(id), ...tools });
  }

  getTool(id: string, name: string): ToolSet[string] | undefined {
    return this.runtimeTools.get(id)?.[name];
  }

  withToolCall<T>(executionId: string, callId: string, execute: () => Promise<T>, abortSignal?: AbortSignal): Promise<T> {
    return this.toolContext.run({ executionId, callId, childIndex: 0, toolIndex: 0, abortSignal }, execute);
  }

  resolveToolCallId(id: string, callId: string): string {
    if (callId) {
      return callId;
    }
    const scope = this.toolContext.getStore();
    if (!scope || scope.executionId !== id) {
      throw new Error('Nested tool invocation requires a durable parent');
    }
    return scope.callId + '/nested/' + scope.toolIndex++;
  }

  matchesOwner(id: string, callId: string, owner: string): boolean {
    const call = this.get(id)?.step?.calls.find((item) => item.id === callId);
    return !call || (call.owner ?? call.name) === owner;
  }

  matchesInvocation(id: string, callId: string, name: string, input: unknown, owner: string): boolean {
    const call = this.get(id)?.step?.calls.find((item) => item.id === callId);
    return (
      !call || (call.name === name && this.matchesOwner(id, callId, owner) && isDeepStrictEqual(jsonValue(call.requestInput ?? call.input), jsonValue(input)))
    );
  }

  matchesEffectiveInput(id: string, callId: string, input: unknown): boolean {
    const call = this.get(id)?.step?.calls.find((item) => item.id === callId);
    return !!call && isDeepStrictEqual(jsonValue(call.input), jsonValue(input));
  }

  replaceConversation(id: string, contextMessages: ContextMessage[], history: ContextMessage[]): void {
    const execution = this.get(id);
    if (!execution) {
      return;
    }
    execution.contextMessages = jsonValue(contextMessages) as unknown as ContextMessage[];
    execution.history = jsonValue(history) as unknown as ContextMessage[];
    execution.conversationReplaced = true;
    this.save(execution);
  }

  checkpointTaskConversation(messages: ContextMessage[], executionId?: string): void {
    if (executionId) {
      this.replaceConversation(executionId, messages, []);
      return;
    }
    const owners = this.getRecoverableRoots().filter((execution) => !execution.profile.isSubagent);
    if (owners.length > 1) {
      throw new Error('Task conversation has multiple active owners');
    }
    if (owners.length === 1) {
      this.replaceConversation(owners[0].promptContext.id, messages, []);
    }
  }

  recordToolExecuted(id: string, callId: string): void {
    const execution = this.get(id);
    const call = execution?.step?.calls.find((item) => item.id === callId);
    if (
      !execution ||
      !call ||
      (this.isSuspended(id) &&
        [...this.records().values()].some(
          (item) => item.parentPromptContextId === id && item.parentToolCallId === callId && item.status === ExecutionStatus.Running,
        ))
    ) {
      return;
    }
    call.status = CallStatus.Executed;
    this.save(execution);
  }

  isToolExecuted(id: string, callId: string): boolean {
    return this.get(id)?.step?.calls.some((call) => call.id === callId && call.status === CallStatus.Executed) ?? false;
  }

  private records(): Map<string, ExecutionCheckpoint> {
    if (!this.executions) {
      const records = new Map<string, ExecutionCheckpoint>();
      for (const json of this.dataManager.getAgentExecutions(this.project, this.taskId)) {
        const execution = JSON.parse(json) as ExecutionCheckpoint;
        if (execution.version !== 1) {
          throw new Error('Unsupported agent execution journal version');
        }
        const unfinalized = execution.step?.calls.filter((call) => call.status === CallStatus.Completed && !call.resultFinalized) ?? [];
        if (unfinalized.length > 0) {
          for (const call of unfinalized) {
            call.output = createToolRecoveryNotice(ToolRecoveryCode.FinalizationInterrupted);
            call.modelOutput = undefined;
            call.resultFinalized = true;
          }
          execution.step!.messages = undefined;
          execution.conversationReplaced = true;
          this.dataManager.saveAgentExecution(this.project, this.taskId, execution.promptContext.id, JSON.stringify(execution));
        }
        records.set(execution.promptContext.id, execution);
      }
      this.executions = records;
    }
    return this.executions;
  }

  private save(execution: ExecutionCheckpoint): void {
    if (this.discarded.has(execution.promptContext.id)) {
      return;
    }
    for (const call of execution.step?.calls ?? []) {
      if (call.status === CallStatus.Completed) {
        call.resultFinalized = true;
      }
    }
    this.dataManager.saveAgentExecution(this.project, this.taskId, execution.promptContext.id, JSON.stringify(execution));
    this.lastCheckpointAt.set(execution.promptContext.id, Date.now());
  }

  get(id: string): ExecutionCheckpoint | undefined {
    return this.records().get(id);
  }

  isSettled(id: string): boolean {
    const execution = this.get(id);
    return !!execution && execution.status !== ExecutionStatus.Running;
  }

  getRecoverableRoots(): ExecutionCheckpoint[] {
    return [...this.records().values()].filter((execution) => !execution.parentPromptContextId && execution.status === ExecutionStatus.Running);
  }

  begin(input: ExecutionInput): ExecutionCheckpoint {
    if (input.parentPromptContextId && this.isSuspended(input.parentPromptContextId)) {
      this.suspended.add(input.promptContext.id);
    } else {
      this.suspended.delete(input.promptContext.id);
    }
    this.runtimeTools.delete(input.promptContext.id);
    const existing = this.get(input.promptContext.id);
    if (existing) {
      return existing;
    }
    const execution: ExecutionCheckpoint = { ...input, version: 1, history: [], status: ExecutionStatus.Running };
    this.save(execution);
    this.records().set(input.promptContext.id, execution);
    return execution;
  }

  attachChildContext(context: PromptContext): PromptContext {
    if (context.parentToolCallId) {
      return context;
    }
    const owner = this.toolContext.getStore();
    if (!owner) {
      return context;
    }
    const index = owner.childIndex++;
    const child = [...this.records().values()].find(
      (item) =>
        item.parentPromptContextId === owner.executionId && item.parentToolCallId === owner.callId && (item.promptContext.parentChildIndex ?? 0) === index,
    );
    return child?.promptContext ?? { ...context, parentPromptContextId: owner.executionId, parentToolCallId: owner.callId, parentChildIndex: index };
  }

  getParentAbortSignal(): AbortSignal | undefined {
    return this.toolContext.getStore()?.abortSignal;
  }

  async discardPendingRoots(persist: (messages: ContextMessage[]) => Promise<void>, exceptId: string): Promise<void> {
    for (const execution of this.getRecoverableRoots()) {
      if (execution.promptContext.id !== exceptId) {
        this.markCancelled(execution.promptContext.id);
      }
    }
    await this.flushCancelled(persist);
  }

  findParent(toolCallId: string): ExecutionCheckpoint | undefined {
    const owner = this.toolContext.getStore();
    if (owner?.callId === toolCallId) {
      return this.get(owner.executionId);
    }
    return [...this.records().values()].find((execution) => execution.step?.calls.some((call) => call.id === toolCallId));
  }

  findChild(parentToolCallId: string): ExecutionCheckpoint | undefined {
    return [...this.records().values()].find((execution) => execution.parentToolCallId === parentToolCallId);
  }

  beginStep(id: string, stepId: string): void {
    const execution = this.get(id);
    if (!execution || execution.step || execution.status !== ExecutionStatus.Running) {
      return;
    }
    execution.step = {
      id: stepId,
      assistant: { id: stepId, role: 'assistant', content: [], promptContext: execution.promptContext, timestamp: Date.now() },
      calls: [],
    };
    this.save(execution);
  }

  appendText(id: string, type: 'text' | 'reasoning', text: string): void {
    const execution = this.get(id);
    if (!execution?.step || execution.step.assistantCaptured || execution.status !== ExecutionStatus.Running) {
      return;
    }
    const content = execution.step.assistant.content;
    if (!Array.isArray(content)) {
      return;
    }
    const last = content[content.length - 1];
    if (last?.type === type) {
      last.text += text;
    } else {
      content.push({ type, text });
    }
    if (Date.now() - (this.lastCheckpointAt.get(id) ?? 0) >= 100) {
      this.save(execution);
    }
  }

  captureModelResponse(
    id: string,
    response: LanguageModelCallEndEvent<ToolSet>['content'],
    resolveMode: (name: string) => ToolRecoveryMode,
    resolveOwner: (name: string) => string = (name) => name,
  ): void {
    const content: ContextAssistantMessage['content'] = [];
    for (const part of response) {
      const providerOptions = 'providerMetadata' in part && part.providerMetadata ? (jsonValue(part.providerMetadata) as ProviderOptions) : undefined;
      if (part.type === 'text' || part.type === 'reasoning') {
        if (part.text || part.type === 'reasoning') {
          content.push({ type: part.type, text: part.text, providerOptions });
        }
      } else if (part.type === 'tool-call') {
        content.push({
          type: 'tool-call',
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          input: part.invalid && typeof part.input !== 'object' ? {} : part.input,
          providerExecuted: part.providerExecuted,
          providerOptions,
        });
      } else if (part.type === 'custom') {
        content.push({ type: 'custom', kind: part.kind, providerOptions });
      } else if (part.type === 'file' || part.type === 'reasoning-file') {
        content.push({ type: part.type, data: part.file.base64, mediaType: part.file.mediaType, providerOptions });
      } else if ((part.type === 'tool-result' || part.type === 'tool-error') && part.providerExecuted) {
        content.push({
          type: 'tool-result',
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          output: part.type === 'tool-result' ? { type: 'json', value: jsonValue(part.output) } : { type: 'error-text', value: String(part.error) },
          providerOptions,
        });
      }
    }
    this.captureAssistant(id, content);
    for (const part of response) {
      if (part.type === 'tool-call' && !part.providerExecuted) {
        this.beginTool(
          id,
          {
            id: part.toolCallId,
            name: part.toolName,
            owner: resolveOwner(part.toolName),
            input: part.input as Record<string, unknown>,
            requestInput: part.input as Record<string, unknown>,
            attempt: 0,
          },
          resolveMode(part.toolName),
          true,
        );
      }
    }
  }

  captureAssistant(id: string, content: ContextAssistantMessage['content']): void {
    const execution = this.get(id);
    if (execution?.step && execution.status === ExecutionStatus.Running) {
      execution.step.assistant.content = content;
      execution.step.assistantCaptured = true;
      this.save(execution);
    }
  }

  cancelByInterruptId(interruptId: string): void {
    const execution = [...this.records().values()].find((item) => item.promptContext.group?.interruptId === interruptId);
    if (execution) {
      this.markCancelled(execution.promptContext.id);
    }
  }

  async flushCancelled(persist: (messages: ContextMessage[]) => Promise<void>): Promise<void> {
    for (const execution of [...this.records().values()]) {
      if (!execution.parentPromptContextId && execution.status === ExecutionStatus.Cancelled) {
        const messages = await this.recoverStep(execution.promptContext.id, async () => undefined, true);
        await this.finishStep(execution.promptContext.id, messages, persist);
        this.clear(execution.promptContext.id);
      }
    }
  }

  resolveMode(profile: AgentProfile, name: string, defaultMode?: ToolRecoveryMode, modeKey = name): ToolRecoveryMode {
    return profile.toolRecoveryModes?.[modeKey] ?? profile.toolRecoveryModes?.[name] ?? defaultMode ?? ToolRecoveryMode.Forget;
  }

  isReplay(id: string, callId: string): boolean {
    return this.get(id)?.step?.calls.some((call) => call.id === callId && call.status === CallStatus.Running) ?? false;
  }

  async cancelChild(id: string): Promise<ContextMessage[]> {
    this.markCancelled(id);
    const messages = await this.recoverStep(id, async () => undefined, true);
    await this.finishStep(id, messages);
    return this.get(id)?.history ?? [];
  }

  isToolCompleted(id: string, callId: string): boolean {
    return this.get(id)?.step?.calls.some((call) => call.id === callId && call.status === CallStatus.Completed) ?? false;
  }

  beginTool(id: string, call: ReplayCall, recoveryMode: ToolRecoveryMode, pending = false): void {
    const execution = this.get(id);
    if (!execution?.step || execution.status !== ExecutionStatus.Running) {
      throw new Error('Cannot execute a tool without an active durable step');
    }
    const existing = execution.step.calls.find((item) => item.id === call.id);
    if (existing) {
      if (existing.status === CallStatus.Pending) {
        existing.input = call.input;
        existing.recoveryMode = recoveryMode;
      }
      if (!pending) {
        if (existing.status === CallStatus.Running) {
          existing.attempt++;
        }
        existing.status = CallStatus.Running;
      }
    } else {
      const parentToolCallId = this.toolContext.getStore()?.callId;
      execution.step.calls.push({
        ...call,
        owner: call.owner ?? call.name,
        requestInput: call.requestInput ?? call.input,
        parentToolCallId,
        recoveryMode,
        status: pending ? CallStatus.Pending : CallStatus.Running,
      });
      if (
        !parentToolCallId &&
        Array.isArray(execution.step.assistant.content) &&
        !execution.step.assistant.content.some((part) => part.type === 'tool-call' && part.toolCallId === call.id)
      ) {
        execution.step.assistant.content.push({ type: 'tool-call', toolCallId: call.id, toolName: call.name, input: call.input ?? {} });
      }
    }
    this.save(execution);
  }

  completeTool(id: string, callId: string, output: unknown, modelOutput?: ContextToolMessage['content'][number]['output']): void {
    const execution = this.get(id);
    const call = execution?.step?.calls.find((item) => item.id === callId);
    if (!execution || !call) {
      return;
    }
    if (
      this.isSuspended(id) &&
      [...this.records().values()].some(
        (item) => item.parentPromptContextId === id && item.parentToolCallId === callId && item.status === ExecutionStatus.Running,
      )
    ) {
      return;
    }
    call.output = jsonValue(output);
    if (modelOutput) {
      call.modelOutput = modelOutput;
    }
    call.status = CallStatus.Completed;
    this.save(execution);
  }

  async recoverStep(id: string, execute: (call: ReplayCall) => Promise<unknown>, cancelled = false): Promise<ContextMessage[]> {
    const execution = this.get(id);
    const step = execution?.step;
    if (!execution || !step) {
      return [];
    }
    if (step.messages) {
      return step.messages;
    }
    if (Array.isArray(step.assistant.content)) {
      for (const part of step.assistant.content) {
        if (part.type === 'tool-call' && !part.providerExecuted && !step.calls.some((call) => call.id === part.toolCallId)) {
          step.calls.push({
            id: part.toolCallId,
            name: part.toolName,
            input: part.input as Record<string, unknown>,
            recoveryMode: ToolRecoveryMode.Notify,
            status: CallStatus.Running,
            attempt: 0,
          });
        }
      }
    }
    await Promise.all(
      step.calls.map(async (call) => {
        if (call.status === CallStatus.Completed) {
          return;
        }
        if (call.status === CallStatus.Executed) {
          this.completeTool(id, call.id, createToolRecoveryNotice(ToolRecoveryCode.FinalizationInterrupted));
          return;
        }
        const children = [...this.records().values()].filter((item) => item.parentPromptContextId === id && item.parentToolCallId === call.id);
        const child = children[0];
        if (child && (cancelled || children.every((item) => item.status === ExecutionStatus.Cancelled) || call.recoveryMode !== ToolRecoveryMode.Safe)) {
          const hasCompletedWork = children.some(
            (item) => item.history.some((message) => message.role !== 'user') || item.step?.calls.some((call) => call.status === CallStatus.Completed),
          );
          if (call.recoveryMode === ToolRecoveryMode.Forget && !hasCompletedWork) {
            return;
          }
          const outcomes = await Promise.all(
            children.map(async (item) => ({ messages: await this.cancelChild(item.promptContext.id), promptContext: item.promptContext })),
          );
          call.output = jsonValue({ interruption: interruptedOutput, ...(outcomes.length === 1 ? outcomes[0] : { children: outcomes }), cancelled: true });
          call.status = CallStatus.Completed;
          this.save(execution);
          return;
        }
        if (call.recoveryMode === ToolRecoveryMode.Safe && !cancelled && execution.status === ExecutionStatus.Running) {
          if (call.attempt + 1 >= MAX_RECOVERY_ATTEMPTS) {
            call.output = interruptedOutput;
            call.status = CallStatus.Completed;
            this.save(execution);
            return;
          }
          try {
            let output = await execute({ id: call.id, name: call.name, input: call.input, attempt: call.attempt + 1 });
            if (child && typeof output === 'object' && output !== null && 'error' in output && !child.outcome) {
              const outcomes = await Promise.all(
                children.map(async (item) => ({ messages: await this.cancelChild(item.promptContext.id), promptContext: item.promptContext })),
              );
              output = { ...output, ...(outcomes.length === 1 ? outcomes[0] : { children: outcomes }) };
            }
            if (!this.isToolCompleted(id, call.id)) {
              this.completeTool(id, call.id, output);
            }
          } catch (error) {
            if (!this.isToolCompleted(id, call.id)) {
              throw error;
            }
          }
        } else if (call.recoveryMode !== ToolRecoveryMode.Forget) {
          call.output = interruptedOutput;
          call.status = CallStatus.Completed;
          this.save(execution);
        }
      }),
    );
    for (const call of [...step.calls].reverse()) {
      const nested = step.calls.filter((item) => item.parentToolCallId === call.id && item.status === CallStatus.Completed);
      if (
        nested.length > 0 &&
        (call.status !== CallStatus.Completed || (isToolRecoveryNotice(call.output) && call.output.aiderDeskRecovery === ToolRecoveryCode.Interrupted))
      ) {
        call.status = CallStatus.Completed;
        call.modelOutput = undefined;
        call.output = jsonValue({
          interruption: interruptedOutput,
          completedToolResults: nested.map((item) => ({
            toolCallId: item.id,
            toolName: item.name,
            input: item.requestInput,
            output: item.modelOutput ?? { type: 'json', value: createToolRecoveryNotice(ToolRecoveryCode.FinalizationInterrupted) },
          })),
        });
        call.modelOutput = { type: 'json', value: call.output };
      }
    }
    if (cancelled || execution.status === ExecutionStatus.Cancelled) {
      for (const call of step.calls) {
        if (call.status !== CallStatus.Completed && call.recoveryMode !== ToolRecoveryMode.Forget) {
          call.output = interruptedOutput;
          call.status = CallStatus.Completed;
        }
      }
    }
    const kept = step.calls.filter((call) => !call.parentToolCallId && call.status === CallStatus.Completed);
    const keptIds = new Set(kept.map((call) => call.id));
    const assistant: ContextAssistantMessage = {
      ...step.assistant,
      content: Array.isArray(step.assistant.content)
        ? step.assistant.content.filter(
            (part) =>
              !(part.type === 'reasoning' && !step.assistantCaptured && step.calls.length === 0) &&
              (part.type !== 'tool-call' || part.providerExecuted || keptIds.has(part.toolCallId)),
          )
        : step.assistant.content,
    };
    const messages: ContextMessage[] = [];
    if (assistant.content.length > 0) {
      messages.push(assistant);
    }
    if (kept.length > 0) {
      const result: ContextToolMessage = {
        id: 'durable-result:' + step.id,
        role: 'tool',
        content: kept.map((call) => ({
          type: 'tool-result',
          toolCallId: call.id,
          toolName: call.name,
          output: call.modelOutput ?? { type: 'json', value: call.output ?? null },
        })),
        promptContext: execution.promptContext,
        timestamp: Date.now(),
      };
      messages.push(result);
    }
    step.messages = messages;
    this.save(execution);
    return messages;
  }

  async finishStep(id: string, messages: ContextMessage[], persist?: (messages: ContextMessage[]) => Promise<void>): Promise<void> {
    const execution = this.get(id);
    if (!execution) {
      return;
    }
    if (execution.step) {
      execution.step.messages = messages;
      this.save(execution);
    }
    if (persist) {
      await persist(messages);
    }
    const existing = new Set(execution.history.map((message) => message.id));
    execution.history.push(...messages.filter((message) => !existing.has(message.id)));
    const ownedCalls = execution.step?.calls.map((call) => call.id) ?? [];
    execution.step = undefined;
    this.save(execution);
    for (const child of [...this.records().values()]) {
      if (child.parentPromptContextId === id && ownedCalls.includes(child.parentToolCallId ?? '')) {
        this.clear(child.promptContext.id);
      }
    }
  }

  complete(id: string): void {
    const execution = this.get(id);
    if (!execution) {
      return;
    }
    if (!execution.parentPromptContextId) {
      this.clear(id);
    } else {
      execution.status = ExecutionStatus.Completed;
      this.save(execution);
    }
  }

  setOutcome(id: string, outcome: unknown): void {
    const execution = this.get(id);
    if (execution) {
      execution.outcome = jsonValue(outcome);
      this.save(execution);
    }
  }

  markCancelled(id?: string): void {
    const ownedIds = new Set(id ? [id] : [...this.records().keys()]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const execution of this.records().values()) {
        if (execution.parentPromptContextId && ownedIds.has(execution.parentPromptContextId) && !ownedIds.has(execution.promptContext.id)) {
          ownedIds.add(execution.promptContext.id);
          changed = true;
        }
      }
    }
    for (const execution of this.records().values()) {
      if (ownedIds.has(execution.promptContext.id)) {
        execution.status = ExecutionStatus.Cancelled;
        this.save(execution);
      }
    }
  }

  suspend(): void {
    for (const id of this.records().keys()) {
      this.suspended.add(id);
    }
  }

  isSuspended(id: string): boolean {
    return this.suspended.has(id);
  }

  isCancelled(id: string): boolean {
    return this.discarded.has(id) || this.get(id)?.status === ExecutionStatus.Cancelled;
  }

  clear(id?: string): void {
    for (const execution of [...this.records().values()]) {
      if (!id || execution.promptContext.id === id || execution.parentPromptContextId === id) {
        this.clearChildren(execution.promptContext.id);
        this.dataManager.deleteAgentExecution(this.project, this.taskId, execution.promptContext.id);
        this.records().delete(execution.promptContext.id);
        this.runtimeTools.delete(execution.promptContext.id);
        this.lastCheckpointAt.delete(execution.promptContext.id);
        this.discarded.add(execution.promptContext.id);
      }
    }
  }

  private clearChildren(id: string): void {
    for (const child of [...this.records().values()]) {
      if (child.parentPromptContextId === id) {
        this.clear(child.promptContext.id);
      }
    }
  }
}
