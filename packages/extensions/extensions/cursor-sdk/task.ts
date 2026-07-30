import { randomUUID } from 'node:crypto';

import type { ConversationStep } from '@cursor/sdk';
import type { ContextMessage, JSONValue, PromptContext, ToolResultOutput } from '@aiderdesk/extensions';

export const CURSOR_SUBAGENT_SERVER_NAME = 'subagents';
export const CURSOR_SUBAGENT_TOOL_NAME = 'run_task';
export const CURSOR_SUBAGENT_COLOR = '#3368a8';

type CursorTaskSubagentType = {
  kind?: string;
  name?: string;
};

export type CursorTaskArgs = {
  description?: string;
  prompt?: string;
  subagentType?: CursorTaskSubagentType;
  model?: string;
};

const getTaskSubagentLabel = (args: CursorTaskArgs): string => {
  const typeName = args.subagentType?.name || (args.subagentType?.kind && args.subagentType.kind !== 'unspecified' ? args.subagentType.kind : undefined);
  if (typeName) {
    return `Cursor ${typeName}`;
  }
  if (args.model) {
    return `Cursor ${args.model}`;
  }
  return 'Cursor subagent';
};

const getTaskSubagentId = (args: CursorTaskArgs): string => getTaskSubagentLabel(args).toLowerCase().replace(/\s+/g, '-');

export const mapCursorTaskInput = (args: CursorTaskArgs): Record<string, unknown> => ({
  prompt: args.prompt ?? '',
  subagentId: getTaskSubagentId(args),
  ...(args.description ? { description: args.description } : {}),
});

const getTaskGroupName = (args: CursorTaskArgs, finished: boolean): string => {
  const label = getTaskSubagentLabel(args);
  if (!args.description) {
    return finished ? `${label} completed` : `${label} is running`;
  }

  const description = args.description.endsWith('...') ? args.description.slice(0, -3) : args.description;
  return `${label}: ${finished ? description : `${description}...`}`;
};

export const createCursorTaskPromptContext = (args: CursorTaskArgs): PromptContext => ({
  id: randomUUID(),
  group: {
    id: randomUUID(),
    color: CURSOR_SUBAGENT_COLOR,
    name: getTaskGroupName(args, false),
    interruptId: randomUUID(),
  },
});

export const completeCursorTaskPromptContext = (args: CursorTaskArgs, promptContext: PromptContext): PromptContext => ({
  ...promptContext,
  group: promptContext.group
    ? {
        ...promptContext.group,
        name: getTaskGroupName(args, true),
        finished: true,
      }
    : undefined,
});

export type CursorTaskResultValue = {
  agentId?: string;
  conversationSteps?: unknown[];
  isBackground?: boolean;
};

export const getCursorTaskResultValue = (result: unknown): CursorTaskResultValue | undefined => {
  if (!result || typeof result !== 'object' || !('value' in result)) {
    return undefined;
  }

  const value = (result as { value?: unknown }).value;
  return value && typeof value === 'object' ? (value as CursorTaskResultValue) : undefined;
};

const normalizeToolResult = (result: unknown): unknown => {
  if (!result || typeof result !== 'object') return result;
  const r = result as Record<string, unknown>;
  if ('success' in r) {
    return { status: 'success', value: r.success };
  }
  if ('error' in r && !('status' in r)) {
    return { status: 'error', error: r.error };
  }
  return result;
};

const normalizeConversationStep = (raw: unknown): ConversationStep => {
  if (!raw || typeof raw !== 'object') {
    return { type: 'assistantMessage', message: { text: '' } } as ConversationStep;
  }

  if ('type' in raw && typeof (raw as { type: unknown }).type === 'string') {
    return raw as ConversationStep;
  }

  const step = raw as Record<string, unknown>;

  if ('thinkingMessage' in step) {
    const msg = step.thinkingMessage as { text?: string; durationMs?: number; thinkingDurationMs?: number };
    const thinkingDurationMs = msg.thinkingDurationMs ?? msg.durationMs;
    return {
      type: 'thinkingMessage',
      message: {
        text: msg.text ?? '',
        ...(thinkingDurationMs !== undefined ? { thinkingDurationMs } : {}),
      },
    } as ConversationStep;
  }

  if ('assistantMessage' in step) {
    const msg = step.assistantMessage as { text?: string };
    return {
      type: 'assistantMessage',
      message: { text: msg.text ?? '' },
    } as ConversationStep;
  }

  if ('toolCall' in step) {
    const toolCallData = step.toolCall as Record<string, unknown>;
    const toolCallId = toolCallData.toolCallId as string | undefined;
    const startedAtMs = toolCallData.startedAtMs;
    const completedAtMs = toolCallData.completedAtMs;

    let toolType = 'unknown';
    let args: Record<string, unknown> = {};
    let result: unknown;

    for (const [key, value] of Object.entries(toolCallData)) {
      if (key === 'toolCallId' || key === 'startedAtMs' || key === 'completedAtMs') continue;
      if (value && typeof value === 'object') {
        toolType = key.replace(/ToolCall$/, '');
        const toolData = value as { args?: Record<string, unknown>; result?: unknown };
        args = toolData.args ?? {};
        result = toolData.result;
        break;
      }
    }

    return {
      type: 'toolCall',
      message: {
        type: toolType,
        args,
        result: normalizeToolResult(result),
        ...(toolCallId ? { toolCallId } : {}),
        ...(startedAtMs !== undefined ? { startedAtMs } : {}),
        ...(completedAtMs !== undefined ? { completedAtMs } : {}),
      },
    } as ConversationStep;
  }

  return { type: 'assistantMessage', message: { text: '' } } as ConversationStep;
};

export const getCursorTaskConversationSteps = (result: unknown): ConversationStep[] => {
  const steps = getCursorTaskResultValue(result)?.conversationSteps;
  if (!Array.isArray(steps)) return [];
  return steps.map(normalizeConversationStep);
};

export type CursorTaskResult = {
  resultStr: string;
  output: ToolResultOutput;
};

export const mapCursorTaskResult = (messages: ContextMessage[], promptContext: PromptContext, status: string, error?: unknown): CursorTaskResult => {
  if (status === 'error') {
    const errorMessage = `Error: ${String(error ?? 'Cursor task failed')}`;
    return {
      resultStr: errorMessage,
      output: { type: 'error-text', value: errorMessage },
    };
  }

  const result = { messages, promptContext };
  return {
    resultStr: JSON.stringify(result),
    output: { type: 'json', value: result as unknown as JSONValue },
  };
};

export const getCursorTaskError = (result: unknown): unknown => {
  if (!result || typeof result !== 'object' || !('error' in result)) {
    return undefined;
  }
  return (result as { error?: unknown }).error;
};
