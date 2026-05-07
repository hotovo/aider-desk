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

type ToolInfo = {
  messageIndex: number;
  toolCallId: string;
  toolName: string;
  serverName: string;
  input: unknown;
  output: ToolResultOutput | undefined;
};

type AssistantToolCallInfo = {
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

  if (assistantMsg.content.length === 0) {
    messages.splice(callInfo.messageIndex, 1);
  }
};

const getProtectedStartIndex = (messages: ContextMessage[], protectedMessageCount: number): number => {
  return Math.max(0, messages.length - protectedMessageCount);
};

export const smartCompactMessages = (messages: ContextMessage[], protectedMessageCount = 10): ContextMessage[] => {
  let result = cloneMessages(messages);

  result = removeErroredTools(result, protectedMessageCount);
  result = collapseFileEdits(result, protectedMessageCount);
  result = removeStaleFileReads(result, protectedMessageCount);
  result = removeObsoleteSearches(result, protectedMessageCount);
  result = compactSemanticSearches(result, protectedMessageCount);
  result = deduplicateBash(result, protectedMessageCount);
  result = redactFetchOutputs(result, protectedMessageCount);

  return result;
};

export const removeErroredTools = (messages: ContextMessage[], protectedMessageCount = 10): ContextMessage[] => {
  const result = cloneMessages(messages);
  const protectedStart = getProtectedStartIndex(result, protectedMessageCount);

  const indicesToRemove: Set<number> = new Set();

  for (let i = 0; i < protectedStart; i++) {
    const msg = result[i];
    if (msg.role !== 'tool') {
      continue;
    }

    const toolInfos = getToolInfoFromToolMessage(msg);
    for (const info of toolInfos) {
      if (!isPowerTool(info.serverName)) {
        continue;
      }
      if (isErrorResult(info.output) || isNoOpResult(info.output)) {
        indicesToRemove.add(i);
        removeToolCallFromAssistant(result, info.toolCallId);
      }
    }
  }

  for (let i = result.length - 1; i >= 0; i--) {
    if (indicesToRemove.has(i)) {
      result.splice(i, 1);
    }
  }

  return result;
};

export const collapseFileEdits = (messages: ContextMessage[], protectedMessageCount = 10): ContextMessage[] => {
  const result = cloneMessages(messages);
  const protectedStart = getProtectedStartIndex(result, protectedMessageCount);

  const fileEditGroups = new Map<string, { messageIndex: number; toolCallId: string }[]>();

  for (let i = 0; i < protectedStart; i++) {
    const msg = result[i];
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

      const callInfo = findAssistantToolCall(result, part.toolCallId);
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
        messageIndex: i,
        toolCallId: part.toolCallId,
      });
    }
  }

  for (const [, edits] of fileEditGroups) {
    if (edits.length === 0) {
      continue;
    }

    const firstEdit = edits[0];

    const syntheticMessage: ContextAssistantMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: `<file-edited path="${extractFilePath(findAssistantToolCall(result, firstEdit.toolCallId)?.input)}">File was edited. Read the content again if you need to work on it.</file-edited>`,
        } satisfies TextPart,
      ],
    };

    for (const edit of edits) {
      removeToolCallFromAssistant(result, edit.toolCallId);

      const toolMsgIdx = result.findIndex((m) => m.role === 'tool' && m.content.some((p) => p.type === 'tool-result' && p.toolCallId === edit.toolCallId));
      if (toolMsgIdx !== -1) {
        result.splice(toolMsgIdx, 1);
      }
    }

    const insertIndex = firstEdit.messageIndex < result.length ? firstEdit.messageIndex : result.length;
    result.splice(insertIndex, 0, syntheticMessage);
  }

  return result;
};

export const removeStaleFileReads = (messages: ContextMessage[], protectedMessageCount = 10): ContextMessage[] => {
  const result = cloneMessages(messages);
  const protectedStart = getProtectedStartIndex(result, protectedMessageCount);

  const editedFilePaths = new Set<string>();

  for (let i = 0; i < result.length; i++) {
    const msg = result[i];
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

      const callInfo = findAssistantToolCall(result, part.toolCallId);
      if (callInfo) {
        const filePath = extractFilePath(callInfo.input);
        if (filePath) {
          editedFilePaths.add(filePath);
        }
      }
    }
  }

  const protectedReadFilePaths = new Set<string>();
  for (let i = protectedStart; i < result.length; i++) {
    const msg = result[i];
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

      const callInfo = findAssistantToolCall(result, part.toolCallId);
      if (callInfo) {
        const filePath = extractFilePath(callInfo.input);
        if (filePath) {
          protectedReadFilePaths.add(filePath);
        }
      }
    }
  }

  const readFileGroups = new Map<string, { messageIndex: number; toolCallId: string }[]>();

  for (let i = 0; i < protectedStart; i++) {
    const msg = result[i];
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

      const callInfo = findAssistantToolCall(result, part.toolCallId);
      if (!callInfo) {
        continue;
      }

      const filePath = extractFilePath(callInfo.input);
      if (!filePath) {
        continue;
      }

      if (editedFilePaths.has(filePath) || protectedReadFilePaths.has(filePath)) {
        removeToolCallFromAssistant(result, part.toolCallId);
        const toolMsgIdx = result.findIndex((m) => m.role === 'tool' && m.content.some((p) => p.type === 'tool-result' && p.toolCallId === part.toolCallId));
        if (toolMsgIdx !== -1) {
          result.splice(toolMsgIdx, 1);
        }
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
      removeToolCallFromAssistant(result, read.toolCallId);
      const toolMsgIdx = result.findIndex((m) => m.role === 'tool' && m.content.some((p) => p.type === 'tool-result' && p.toolCallId === read.toolCallId));
      if (toolMsgIdx !== -1) {
        result.splice(toolMsgIdx, 1);
      }
    }
  }

  return result;
};

export const removeObsoleteSearches = (messages: ContextMessage[], protectedMessageCount = 10): ContextMessage[] => {
  const result = cloneMessages(messages);
  const protectedStart = getProtectedStartIndex(result, protectedMessageCount);

  const fileModificationPositions: number[] = [];

  for (let i = 0; i < result.length; i++) {
    const msg = result[i];
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

  if (!hasFileModifications) {
    return result;
  }

  const indicesToRemove: Set<number> = new Set();

  for (let i = 0; i < protectedStart; i++) {
    const msg = result[i];
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

      const hasLaterModification = fileModificationPositions.some((pos) => pos > i);
      if (hasLaterModification) {
        indicesToRemove.add(i);
        removeToolCallFromAssistant(result, part.toolCallId);
      }
    }
  }

  for (let i = result.length - 1; i >= 0; i--) {
    if (indicesToRemove.has(i)) {
      result.splice(i, 1);
    }
  }

  return result;
};

export const compactSemanticSearches = (messages: ContextMessage[], protectedMessageCount = 10): ContextMessage[] => {
  const result = cloneMessages(messages);
  const protectedStart = getProtectedStartIndex(result, protectedMessageCount);

  const searchIndices: { messageIndex: number; partIndex: number; toolCallId: string }[] = [];

  for (let i = 0; i < protectedStart; i++) {
    const msg = result[i];
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

  if (searchIndices.length <= 1) {
    return result;
  }

  const toRemove = searchIndices.slice(0, -1);
  const toKeep = searchIndices[searchIndices.length - 1];

  for (const search of toRemove) {
    removeToolCallFromAssistant(result, search.toolCallId);
  }

  for (let i = result.length - 1; i >= 0; i--) {
    const msg = result[i];
    if (msg.role !== 'tool') {
      continue;
    }

    const partsToRemove = msg.content.filter(
      (part) =>
        part.type === 'tool-result' &&
        isPowerTool(extractServerNameToolName(part.toolName)[0]) &&
        extractServerNameToolName(part.toolName)[1] === POWER_TOOL_SEMANTIC_SEARCH &&
        toRemove.some((r) => r.toolCallId === part.toolCallId),
    );

    if (partsToRemove.length > 0) {
      const remainingParts = msg.content.filter(
        (part) => !partsToRemove.some((pr) => (pr as ToolResultPart).toolCallId === (part as ToolResultPart).toolCallId),
      );

      if (remainingParts.length === 0) {
        result.splice(i, 1);
      } else {
        (msg as ContextToolMessage).content = remainingParts as ToolResultPart[];
      }
    }
  }

  const keptMsg = result[toKeep.messageIndex];
  if (keptMsg && keptMsg.role === 'tool') {
    const keptPart = keptMsg.content[toKeep.partIndex] as ToolResultPart;
    if (keptPart && keptPart.output.type === 'text') {
      const lines = keptPart.output.value.split('\n');
      if (lines.length > 50) {
        keptPart.output = {
          type: 'text',
          value: lines.slice(0, 50).join('\n') + '\n<truncated due to compaction, run again if full output is needed>',
        };
      }
    }
  }

  return result;
};

export const deduplicateBash = (messages: ContextMessage[], protectedMessageCount = 10): ContextMessage[] => {
  const result = cloneMessages(messages);
  const protectedStart = getProtectedStartIndex(result, protectedMessageCount);

  const bashCommands = new Map<string, { messageIndex: number; toolCallId: string }[]>();

  for (let i = 0; i < protectedStart; i++) {
    const msg = result[i];
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

      const callInfo = findAssistantToolCall(result, part.toolCallId);
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
      removeToolCallFromAssistant(result, occ.toolCallId);
      const toolMsgIdx = result.findIndex((m) => m.role === 'tool' && m.content.some((p) => p.type === 'tool-result' && p.toolCallId === occ.toolCallId));
      if (toolMsgIdx !== -1) {
        result.splice(toolMsgIdx, 1);
      }
    }
  }

  for (let i = 0; i < protectedStart; i++) {
    const msg = result[i];
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

          if (stdout.length > 30) {
            parsed.stdout = redactionMessage;
            modified = true;
          }
          if (stderr.length > 30) {
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

  return result;
};

export const redactFetchOutputs = (messages: ContextMessage[], protectedMessageCount = 10): ContextMessage[] => {
  const result = cloneMessages(messages);
  const protectedStart = getProtectedStartIndex(result, protectedMessageCount);

  for (let i = 0; i < protectedStart; i++) {
    const msg = result[i];
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

  return result;
};
