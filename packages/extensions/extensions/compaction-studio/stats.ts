import type { ContextMessage, ToolCallPart, ToolResultPart } from '@aiderdesk/extensions';

export interface CategoryStat {
  count: number;
  estimatedTokens: number;
  savings: Record<number, number>;
}

export interface CompactionStats {
  erroredTools: CategoryStat;
  fileEdits: CategoryStat;
  staleFileReads: CategoryStat;
  fileReads: CategoryStat;
  searches: CategoryStat;
  semanticSearches: CategoryStat;
  bash: CategoryStat;
  fetch: CategoryStat;
  otherTools: CategoryStat;
  verboseToolCalls: CategoryStat;
  reasoning: CategoryStat;
}

const TOOL_GROUP_SEPARATOR = '---';
const POWER_SERVER_NAME = 'power';
const EDIT_TOOLS = ['file_edit', 'file_write'];
const READ_TOOL = 'file_read';
const SEARCH_TOOLS = ['glob', 'grep'];
const SEMANTIC_SEARCH_TOOL = 'semantic_search';
const BASH_TOOL = 'bash';
const FETCH_TOOL = 'fetch';
const VERBOSE_TOOL_INPUT_THRESHOLD = 150;
const MARKER_TOKENS = 20;
const NOTICE_TOKENS = 15;
const REDACT_TOKENS = 10;
const LEVELS = [1, 2, 3];
const ERROR_MARKERS = [
  'denied by user',
  'error:',
  'no files found',
  'no matches found',
  'operation was cancelled',
  'warning:',
  'already updated - no changes were needed',
  'failed to',
];

const emptyStat = (): CategoryStat => ({ count: 0, estimatedTokens: 0, savings: { 1: 0, 2: 0, 3: 0 } });

const splitToolName = (toolCallName: string): [string, string] => {
  const [serverName, ...toolNameParts] = toolCallName.split(TOOL_GROUP_SEPARATOR);
  return [serverName, toolNameParts.join(TOOL_GROUP_SEPARATOR)];
};

const isPowerTool = (serverName: string): boolean => serverName === POWER_SERVER_NAME;

const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

const getOutputText = (output: unknown): string => {
  if (!output || typeof output !== 'object') {
    return '';
  }
  const { type, value } = output as { type?: string; value?: unknown };
  if (type === 'text' || type === 'error-text') {
    return String(value ?? '');
  }
  if (type === 'json' || type === 'error-json') {
    return JSON.stringify(value ?? null);
  }
  if (type === 'content' && Array.isArray(value)) {
    return value.map((item: { text?: string }) => (typeof item?.text === 'string' ? item.text : '')).join('\n');
  }
  return '';
};

const isLikelyError = (outputText: string): boolean => {
  const lower = outputText.toLowerCase();
  return ERROR_MARKERS.some((marker) => lower.includes(marker));
};

const getFilePathFromInput = (input: unknown): string | undefined => {
  return (input as { filePath?: string } | undefined)?.filePath;
};

const getCommandFromInput = (input: unknown): string | undefined => {
  const command = (input as { command?: string } | undefined)?.command;
  return typeof command === 'string' && command.trim() ? command.trim() : undefined;
};

interface CallInfo {
  input: unknown;
  inputChars: number;
  inputTokens: number;
}

interface ToolItem {
  messageIndex: number;
  toolCallId: string;
  serverName: string;
  toolName: string;
  call: CallInfo | undefined;
  outputText: string;
  outputTokens: number;
  isJsonBash: boolean;
  stdoutLength: number;
  stderrLength: number;
}

const truncateByLines = (text: string, maxLines: number): number => {
  const lines = text.split('\n');
  if (lines.length > maxLines) {
    return estimateTokens(lines.slice(0, maxLines).join('\n')) + NOTICE_TOKENS;
  }
  return estimateTokens(text);
};

const addTo = (stat: CategoryStat, amount: number): void => {
  for (const lvl of LEVELS) {
    stat.savings[lvl] += amount;
  }
};

export const collectStats = (messages: ContextMessage[], protectedMessageCount: number): CompactionStats => {
  const stats: CompactionStats = {
    erroredTools: emptyStat(),
    fileEdits: emptyStat(),
    staleFileReads: emptyStat(),
    fileReads: emptyStat(),
    searches: emptyStat(),
    semanticSearches: emptyStat(),
    bash: emptyStat(),
    fetch: emptyStat(),
    otherTools: emptyStat(),
    verboseToolCalls: emptyStat(),
    reasoning: emptyStat(),
  };

  const protectedStart = Math.max(0, messages.length - protectedMessageCount);
  const callsByToolCallId = new Map<string, CallInfo>();
  const editedFilePaths = new Set<string>();
  const fileModificationPositions: number[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== 'assistant' || !Array.isArray(msg.content)) {
      continue;
    }
    for (const part of msg.content) {
      if (part.type === 'tool-call') {
        const callPart = part as ToolCallPart;
        const inputChars = JSON.stringify(callPart.input ?? '').length;
        callsByToolCallId.set(callPart.toolCallId, {
          input: callPart.input,
          inputChars,
          inputTokens: estimateTokens(JSON.stringify(callPart.input ?? '')),
        });
        const [serverName, toolName] = splitToolName(callPart.toolName);
        if (isPowerTool(serverName) && EDIT_TOOLS.includes(toolName)) {
          const filePath = getFilePathFromInput(callPart.input);
          if (filePath) {
            editedFilePaths.add(filePath);
            fileModificationPositions.push(i);
          }
        }
      } else if (part.type === 'reasoning') {
        const reasoningText = (part as { text?: string }).text;
        if (typeof reasoningText === 'string' && i < protectedStart) {
          stats.reasoning.count += 1;
          stats.reasoning.estimatedTokens += estimateTokens(reasoningText);
          addTo(stats.reasoning, estimateTokens(reasoningText));
        }
      } else if (part.type === 'text' && part.text.includes('<file-edited')) {
        fileModificationPositions.push(i);
      }
    }
  }

  const items: ToolItem[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== 'tool' || !Array.isArray(msg.content)) {
      continue;
    }
    for (const part of msg.content) {
      if (part.type !== 'tool-result') {
        continue;
      }
      const resultPart = part as ToolResultPart;
      const [serverName, toolName] = splitToolName(resultPart.toolName);
      const call = callsByToolCallId.get(resultPart.toolCallId);
      const outputText = getOutputText(resultPart.output);

      let isJsonBash = false;
      let stdoutLength = 0;
      let stderrLength = 0;
      if (isPowerTool(serverName) && toolName === BASH_TOOL) {
        try {
          const parsed = JSON.parse(outputText);
          if (typeof parsed === 'object' && parsed !== null) {
            isJsonBash = true;
            stdoutLength = typeof parsed.stdout === 'string' ? parsed.stdout.length : 0;
            stderrLength = typeof parsed.stderr === 'string' ? parsed.stderr.length : 0;
          }
        } catch {
          isJsonBash = false;
        }
      }

      items.push({
        messageIndex: i,
        toolCallId: resultPart.toolCallId,
        serverName,
        toolName,
        call,
        outputText,
        outputTokens: estimateTokens(outputText),
        isJsonBash,
        stdoutLength,
        stderrLength,
      });
    }
  }

  const inWindow = items.filter((item) => item.messageIndex < protectedStart);

  const editGroups = new Map<string, ToolItem[]>();
  for (const item of items) {
    if (!isPowerTool(item.serverName) || !EDIT_TOOLS.includes(item.toolName)) {
      continue;
    }
    const filePath = getFilePathFromInput(item.call?.input);
    if (!filePath) {
      continue;
    }
    if (!editGroups.has(filePath)) {
      editGroups.set(filePath, []);
    }
    editGroups.get(filePath)!.push(item);
  }
  const editItems = inWindow.filter((item) => isPowerTool(item.serverName) && EDIT_TOOLS.includes(item.toolName));
  for (const item of editItems) {
    stats.fileEdits.count += 1;
    stats.fileEdits.estimatedTokens += item.outputTokens;
  }
  {
    const totalTokens = editItems.reduce((sum, item) => sum + item.outputTokens, 0);
    addTo(stats.fileEdits, Math.max(0, totalTokens - MARKER_TOKENS * editGroups.size));
  }

  const readGroupsByPath = new Map<string, ToolItem[]>();
  for (const item of items) {
    if (!isPowerTool(item.serverName) || item.toolName !== READ_TOOL) {
      continue;
    }
    const filePath = getFilePathFromInput(item.call?.input);
    if (!filePath) {
      continue;
    }
    if (!readGroupsByPath.has(filePath)) {
      readGroupsByPath.set(filePath, []);
    }
    readGroupsByPath.get(filePath)!.push(item);
  }
  const protectedReadFilePaths = new Set<string>();
  for (let i = protectedStart; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== 'tool' || !Array.isArray(msg.content)) {
      continue;
    }
    for (const part of msg.content) {
      if (part.type !== 'tool-result') {
        continue;
      }
      const resultPart = part as ToolResultPart;
      const [serverName, toolName] = splitToolName(resultPart.toolName);
      if (!isPowerTool(serverName) || toolName !== READ_TOOL) {
        continue;
      }
      const filePath = getFilePathFromInput(callsByToolCallId.get(resultPart.toolCallId)?.input);
      if (filePath) {
        protectedReadFilePaths.add(filePath);
      }
    }
  }
  const staleReadIds = new Set<string>();
  for (const item of items) {
    if (!isPowerTool(item.serverName) || item.toolName !== READ_TOOL || item.messageIndex >= protectedStart) {
      continue;
    }
    const filePath = getFilePathFromInput(item.call?.input);
    if (!filePath) {
      continue;
    }
    const laterReads = (readGroupsByPath.get(filePath) ?? []).filter((other) => other.messageIndex > item.messageIndex);
    const hasLaterProtectedRead = laterReads.some((other) => other.messageIndex >= protectedStart);
    if (editedFilePaths.has(filePath) || hasLaterProtectedRead || laterReads.length > 0) {
      staleReadIds.add(item.toolCallId);
    }
  }
  const readItems = inWindow.filter((item) => isPowerTool(item.serverName) && item.toolName === READ_TOOL);
  const staleItems = readItems.filter((item) => staleReadIds.has(item.toolCallId));
  const freshReadItems = readItems.filter((item) => !staleReadIds.has(item.toolCallId));
  for (const item of staleItems) {
    stats.staleFileReads.count += 1;
    stats.staleFileReads.estimatedTokens += item.outputTokens;
  }
  addTo(stats.staleFileReads, staleItems.reduce((sum, item) => sum + item.outputTokens + (item.call?.inputTokens ?? 0), 0));

  for (const item of freshReadItems) {
    stats.fileReads.count += 1;
    stats.fileReads.estimatedTokens += item.outputTokens;
  }
  const READ_LINES: Record<number, number> = { 1: 50, 2: 20, 3: 0 };
  for (const item of freshReadItems) {
    for (const lvl of LEVELS) {
      const after = lvl === 3 ? NOTICE_TOKENS : truncateByLines(item.outputText, READ_LINES[lvl]);
      stats.fileReads.savings[lvl] += Math.max(0, item.outputTokens - after);
    }
  }

  const searchItems = inWindow.filter((item) => isPowerTool(item.serverName) && SEARCH_TOOLS.includes(item.toolName));
  for (const item of searchItems) {
    stats.searches.count += 1;
    stats.searches.estimatedTokens += item.outputTokens;
  }
  for (const item of searchItems) {
    const isObsolete = fileModificationPositions.some((pos) => pos > item.messageIndex);
    const full = item.outputTokens + (item.call?.inputTokens ?? 0);
    for (const lvl of LEVELS) {
      if (lvl >= 3 || isObsolete) {
        stats.searches.savings[lvl] += full;
      }
    }
  }

  const semanticItems = inWindow.filter((item) => isPowerTool(item.serverName) && item.toolName === SEMANTIC_SEARCH_TOOL);
  for (const item of semanticItems) {
    stats.semanticSearches.count += 1;
    stats.semanticSearches.estimatedTokens += item.outputTokens;
  }
  if (semanticItems.length > 0) {
    const totalFull = semanticItems.reduce((sum, item) => sum + item.outputTokens + (item.call?.inputTokens ?? 0), 0);
    const kept = semanticItems[semanticItems.length - 1];
    for (const lvl of LEVELS) {
      if (lvl >= 3) {
        stats.semanticSearches.savings[lvl] += totalFull;
      } else if (semanticItems.length > 1) {
        const keptAfter = truncateByLines(kept.outputText, lvl === 2 ? 20 : 50);
        stats.semanticSearches.savings[lvl] += totalFull - kept.outputTokens + Math.max(0, kept.outputTokens - keptAfter);
      }
    }
  }

  const bashItems = inWindow.filter((item) => isPowerTool(item.serverName) && item.toolName === BASH_TOOL);
  const bashGroups = new Map<string, ToolItem[]>();
  for (const item of bashItems) {
    const command = getCommandFromInput(item.call?.input);
    if (!command) {
      continue;
    }
    if (!bashGroups.has(command)) {
      bashGroups.set(command, []);
    }
    bashGroups.get(command)!.push(item);
  }
  for (const item of bashItems) {
    stats.bash.count += 1;
    stats.bash.estimatedTokens += item.outputTokens;
  }
  const duplicateBashIds = new Set<string>();
  for (const [, occurrences] of bashGroups) {
    for (const occ of occurrences.slice(0, -1)) {
      duplicateBashIds.add(occ.toolCallId);
    }
  }
  for (const item of bashItems) {
    const isDuplicate = duplicateBashIds.has(item.toolCallId);
    for (const lvl of LEVELS) {
      if (isDuplicate) {
        stats.bash.savings[lvl] += item.outputTokens + (item.call?.inputTokens ?? 0);
      } else if (lvl >= 3) {
        stats.bash.savings[lvl] += Math.max(0, item.outputTokens - REDACT_TOKENS);
      } else if (item.isJsonBash) {
        const threshold = lvl >= 2 ? 0 : 30;
        const stdoutAfter = item.stdoutLength > threshold ? REDACT_TOKENS : estimateTokens('x'.repeat(item.stdoutLength));
        const stderrAfter = item.stderrLength > threshold ? REDACT_TOKENS : estimateTokens('x'.repeat(item.stderrLength));
        stats.bash.savings[lvl] += Math.max(0, item.outputTokens - stdoutAfter - stderrAfter - 5);
      }
    }
  }

  const fetchItems = inWindow.filter((item) => isPowerTool(item.serverName) && item.toolName === FETCH_TOOL);
  for (const item of fetchItems) {
    stats.fetch.count += 1;
    stats.fetch.estimatedTokens += item.outputTokens;
    addTo(stats.fetch, Math.max(0, item.outputTokens - REDACT_TOKENS));
  }

  const otherItems = inWindow.filter((item) => !isPowerTool(item.serverName));
  for (const item of otherItems) {
    stats.otherTools.count += 1;
    stats.otherTools.estimatedTokens += item.outputTokens;
  }
  const OTHER_CAPS: Record<number, number> = { 1: 2000, 2: 1000 };
  for (const item of otherItems) {
    for (const lvl of LEVELS) {
      const after = lvl >= 3 ? REDACT_TOKENS : Math.min(item.outputTokens, OTHER_CAPS[lvl]);
      stats.otherTools.savings[lvl] += Math.max(0, item.outputTokens - after);
    }
  }

  const erroredItems = inWindow.filter(
    (item) =>
      isPowerTool(item.serverName) &&
      !EDIT_TOOLS.includes(item.toolName) &&
      item.toolName !== READ_TOOL &&
      !SEARCH_TOOLS.includes(item.toolName) &&
      item.toolName !== SEMANTIC_SEARCH_TOOL &&
      item.toolName !== BASH_TOOL &&
      item.toolName !== FETCH_TOOL &&
      isLikelyError(item.outputText),
  );
  for (const item of erroredItems) {
    stats.erroredTools.count += 1;
    stats.erroredTools.estimatedTokens += item.outputTokens;
    addTo(stats.erroredTools, item.outputTokens + (item.call?.inputTokens ?? 0));
  }

  const verboseItems = inWindow.filter((item) => (item.call?.inputChars ?? 0) > VERBOSE_TOOL_INPUT_THRESHOLD);
  for (const item of verboseItems) {
    stats.verboseToolCalls.count += 1;
    stats.verboseToolCalls.estimatedTokens += item.call?.inputTokens ?? 0;
    addTo(stats.verboseToolCalls, (item.call?.inputTokens ?? 0) + item.outputTokens);
  }

  return stats;
};
