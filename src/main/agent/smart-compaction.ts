import { ContextMessage, ContextToolMessage, ContextAssistantMessage, TextPart, ToolResultPart, ToolResultOutput } from '@common/types';
import {
  POWER_TOOL_GROUP_NAME,
  POWER_TOOL_FILE_EDIT,
  POWER_TOOL_FILE_READ,
  POWER_TOOL_FILE_WRITE,
  POWER_TOOL_GLOB,
  POWER_TOOL_GREP,
  POWER_TOOL_SEMANTIC_SEARCH,
  POWER_TOOL_BASH,
  POWER_TOOL_FETCH,
} from '@common/tools';
import { extractServerNameToolName } from '@common/utils';
import { v4 as uuidv4 } from 'uuid';

import { truncateToolResult } from '@/agent/utils';
import logger from '@/logger';

const VERBOSE_COMPACT_WINDOW = 50;
const VERBOSE_TOOL_INPUT_THRESHOLD = 150;

export enum CompactionLevel {
  One = 1,
  Two = 2,
  Three = 3,
  Four = 4,
  Five = 5,
  Max = CompactionLevel.Five,
}

type ToolInfo = {
  messageIndex: number;
  toolCallId: string;
  toolName: string;
  serverName: string;
  input: unknown;
  output: ToolResultOutput | undefined;
};

type AssistantToolCallInfo = {
  messageId: string;
  messageIndex: number;
  partIndex: number;
  toolCallId: string;
  toolName: string;
  input: unknown;
};

const extractFilePath = (args: unknown): string | undefined => {
  if (typeof args === 'object' && args !== null && 'filePath' in args) {
    return (args as Record<string, unknown>).filePath as string;
  }
  return undefined;
};

const getToolOutputText = (output: ToolResultOutput | undefined): string => {
  if (!output) {
    return '';
  }
  if (output.type === 'text') {
    return output.value;
  }
  if (output.type === 'error-text') {
    return output.value;
  }
  return JSON.stringify(output.value);
};

const isErrorResult = (output: ToolResultOutput | undefined): boolean => {
  const text = getToolOutputText(output).toLowerCase();
  return (
    text.includes('denied by user') ||
    text.startsWith('error:') ||
    text.includes('no files found') ||
    text.includes('no matches found') ||
    text.includes('operation was cancelled') ||
    text.includes('warning:') ||
    text.includes('already updated - no changes were needed') ||
    text.includes('failed to')
  );
};

const isNoOpResult = (output: ToolResultOutput | undefined): boolean => {
  const text = getToolOutputText(output);
  return text.includes('Already updated - no changes were needed');
};

const isPowerTool = (serverName: string): boolean => {
  return serverName === POWER_TOOL_GROUP_NAME;
};

const getToolInfoFromToolMessage = (message: ContextToolMessage): ToolInfo[] => {
  return message.content
    .filter((part) => part.type === 'tool-result')
    .map((part) => {
      const [serverName, toolName] = extractServerNameToolName(part.toolName);
      return {
        messageIndex: -1,
        toolCallId: part.toolCallId,
        toolName,
        serverName,
        input: undefined,
        output: part.output,
      } as ToolInfo;
    });
};

const findAssistantToolCall = (messages: ContextMessage[], toolCallId: string): AssistantToolCallInfo | undefined => {
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== 'assistant') {
      continue;
    }
    if (!Array.isArray(msg.content)) {
      continue;
    }

    for (let j = 0; j < msg.content.length; j++) {
      const part = msg.content[j];
      if (part.type === 'tool-call' && part.toolCallId === toolCallId) {
        const [, toolName] = extractServerNameToolName(part.toolName);
        return {
          messageId: msg.id,
          messageIndex: i,
          partIndex: j,
          toolCallId: part.toolCallId,
          toolName,
          input: part.input,
        };
      }
    }
  }
  return undefined;
};

const cloneMessages = (messages: ContextMessage[]): ContextMessage[] => {
  return messages.map((msg): ContextMessage => {
    if (msg.role === 'tool') {
      return {
        ...msg,
        content: msg.content.map((part) => ({ ...part })),
      };
    }
    return {
      ...msg,
      content: Array.isArray(msg.content) ? msg.content.map((part) => ({ ...part })) : msg.content,
    };
  });
};

const removeToolCallFromAssistant = (messages: ContextMessage[], toolCallId: string): void => {
  const callInfo = findAssistantToolCall(messages, toolCallId);
  if (!callInfo) {
    return;
  }

  const assistantMsg = messages[callInfo.messageIndex] as ContextAssistantMessage;
  if (!Array.isArray(assistantMsg.content)) {
    return;
  }

  assistantMsg.content.splice(callInfo.partIndex, 1);

  const hasToolCalls = assistantMsg.content.some((p) => p.type === 'tool-call');

  if (!hasToolCalls) {
    messages.splice(callInfo.messageIndex, 1);
  }
};

const removeToolResult = (messages: ContextMessage[], toolCallId: string): void => {
  const toolMsgIdx = messages.findIndex((m) => m.role === 'tool' && m.content.some((p) => p.type === 'tool-result' && p.toolCallId === toolCallId));
  if (toolMsgIdx === -1) {
    return;
  }

  const toolMsg = messages[toolMsgIdx] as ContextToolMessage;
  const partIdx = toolMsg.content.findIndex((p) => p.type === 'tool-result' && p.toolCallId === toolCallId);
  if (partIdx === -1) {
    return;
  }

  toolMsg.content.splice(partIdx, 1);

  if (toolMsg.content.length === 0) {
    messages.splice(toolMsgIdx, 1);
  }
};

const getProtectedStartIndex = (messages: ContextMessage[], protectedMessageCount: number): number => {
  return Math.max(0, messages.length - protectedMessageCount);
};

const mergeConsecutiveAssistantMessages = (messages: ContextMessage[]): ContextMessage[] => {
  for (let i = messages.length - 2; i >= 0; i--) {
    const current = messages[i];
    const next = messages[i + 1];

    if (current.role !== 'assistant' || next.role !== 'assistant') {
      continue;
    }

    const currentHasToolCalls = Array.isArray(current.content) && current.content.some((p) => p.type === 'tool-call');
    const nextHasToolCalls = Array.isArray(next.content) && next.content.some((p) => p.type === 'tool-call');

    if (currentHasToolCalls || nextHasToolCalls) {
      continue;
    }

    const currentTextParts = Array.isArray(current.content) ? current.content.filter((p) => p.type === 'text') : [];
    const nextTextParts = Array.isArray(next.content) ? next.content.filter((p) => p.type === 'text') : [];

    const mergedText = [...currentTextParts, ...nextTextParts]
      .map((p) => (p as TextPart).text)
      .filter(Boolean)
      .join('\n\n');

    (current as ContextAssistantMessage).content = mergedText ? [{ type: 'text', text: mergedText } satisfies TextPart] : [];

    messages.splice(i + 1, 1);
  }

  return messages.filter((msg) => {
    if (msg.role === 'assistant' && Array.isArray(msg.content) && msg.content.length === 0) {
      return false;
    }
    return true;
  });
};

export const truncateNonPowerToolResults = async (
  messages: ContextMessage[],
  protectedMessageCount = 10,
  compactionLevel = CompactionLevel.One,
): Promise<ContextMessage[]> => {
  const protectedStart = getProtectedStartIndex(messages, protectedMessageCount);

  const redactionMessage = 'Result redacted due to compaction, run again if needed.';

  for (let i = 0; i < protectedStart; i++) {
    const msg = messages[i];
    if (msg.role !== 'tool') {
      continue;
    }

    for (let j = 0; j < msg.content.length; j++) {
      const part = msg.content[j] as ToolResultPart;
      if (part.type !== 'tool-result') {
        continue;
      }
      const [serverName] = extractServerNameToolName(part.toolName);
      if (isPowerTool(serverName)) {
        continue;
      }

      if (compactionLevel >= CompactionLevel.Three) {
        if (part.output.type === 'text' || part.output.type === 'error-text') {
          part.output = {
            type: part.output.type,
            value: redactionMessage,
          };
        } else {
          part.output = {
            type: 'text',
            value: redactionMessage,
          };
        }
        continue;
      }

      if (part.output.type !== 'text' && part.output.type !== 'error-text') {
        continue;
      }

      const outputText = part.output.value;
      if (!outputText) {
        continue;
      }

      const maxLines = compactionLevel >= CompactionLevel.Two ? 10 : 20;
      const maxSizeKB = compactionLevel >= CompactionLevel.Two ? 1 : 2;
      const maxTokens = compactionLevel >= CompactionLevel.Two ? 1000 : 2000;

      const truncated = await truncateToolResult(
        outputText,
        maxLines,
        maxSizeKB,
        maxTokens,
        false,
        'Output truncated due to compaction, re-execute the tool if full output is needed.',
      );
      if (truncated !== outputText) {
        part.output = {
          type: part.output.type,
          value: truncated,
        };
      }
    }
  }

  return messages;
};

export const smartCompactMessages = async (
  messages: ContextMessage[],
  protectedMessageCount = 10,
  compactionLevel = CompactionLevel.One,
): Promise<ContextMessage[]> => {
  let result = cloneMessages(messages);

  result = removeErroredTools(result, protectedMessageCount);
  result = collapseFileEdits(result, protectedMessageCount);
  result = removeStaleFileReads(result, protectedMessageCount);
  result = compactFileReads(result, protectedMessageCount, compactionLevel);
  result = removeObsoleteSearches(result, protectedMessageCount, compactionLevel);
  result = compactSemanticSearches(result, protectedMessageCount, compactionLevel);
  result = compactBashOutputs(result, protectedMessageCount, compactionLevel);
  result = redactFetchOutputs(result, protectedMessageCount);
  result = await truncateNonPowerToolResults(result, protectedMessageCount, compactionLevel);
  result = removeVerboseToolCalls(result, protectedMessageCount, compactionLevel);
  result = removeReasoningFromAssistant(result, protectedMessageCount, compactionLevel);
  result = mergeConsecutiveAssistantMessages(result);

  return result;
};

export const removeErroredTools = (messages: ContextMessage[], protectedMessageCount = 10): ContextMessage[] => {
  const protectedStart = getProtectedStartIndex(messages, protectedMessageCount);

  for (let i = protectedStart - 1; i >= 0; i--) {
    if (i >= messages.length) {
      continue;
    }
    const msg = messages[i];
    if (msg.role !== 'tool') {
      continue;
    }

    const toolInfos = getToolInfoFromToolMessage(msg);
    for (const info of toolInfos) {
      if (!isPowerTool(info.serverName)) {
        continue;
      }
      if (isErrorResult(info.output) || isNoOpResult(info.output)) {
        removeToolCallFromAssistant(messages, info.toolCallId);
        removeToolResult(messages, info.toolCallId);
      }
    }
  }

  return messages;
};

export const collapseFileEdits = (messages: ContextMessage[], protectedMessageCount = 10): ContextMessage[] => {
  const protectedStart = getProtectedStartIndex(messages, protectedMessageCount);

  const fileEditGroups = new Map<string, { assistantMessageId: string; toolCallId: string }[]>();

  for (let i = 0; i < protectedStart; i++) {
    if (i >= messages.length) {
      break;
    }
    const msg = messages[i];
    if (msg.role !== 'tool') {
      continue;
    }

    for (const part of msg.content) {
      if (part.type !== 'tool-result') {
        continue;
      }
      const [serverName, toolName] = extractServerNameToolName(part.toolName);
      if (!isPowerTool(serverName)) {
        continue;
      }
      if (toolName !== POWER_TOOL_FILE_EDIT && toolName !== POWER_TOOL_FILE_WRITE) {
        continue;
      }

      const callInfo = findAssistantToolCall(messages, part.toolCallId);
      if (!callInfo) {
        continue;
      }

      const filePath = extractFilePath(callInfo.input);
      if (!filePath) {
        continue;
      }

      if (!fileEditGroups.has(filePath)) {
        fileEditGroups.set(filePath, []);
      }
      fileEditGroups.get(filePath)!.push({
        assistantMessageId: callInfo.messageId,
        toolCallId: part.toolCallId,
      });
    }
  }

  for (const [filePath, edits] of fileEditGroups) {
    if (edits.length === 0) {
      continue;
    }

    const lastEdit = edits[edits.length - 1];

    const syntheticMessage: ContextAssistantMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: `<file-edited path="${filePath}">File was edited. Read the content again if you need to work on it.</file-edited>`,
        } satisfies TextPart,
      ],
    };

    const assistantIndex = messages.findIndex((m) => m.id === lastEdit.assistantMessageId);
    const insertIndex = assistantIndex !== -1 ? assistantIndex + 1 : 0;
    messages.splice(insertIndex, 0, syntheticMessage);

    for (const edit of edits) {
      removeToolCallFromAssistant(messages, edit.toolCallId);
      removeToolResult(messages, edit.toolCallId);
    }
  }

  return messages;
};

export const removeStaleFileReads = (messages: ContextMessage[], protectedMessageCount = 10): ContextMessage[] => {
  const protectedStart = getProtectedStartIndex(messages, protectedMessageCount);

  const editedFilePaths = new Set<string>();

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // Check for synthetic <file-edited> messages from collapseFileEdits
    if (msg.role === 'assistant' && Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === 'text') {
          const match = part.text.match(/<file-edited path="([^"]+)">/);
          if (match) {
            editedFilePaths.add(match[1]);
          }
        }
      }
      continue;
    }

    if (msg.role !== 'tool') {
      continue;
    }

    for (const part of msg.content) {
      if (part.type !== 'tool-result') {
        continue;
      }
      const [serverName, toolName] = extractServerNameToolName(part.toolName);
      if (!isPowerTool(serverName)) {
        continue;
      }
      if (toolName !== POWER_TOOL_FILE_EDIT && toolName !== POWER_TOOL_FILE_WRITE) {
        continue;
      }

      const callInfo = findAssistantToolCall(messages, part.toolCallId);
      if (callInfo) {
        const filePath = extractFilePath(callInfo.input);
        if (filePath) {
          editedFilePaths.add(filePath);
        }
      }
    }
  }

  const protectedReadFilePaths = new Set<string>();
  for (let i = protectedStart; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== 'tool') {
      continue;
    }

    for (const part of msg.content) {
      if (part.type !== 'tool-result') {
        continue;
      }
      const [serverName, toolName] = extractServerNameToolName(part.toolName);
      if (!isPowerTool(serverName) || toolName !== POWER_TOOL_FILE_READ) {
        continue;
      }

      const callInfo = findAssistantToolCall(messages, part.toolCallId);
      if (callInfo) {
        const filePath = extractFilePath(callInfo.input);
        if (filePath) {
          protectedReadFilePaths.add(filePath);
        }
      }
    }
  }

  const readFileGroups = new Map<string, { messageIndex: number; toolCallId: string }[]>();

  for (let i = protectedStart - 1; i >= 0; i--) {
    if (i >= messages.length) {
      continue;
    }
    const msg = messages[i];
    if (msg.role !== 'tool') {
      continue;
    }

    for (const part of msg.content) {
      if (part.type !== 'tool-result') {
        continue;
      }
      const [serverName, toolName] = extractServerNameToolName(part.toolName);
      if (!isPowerTool(serverName) || toolName !== POWER_TOOL_FILE_READ) {
        continue;
      }

      const callInfo = findAssistantToolCall(messages, part.toolCallId);
      if (!callInfo) {
        continue;
      }

      const filePath = extractFilePath(callInfo.input);
      if (!filePath) {
        continue;
      }

      if (editedFilePaths.has(filePath) || protectedReadFilePaths.has(filePath)) {
        removeToolCallFromAssistant(messages, part.toolCallId);
        removeToolResult(messages, part.toolCallId);
        continue;
      }

      if (!readFileGroups.has(filePath)) {
        readFileGroups.set(filePath, []);
      }
      readFileGroups.get(filePath)!.push({
        messageIndex: i,
        toolCallId: part.toolCallId,
      });
    }
  }

  for (const [, reads] of readFileGroups) {
    if (reads.length <= 1) {
      continue;
    }

    const toRemove = reads.slice(0, -1);
    for (const read of toRemove) {
      removeToolCallFromAssistant(messages, read.toolCallId);
      removeToolResult(messages, read.toolCallId);
    }
  }

  return messages;
};

export const compactFileReads = (messages: ContextMessage[], protectedMessageCount = 10, compactionLevel = CompactionLevel.One): ContextMessage[] => {
  const protectedStart = getProtectedStartIndex(messages, protectedMessageCount);
  const maxLines = compactionLevel === CompactionLevel.Three ? 0 : compactionLevel === CompactionLevel.Two ? 20 : 50;

  for (let i = 0; i < protectedStart; i++) {
    if (i >= messages.length) {
      break;
    }
    const msg = messages[i];
    if (msg.role !== 'tool') {
      continue;
    }

    for (let j = 0; j < msg.content.length; j++) {
      const part = msg.content[j] as ToolResultPart;
      if (part.type !== 'tool-result') {
        continue;
      }
      const [serverName, toolName] = extractServerNameToolName(part.toolName);
      if (!isPowerTool(serverName) || toolName !== POWER_TOOL_FILE_READ) {
        continue;
      }

      if (part.output.type !== 'text') {
        continue;
      }

      if (compactionLevel === CompactionLevel.Three) {
        part.output = {
          type: 'text',
          value: '<result redacted due to compaction, read the file again if content is needed>',
        };
        continue;
      }

      const lines = part.output.value.split('\n');
      if (lines.length > maxLines) {
        part.output = {
          type: 'text',
          value: lines.slice(0, maxLines).join('\n') + '\n<truncated due to compaction, read the file again if full content is needed>',
        };
      }
    }
  }

  return messages;
};

export const removeObsoleteSearches = (messages: ContextMessage[], protectedMessageCount = 10, compactionLevel = CompactionLevel.One): ContextMessage[] => {
  const protectedStart = getProtectedStartIndex(messages, protectedMessageCount);

  const fileModificationPositions: number[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // Check for synthetic <file-edited> messages from collapseFileEdits
    if (msg.role === 'assistant' && Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === 'text' && part.text.includes('<file-edited')) {
          fileModificationPositions.push(i);
          break;
        }
      }
      continue;
    }

    if (msg.role !== 'tool') {
      continue;
    }

    for (const part of msg.content) {
      if (part.type !== 'tool-result') {
        continue;
      }
      const [serverName, toolName] = extractServerNameToolName(part.toolName);
      if (!isPowerTool(serverName)) {
        continue;
      }
      if (toolName === POWER_TOOL_FILE_EDIT || toolName === POWER_TOOL_FILE_WRITE) {
        fileModificationPositions.push(i);
      }
    }
  }

  const hasFileModifications = fileModificationPositions.length > 0;

  if (!hasFileModifications && compactionLevel < CompactionLevel.Three) {
    return messages;
  }

  for (let i = protectedStart - 1; i >= 0; i--) {
    if (i >= messages.length) {
      continue;
    }
    const msg = messages[i];
    if (msg.role !== 'tool') {
      continue;
    }

    for (const part of msg.content) {
      if (part.type !== 'tool-result') {
        continue;
      }
      const [serverName, toolName] = extractServerNameToolName(part.toolName);
      if (!isPowerTool(serverName)) {
        continue;
      }
      if (toolName !== POWER_TOOL_GLOB && toolName !== POWER_TOOL_GREP) {
        continue;
      }

      const shouldRemove = compactionLevel >= CompactionLevel.Three || fileModificationPositions.some((pos) => pos > i);
      if (shouldRemove) {
        removeToolCallFromAssistant(messages, part.toolCallId);
        removeToolResult(messages, part.toolCallId);
      }
    }
  }

  return messages;
};

export const compactSemanticSearches = (messages: ContextMessage[], protectedMessageCount = 10, compactionLevel = CompactionLevel.One): ContextMessage[] => {
  const protectedStart = getProtectedStartIndex(messages, protectedMessageCount);

  const searchIndices: { messageIndex: number; partIndex: number; toolCallId: string }[] = [];

  for (let i = 0; i < protectedStart; i++) {
    if (i >= messages.length) {
      break;
    }
    const msg = messages[i];
    if (msg.role !== 'tool') {
      continue;
    }

    for (let j = 0; j < msg.content.length; j++) {
      const part = msg.content[j];
      if (part.type !== 'tool-result') {
        continue;
      }
      const [serverName, toolName] = extractServerNameToolName(part.toolName);
      if (!isPowerTool(serverName) || toolName !== POWER_TOOL_SEMANTIC_SEARCH) {
        continue;
      }

      searchIndices.push({ messageIndex: i, partIndex: j, toolCallId: part.toolCallId });
    }
  }

  if (searchIndices.length <= 1 && compactionLevel < CompactionLevel.Three) {
    return messages;
  }

  if (compactionLevel >= CompactionLevel.Three) {
    for (const search of searchIndices) {
      removeToolCallFromAssistant(messages, search.toolCallId);
      removeToolResult(messages, search.toolCallId);
    }
    return messages;
  }

  const toRemove = searchIndices.slice(0, -1);
  const toKeep = searchIndices[searchIndices.length - 1];

  for (const search of toRemove) {
    removeToolCallFromAssistant(messages, search.toolCallId);
    removeToolResult(messages, search.toolCallId);
  }

  const maxLines = compactionLevel === CompactionLevel.Two ? 20 : 50;
  const keptToolIdx = messages.findIndex((m) => m.role === 'tool' && m.content.some((p) => p.type === 'tool-result' && p.toolCallId === toKeep.toolCallId));
  if (keptToolIdx !== -1) {
    const keptMsg = messages[keptToolIdx] as ContextToolMessage;
    const keptPartIdx = keptMsg.content.findIndex((p) => p.type === 'tool-result' && p.toolCallId === toKeep.toolCallId);
    const keptPart = keptMsg.content[keptPartIdx] as ToolResultPart;
    if (keptPart && keptPart.output.type === 'text') {
      const lines = keptPart.output.value.split('\n');
      if (lines.length > maxLines) {
        keptPart.output = {
          type: 'text',
          value: lines.slice(0, maxLines).join('\n') + '\n<truncated due to compaction, run again if full output is needed>',
        };
      }
    }
  }

  return messages;
};

export const compactBashOutputs = (messages: ContextMessage[], protectedMessageCount = 10, compactionLevel = CompactionLevel.One): ContextMessage[] => {
  const protectedStart = getProtectedStartIndex(messages, protectedMessageCount);
  logger.info(`Compacting bash outputs at level ${compactionLevel}`);

  const bashCommands = new Map<string, { messageIndex: number; toolCallId: string }[]>();

  for (let i = 0; i < protectedStart; i++) {
    const msg = messages[i];
    if (msg.role !== 'tool') {
      continue;
    }

    for (const part of msg.content) {
      if (part.type !== 'tool-result') {
        continue;
      }
      const [serverName, toolName] = extractServerNameToolName(part.toolName);
      if (!isPowerTool(serverName) || toolName !== POWER_TOOL_BASH) {
        continue;
      }

      const callInfo = findAssistantToolCall(messages, part.toolCallId);
      if (!callInfo) {
        continue;
      }

      const command =
        typeof (callInfo.input as Record<string, unknown>)?.command === 'string'
          ? ((callInfo.input as Record<string, unknown>).command as string).trim()
          : null;

      if (!command) {
        continue;
      }

      if (!bashCommands.has(command)) {
        bashCommands.set(command, []);
      }
      bashCommands.get(command)!.push({
        messageIndex: i,
        toolCallId: part.toolCallId,
      });
    }
  }

  for (const [, occurrences] of bashCommands) {
    if (occurrences.length <= 1) {
      continue;
    }

    const toRemove = occurrences.slice(0, -1);
    for (const occ of toRemove) {
      removeToolCallFromAssistant(messages, occ.toolCallId);
      removeToolResult(messages, occ.toolCallId);
    }
  }

  for (let i = 0; i < protectedStart; i++) {
    if (i >= messages.length) {
      break;
    }
    const msg = messages[i];
    if (msg.role !== 'tool') {
      continue;
    }

    for (let j = 0; j < msg.content.length; j++) {
      const part = msg.content[j] as ToolResultPart;
      if (part.type !== 'tool-result') {
        continue;
      }
      const [serverName, toolName] = extractServerNameToolName(part.toolName);
      if (!isPowerTool(serverName) || toolName !== POWER_TOOL_BASH) {
        continue;
      }

      if (compactionLevel >= CompactionLevel.Three) {
        part.output = {
          type: 'text',
          value: '<result redacted due to compaction, run again if needed>',
        };
        continue;
      }

      if (part.output.type === 'json' || part.output.type === 'error-json') {
        const value = part.output.value;
        if (typeof value === 'object' && value !== null) {
          const obj = value as Record<string, unknown>;
          const stdout = typeof obj.stdout === 'string' ? obj.stdout : '';
          const stderr = typeof obj.stderr === 'string' ? obj.stderr : '';

          const redactionMessage = '<output redacted due to compaction, run again if output is needed>';
          const redactionThreshold = compactionLevel >= CompactionLevel.Two ? 0 : 30;

          if (stdout.length > redactionThreshold) {
            obj.stdout = redactionMessage;
          }
          if (stderr.length > redactionThreshold) {
            obj.stderr = redactionMessage;
          }
        }
        continue;
      }

      if (part.output.type !== 'text') {
        continue;
      }

      try {
        const parsed = JSON.parse(part.output.value);
        if (typeof parsed === 'object' && parsed !== null) {
          const stdout = typeof parsed.stdout === 'string' ? parsed.stdout : '';
          const stderr = typeof parsed.stderr === 'string' ? parsed.stderr : '';

          const redactionMessage = '<output redacted due to compaction, run again if output is needed>';
          let modified = false;

          const redactionThreshold = compactionLevel >= CompactionLevel.Two ? 0 : 30;
          if (stdout.length > redactionThreshold) {
            parsed.stdout = redactionMessage;
            modified = true;
          }
          if (stderr.length > redactionThreshold) {
            parsed.stderr = redactionMessage;
            modified = true;
          }

          if (modified) {
            part.output = {
              type: 'text',
              value: JSON.stringify(parsed),
            };
          }
        }
      } catch {
        // Not JSON, leave as-is
      }
    }
  }

  return messages;
};

export const removeVerboseToolCalls = (messages: ContextMessage[], protectedMessageCount = 10, compactionLevel = CompactionLevel.One): ContextMessage[] => {
  if (compactionLevel < CompactionLevel.Four) {
    return messages;
  }

  const protectedStart = getProtectedStartIndex(messages, Math.max(protectedMessageCount, VERBOSE_COMPACT_WINDOW));

  for (let i = protectedStart - 1; i >= 0; i--) {
    if (i >= messages.length) {
      continue;
    }
    const msg = messages[i] as ContextAssistantMessage;
    if (msg.role !== 'assistant' || !Array.isArray(msg.content)) {
      continue;
    }

    const toolCallIdsToRemove: string[] = [];

    for (let j = msg.content.length - 1; j >= 0; j--) {
      const part = msg.content[j];
      if (part.type !== 'tool-call') {
        continue;
      }
      const inputStr = JSON.stringify(part.input);
      if (inputStr.length > VERBOSE_TOOL_INPUT_THRESHOLD) {
        toolCallIdsToRemove.push(part.toolCallId);
        msg.content.splice(j, 1);
      }
    }

    for (const toolCallId of toolCallIdsToRemove) {
      removeToolResult(messages, toolCallId);
    }

    if (Array.isArray(msg.content) && msg.content.length === 0) {
      messages.splice(i, 1);
    }
  }

  return messages;
};

export const removeReasoningFromAssistant = (
  messages: ContextMessage[],
  protectedMessageCount = 10,
  compactionLevel = CompactionLevel.One,
): ContextMessage[] => {
  if (compactionLevel < CompactionLevel.Five) {
    return messages;
  }

  const protectedStart = getProtectedStartIndex(messages, Math.max(protectedMessageCount, VERBOSE_COMPACT_WINDOW));

  for (let i = protectedStart - 1; i >= 0; i--) {
    if (i >= messages.length) {
      continue;
    }
    const msg = messages[i] as ContextAssistantMessage;
    if (msg.role !== 'assistant' || !Array.isArray(msg.content)) {
      continue;
    }

    const hadReasoning = msg.content.some((p) => p.type === 'reasoning');

    if (!hadReasoning) {
      continue;
    }

    msg.content = msg.content.filter((p) => p.type !== 'reasoning');

    if (msg.content.length === 0) {
      messages.splice(i, 1);
    }
  }

  return messages;
};

export const redactFetchOutputs = (messages: ContextMessage[], protectedMessageCount = 10): ContextMessage[] => {
  const protectedStart = getProtectedStartIndex(messages, protectedMessageCount);

  for (let i = 0; i < protectedStart; i++) {
    const msg = messages[i];
    if (msg.role !== 'tool') {
      continue;
    }

    for (let j = 0; j < msg.content.length; j++) {
      const part = msg.content[j] as ToolResultPart;
      if (part.type !== 'tool-result') {
        continue;
      }
      const [serverName, toolName] = extractServerNameToolName(part.toolName);
      if (!isPowerTool(serverName) || toolName !== POWER_TOOL_FETCH) {
        continue;
      }

      const outputText = getToolOutputText(part.output);
      if (outputText.length > 0) {
        part.output = {
          type: 'text',
          value: '<content redacted due to compaction, fetch again if content is needed>',
        };
      }
    }
  }

  return messages;
};
