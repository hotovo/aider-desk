import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { Agent, Cursor } from '@cursor/sdk';
import type { Run, SDKAgent, SDKMessage } from '@cursor/sdk';

import type {
  AgentStartedEvent,
  ContextAssistantMessage,
  ContextMessage,
  ContextToolMessage,
  ContextUserMessage,
  Extension,
  ExtensionContext,
  InterruptedEvent,
  LoadModelsResponse,
  McpServerConfig as AiderDeskMcpServerConfig,
  Model,
  ProviderDefinition,
  ReasoningPart,
  TaskContext,
  TextPart,
  ToolCallPart,
  ToolResultOutput,
} from '@aiderdesk/extensions';

interface CursorConfig {
  apiKey: string;
}

const CURSOR_PROVIDER_NAME = 'cursor';
const AGENT_ID_METADATA_KEY = 'cursorAgentId';
const POWER_TOOL_SERVER_NAME = 'power';
const CURSOR_SERVER_NAME = 'cursor';
const TOOL_SEPARATOR = '---';

const powerToolName = (name: string) => `${POWER_TOOL_SERVER_NAME}${TOOL_SEPARATOR}${name}`;
const cursorToolId = (name: string) => `${CURSOR_SERVER_NAME}${TOOL_SEPARATOR}${name}`;

type TransformedTool = {
  serverName: string;
  toolName: string;
  fullToolName: string;
  input: Record<string, unknown>;
};

type TransformedResult = {
  resultStr: string | undefined;
  output: ToolResultOutput;
};

type ParsedEdit = {
  filePath: string;
  searchTerm: string;
  replacementText: string;
};

const HUNK_HEADER_RE = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

function parseUnifiedDiff(diffString: string, defaultFilePath: string): ParsedEdit[] {
  const lines = diffString.split('\n');
  const edits: ParsedEdit[] = [];
  const fileHeaderRe = /^--- [ab]\/(.*)$/;
  const nextFileHeaderRe = /^\+\+\+ [ab]\/(.*)$/;

  let currentFilePath = defaultFilePath;
  let pendingFromPath: string | null = null;
  let inHunk = false;
  let searchLines: string[] = [];
  let replaceLines: string[] = [];

  const finishHunk = () => {
    if (!inHunk) return;
    const searchTerm = searchLines.join('\n');
    const replacementText = replaceLines.join('\n');
    if (searchTerm !== replacementText) {
      edits.push({ filePath: currentFilePath, searchTerm, replacementText });
    }
    inHunk = false;
    searchLines = [];
    replaceLines = [];
  };

  for (const line of lines) {
    const fromMatch = fileHeaderRe.exec(line);
    if (fromMatch) {
      finishHunk();
      pendingFromPath = fromMatch[1];
      continue;
    }

    const toMatch = nextFileHeaderRe.exec(line);
    if (toMatch) {
      if (pendingFromPath) {
        currentFilePath = toMatch[1] || pendingFromPath;
        pendingFromPath = null;
      }
      continue;
    }

    const hunkMatch = HUNK_HEADER_RE.exec(line);
    if (hunkMatch) {
      finishHunk();
      inHunk = true;
      searchLines = [];
      replaceLines = [];
      continue;
    }

    if (!inHunk) continue;

    if (line.startsWith('+')) {
      replaceLines.push(line.slice(1));
    } else if (line.startsWith('-')) {
      searchLines.push(line.slice(1));
    } else if (line.startsWith(' ')) {
      searchLines.push(line.slice(1));
      replaceLines.push(line.slice(1));
    }
  }

  finishHunk();

  return edits;
}

type CursorMcpServerConfig = {
  type?: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  url?: string;
  headers?: Record<string, string>;
};

function toCursorMcpServers(
  aiderDeskMcpServers: Record<string, AiderDeskMcpServerConfig>,
  enabledServers: string[],
  projectDir: string,
): Record<string, CursorMcpServerConfig> {
  const result: Record<string, CursorMcpServerConfig> = {};

  for (const serverName of enabledServers) {
    const config = aiderDeskMcpServers[serverName];
    if (!config) continue;

    if (config.command) {
      result[serverName] = {
        type: 'stdio',
        command: config.command,
        args: config.args,
        env: config.env ? { ...config.env } : undefined,
        cwd: projectDir,
      };
    } else if (config.url) {
      result[serverName] = {
        type: 'http',
        url: config.url,
        headers: config.headers ? { ...config.headers } : undefined,
      };
    }
  }

  return result;
}

function transformCursorTool(cursorToolName: string, cursorArgs: Record<string, unknown>): TransformedTool {
  switch (cursorToolName) {
    case 'shell': {
      const args = cursorArgs as { command: string; workingDirectory?: string; timeout?: number };
      return {
        serverName: POWER_TOOL_SERVER_NAME,
        toolName: 'bash',
        fullToolName: powerToolName('bash'),
        input: { command: args.command, cwd: args.workingDirectory, timeout: args.timeout },
      };
    }
    case 'read': {
      const args = cursorArgs as { path: string };
      return {
        serverName: POWER_TOOL_SERVER_NAME,
        toolName: 'file_read',
        fullToolName: powerToolName('file_read'),
        input: { filePath: args.path },
      };
    }
    case 'write': {
      const args = cursorArgs as { path: string; fileText: string; returnFileContentAfterWrite?: boolean };
      return {
        serverName: POWER_TOOL_SERVER_NAME,
        toolName: 'file_write',
        fullToolName: powerToolName('file_write'),
        input: { filePath: args.path, content: args.fileText, mode: 'overwrite' },
      };
    }
    case 'edit': {
      const args = cursorArgs as { path: string };
      return {
        serverName: POWER_TOOL_SERVER_NAME,
        toolName: 'file_edit',
        fullToolName: powerToolName('file_edit'),
        input: { filePath: args.path },
      };
    }
    case 'glob': {
      const args = cursorArgs as { globPattern: string; targetDirectory?: string };
      return {
        serverName: POWER_TOOL_SERVER_NAME,
        toolName: 'glob',
        fullToolName: powerToolName('glob'),
        input: { pattern: args.globPattern, cwd: args.targetDirectory },
      };
    }
    case 'grep': {
      const args = cursorArgs as {
        pattern: string;
        path?: string;
        glob?: string;
        context?: number;
        caseInsensitive?: boolean;
        headLimit?: number;
      };
      return {
        serverName: POWER_TOOL_SERVER_NAME,
        toolName: 'grep',
        fullToolName: powerToolName('grep'),
        input: {
          searchTerm: args.pattern,
          filePattern: args.glob ?? '**/*',
          contextLines: args.context ?? 0,
          caseSensitive: !args.caseInsensitive,
          maxResults: args.headLimit ?? 50,
        },
      };
    }
    case 'mcp': {
      const args = cursorArgs as { providerIdentifier: string; toolName: string; args?: Record<string, unknown> };
      return {
        serverName: args.providerIdentifier,
        toolName: args.toolName,
        fullToolName: `${args.providerIdentifier}${TOOL_SEPARATOR}${args.toolName}`,
        input: args.args ?? {},
      };
    }
    default:
      return {
        serverName: CURSOR_SERVER_NAME,
        toolName: cursorToolName,
        fullToolName: cursorToolId(cursorToolName),
        input: cursorArgs,
      };
  }
}

function extractResultValue(cursorResult: unknown): unknown {
  if (cursorResult && typeof cursorResult === 'object' && 'value' in cursorResult) {
    return (cursorResult as { value: unknown }).value;
  }
  return cursorResult;
}

function transformCursorResult(
  cursorToolName: string,
  cursorResult: unknown,
  status: string,
  cursorArgs?: Record<string, unknown>,
): TransformedResult {
  if (status === 'error') {
    const errorStr = cursorResult && typeof cursorResult === 'object' && 'error' in cursorResult
      ? String((cursorResult as { error: unknown }).error)
      : String(cursorResult ?? '');
    return { resultStr: errorStr, output: { type: 'error-text', value: errorStr } };
  }

  const value = extractResultValue(cursorResult);

  switch (cursorToolName) {
    case 'shell': {
      const v = value as { stdout: string; stderr: string; exitCode: number; executionTime: number };
      const transformed = { stdout: v?.stdout ?? '', stderr: v?.stderr ?? '', exitCode: v?.exitCode ?? 0 };
      const str = JSON.stringify(transformed);
      return { resultStr: str, output: { type: 'json', value: str } };
    }
    case 'read': {
      const v = value as { content: string; totalLines: number; fileSize: number } | undefined;
      const content = typeof v === 'string' ? v : (v?.content ?? '');
      return { resultStr: JSON.stringify(content), output: { type: 'text', value: content } };
    }
    case 'write': {
      const v = value as { path: string; linesCreated: number; fileSize: number };
      const str = v ? `Successfully wrote to '${v.path}' (${v.linesCreated} lines, ${v.fileSize} bytes)` : 'Write completed';
      return { resultStr: JSON.stringify(str), output: { type: 'text', value: str } };
    }
    case 'edit': {
      const v = value as { linesAdded?: number; linesRemoved?: number; diffString?: string };
      const str = v?.diffString ?? JSON.stringify(v ?? {});
      return { resultStr: str, output: { type: 'text', value: str } };
    }
    case 'glob': {
      const v = value as { files: string[]; totalFiles: number };
      const files = v?.files ?? [];
      return { resultStr: JSON.stringify(files), output: { type: 'json', value: files } };
    }
    case 'grep': {
      const v = value as {
        workspaceResults?: Record<string, {
          type: 'content' | 'files';
          output?: {
            matches?: Array<{
              file: string;
              line?: string;
              lineNumber?: number;
              beforeContext?: string[];
              afterContext?: string[];
            }> | Array<{ file: string }>;
            totalMatches?: number;
            files?: string[];
            count?: number;
          };
        }>;
      };

      const workspaceResults = v?.workspaceResults;
      if (!workspaceResults || Object.keys(workspaceResults).length === 0) {
        const noResults = 'No matches found.';
        return { resultStr: JSON.stringify(noResults), output: { type: 'text', value: noResults } };
      }

      const grepPattern = (cursorArgs?.pattern as string) ?? '';
      const grepFilePattern = (cursorArgs?.glob as string) ?? '**/*';

      const allMatches: Array<{
        filePath: string;
        lineNumber: number;
        lineContent: string;
        context?: string[];
      }> = [];

      for (const [, result] of Object.entries(workspaceResults)) {
        if (result.type === 'files') {
          const files = result.output?.files ?? [];
          for (const filePath of files) {
            allMatches.push({ filePath, lineNumber: 0, lineContent: '' });
          }
        } else if (result.type === 'content' && result.output?.matches) {
          for (const match of result.output.matches) {
            if ('line' in match && match.line !== undefined) {
              const lineContent = match.line ?? '';
              const context: string[] = [];
              if (match.beforeContext) {
                context.push(...match.beforeContext);
              }
              if (lineContent) {
                context.push(lineContent);
              }
              if (match.afterContext) {
                context.push(...match.afterContext);
              }
              allMatches.push({
                filePath: match.file,
                lineNumber: match.lineNumber ?? 0,
                lineContent,
                context: context.length > 1 ? context : undefined,
              });
            } else {
              allMatches.push({ filePath: match.file, lineNumber: 0, lineContent: '' });
            }
          }
        }
      }

      if (allMatches.length === 0) {
        const noResults = 'No matches found.';
        return { resultStr: JSON.stringify(noResults), output: { type: 'text', value: noResults } };
      }

      const grouped: Record<string, typeof allMatches> = {};
      for (const r of allMatches) {
        if (!grouped[r.filePath]) {
          grouped[r.filePath] = [];
        }
        grouped[r.filePath].push(r);
      }

      const lines: string[] = [];
      lines.push(`## Grep Results: \`${grepPattern}\` in \`${grepFilePattern}\` (${allMatches.length} matches)`);
      lines.push('');

      for (const [filePath, matches] of Object.entries(grouped)) {
        lines.push(`### ${filePath} (${matches.length} ${matches.length === 1 ? 'match' : 'matches'})`);
        for (const match of matches) {
          if (match.lineContent) {
            const escapedContent = match.lineContent.replace(/`/g, '\\`');
            lines.push(`- **L${match.lineNumber}:** \`${escapedContent}\``);
            if (match.context && match.context.length > 0) {
              lines.push('  ```');
              for (const ctxLine of match.context) {
                lines.push(`  ${ctxLine}`);
              }
              lines.push('  ```');
            }
          } else {
            lines.push('- **L0:** `(file match)`');
          }
        }
        lines.push('');
      }

      const str = lines.join('\n');
      return { resultStr: JSON.stringify(str), output: { type: 'text', value: str } };
    }
    case 'mcp': {
      const rawValue = extractResultValue(cursorResult);
      const str = rawValue !== undefined
        ? typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue)
        : undefined;
      return {
        resultStr: str,
        output: str ? { type: 'text', value: str } : { type: 'text', value: '' },
      };
    }
    default: {
      const str = cursorResult !== undefined
        ? typeof cursorResult === 'string' ? cursorResult : JSON.stringify(cursorResult)
        : undefined;
      return {
        resultStr: str,
        output: str ? { type: 'text', value: str } : { type: 'text', value: '' },
      };
    }
  }
}

const configComponentJsx = readFileSync(join(__dirname, './ConfigComponent.jsx'), 'utf-8');

export default class CursorSdkExtension implements Extension {
  static metadata = {
    name: 'Cursor SDK',
    version: '1.6.0',
    description: 'Integrates the Cursor SDK as a provider with cursor/ prefix, overriding the agent loop',
    author: 'wladimiiir',
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/cursor-sdk/icon.png',
    capabilities: ['providers', 'agent-loop'],
  };

  private configPath = join(__dirname, 'config.json');
  private activeRuns = new Map<string, Run>();

  private loadConfig(): CursorConfig {
    try {
      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch {
      // Ignore errors
    }
    return { apiKey: '' };
  }

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('Cursor SDK extension loaded', 'info');
  }

  async onUnload(): Promise<void> {
    for (const run of this.activeRuns.values()) {
      if (run.supports('cancel')) {
        await run.cancel().catch(() => {});
      }
    }
    this.activeRuns.clear();
  }

  getProviders(_context: ExtensionContext): ProviderDefinition[] {
    return [
      {
        id: CURSOR_PROVIDER_NAME,
        name: CURSOR_PROVIDER_NAME,
        provider: { name: CURSOR_PROVIDER_NAME },
        strategy: {
          createLlm: () => ({}),
          loadModels: async (profile, _settings): Promise<LoadModelsResponse> => {
            const config = this.loadConfig();
            const apiKey = config.apiKey || process.env.CURSOR_API_KEY;
            if (!apiKey) {
              return { models: [], success: false, error: 'CURSOR_API_KEY not configured' };
            }
            try {
              const cursorModels = await Cursor.models.list({ apiKey });
              const models: Model[] = cursorModels.map((m) => ({
                id: `${CURSOR_PROVIDER_NAME}/${m.id}`,
                providerId: profile.id,
              }));
              return { models, success: true };
            } catch (err) {
              return {
                models: [],
                success: false,
                error: err instanceof Error ? err.message : String(err),
              };
            }
          },
        },
      },
    ];
  }

  async onAgentStarted(
    event: AgentStartedEvent,
    context: ExtensionContext,
  ): Promise<void | Partial<AgentStartedEvent>> {
    if (!event.providerProfile.name.startsWith(CURSOR_PROVIDER_NAME)) {
      return undefined;
    }

    const taskContext = context.getTaskContext();
    if (!taskContext) {
      return undefined;
    }

    const prompt = event.prompt || 'Continue where you left off.';
    if (!event.prompt) {
      context.log('Resuming Cursor agent with continuation prompt', 'info');
    }

    const config = this.loadConfig();
    const apiKey = config.apiKey || process.env.CURSOR_API_KEY;
    if (!apiKey) {
      taskContext.addLogMessage(
        'error',
        'Cursor SDK: CURSOR_API_KEY not configured. Set it in extension settings or environment.',
      );
      return { blocked: true };
    }

    const taskId = taskContext.data.id;
    const modelId = event.model.replace(`${CURSOR_PROVIDER_NAME}/`, '');
    const projectDir = taskContext.getTaskDir();

    const mcpServers = await this.buildMcpServersConfig(event.agentProfile.enabledServers, projectDir, context);
    if (mcpServers && Object.keys(mcpServers).length > 0) {
      context.log(`Passing ${Object.keys(mcpServers).length} MCP server(s) to Cursor agent: ${Object.keys(mcpServers).join(', ')}`, 'info');
    }

    const agentOptions = {
      apiKey,
      model: { id: modelId },
      local: { cwd: projectDir },
      ...(mcpServers && Object.keys(mcpServers).length > 0 ? { mcpServers } : {}),
    };

    let agent: SDKAgent | undefined;
    const existingAgentId = taskContext.data.metadata?.[AGENT_ID_METADATA_KEY] as string | undefined;

    try {
      if (existingAgentId) {
        context.log(`Resuming Cursor agent: ${existingAgentId}`, 'info');
        agent = await Agent.resume(existingAgentId, agentOptions);
      } else {
        context.log('Creating new Cursor agent', 'info');
        agent = await Agent.create(agentOptions);

        await taskContext.updateTask({
          metadata: { ...taskContext.data.metadata, [AGENT_ID_METADATA_KEY]: agent.agentId },
        });
      }

      const run = await agent.send(prompt);
      context.log(`Cursor run started: ${run.id}`, 'info');

      this.activeRuns.set(taskId, run);

      taskContext.addLoadingMessage('Running Cursor agent...');

      const contextMessages = await processStream(run, taskContext, context);

      const result = await run.wait();
      context.log(`Cursor run finished: ${result.status}`, 'info');

      if (prompt) {
        const userMessage: ContextUserMessage = {
          id: `user-${run.id}`,
          role: 'user',
          content: prompt,
        };
        await taskContext.addContextMessage(userMessage);
      }

      for (const contextMessage of contextMessages) {
        await taskContext.addContextMessage(contextMessage);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      context.log(`Cursor agent error: ${message}`, 'error');
      taskContext.addLogMessage('error', `Cursor SDK error: ${message}`);
    } finally {
      this.activeRuns.delete(taskId);
      taskContext.addLoadingMessage(undefined, true);

      if (agent) {
        try {
          await agent[Symbol.asyncDispose]();
        } catch {
          // Ignore disposal errors
        }
      }
    }

    return { blocked: true };
  }

  async onInterrupted(
    event: InterruptedEvent,
    context: ExtensionContext,
  ): Promise<void | Partial<InterruptedEvent>> {
    const taskContext = context.getTaskContext();
    if (!taskContext) {
      return undefined;
    }

    const taskId = taskContext.data.id;
    const run = this.activeRuns.get(taskId);
    if (run) {
      context.log(`Interrupting Cursor agent for task ${taskId}`, 'info');

      if (run.supports('cancel')) {
        await run.cancel();
      }

      await taskContext.updateTask({
        state: 'INTERRUPTED',
        interruptedAt: new Date().toISOString(),
        metadata: { ...taskContext.data.metadata, [AGENT_ID_METADATA_KEY]: undefined },
      });

      return { blocked: true };
    }

    return undefined;
  }

  private async buildMcpServersConfig(
    enabledServers: string[],
    projectDir: string,
    context: ExtensionContext,
  ): Promise<Record<string, CursorMcpServerConfig> | null> {
    if (enabledServers.length === 0) return null;

    try {
      const allMcpServers = await context.getSetting('mcpServers') as Record<string, AiderDeskMcpServerConfig> | undefined;
      if (!allMcpServers || Object.keys(allMcpServers).length === 0) return null;

      return toCursorMcpServers(allMcpServers, enabledServers, projectDir);
    } catch (err) {
      context.log(`Failed to load MCP servers config: ${err instanceof Error ? err.message : String(err)}`, 'warn');
      return null;
    }
  }

  getConfigComponent(): string {
    return configComponentJsx;
  }

  async getConfigData(): Promise<CursorConfig> {
    return this.loadConfig();
  }

  async saveConfigData(configData: unknown): Promise<unknown> {
    const config = configData as Partial<CursorConfig>;
    const merged = { ...this.loadConfig(), ...config };
    writeFileSync(this.configPath, JSON.stringify(merged, null, 2), 'utf-8');
    return merged;
  }
}

const THINKING_TAG = '---\n► **THINKING**\n';
const ANSWER_TAG = '---\n► **ANSWER**\n';

type AssistantContentPart = ReasoningPart | TextPart | ToolCallPart;

async function processStream(run: Run, taskContext: TaskContext, context: ExtensionContext): Promise<ContextMessage[]> {
  const contextMessages: ContextMessage[] = [];

  let currentAssistantMessage: ContextAssistantMessage | null = null;
  let hasActiveReasoning = false;
  let responseCounter = 0;

  const generateResponseId = () => `${run.id}-${responseCounter++}`;

  const getParts = (msg: ContextAssistantMessage): AssistantContentPart[] =>
    msg.content as AssistantContentPart[];

  const hasToolCallParts = (msg: ContextAssistantMessage): boolean =>
    getParts(msg).some((p): p is ToolCallPart => p.type === 'tool-call');

  const hasToolCallPart = (msg: ContextAssistantMessage, callId: string): boolean =>
    getParts(msg).some((p): p is ToolCallPart => p.type === 'tool-call' && p.toolCallId === callId);

  const appendText = (msg: ContextAssistantMessage, text: string) => {
    const parts = getParts(msg);
    const last = parts[parts.length - 1];
    if (last && last.type === 'text') {
      last.text += text;
    } else {
      parts.push({ type: 'text', text });
    }
  };

  const appendReasoning = (msg: ContextAssistantMessage, text: string) => {
    const parts = getParts(msg);
    const last = parts[parts.length - 1];
    if (last && last.type === 'reasoning') {
      last.text += text;
    } else {
      parts.push({ type: 'reasoning', text });
    }
  };

  const extractReasoningText = (parts: AssistantContentPart[]): string =>
    parts.filter((p): p is ReasoningPart => p.type === 'reasoning').map((p) => p.text).join('');

  const extractText = (parts: AssistantContentPart[]): string =>
    parts.filter((p): p is TextPart => p.type === 'text').map((p) => p.text).join('');

  const ensureAssistantMessage = (): ContextAssistantMessage => {
    if (!currentAssistantMessage) {
      currentAssistantMessage = {
        id: generateResponseId(),
        role: 'assistant',
        content: [],
      };
      contextMessages.push(currentAssistantMessage);
    }
    return currentAssistantMessage;
  };

  const finishCurrentMessage = async () => {
    if (!currentAssistantMessage) return;

    const parts = getParts(currentAssistantMessage);
    if (parts.length === 0) {
      const idx = contextMessages.lastIndexOf(currentAssistantMessage);
      if (idx !== -1) contextMessages.splice(idx, 1);
      currentAssistantMessage = null;
      hasActiveReasoning = false;
      return;
    }

    const reasoning = extractReasoningText(parts).trim();
    const text = extractText(parts).trim();

    if (reasoning || text) {
      const finishedContent = reasoning && text
        ? `${THINKING_TAG}${reasoning}${ANSWER_TAG}${text}`
        : reasoning
          ? `${THINKING_TAG}${reasoning}`
          : text;

      await taskContext.addResponseMessage({ id: currentAssistantMessage.id, content: finishedContent, finished: true }, true);
    }

    currentAssistantMessage = null;
    hasActiveReasoning = false;
  };

  for await (const message of run.stream()) {
    switch (message.type) {
      case 'thinking': {
        if (currentAssistantMessage) {
          const text = extractText(getParts(currentAssistantMessage)).trim();
          if (text || hasToolCallParts(currentAssistantMessage)) {
            await finishCurrentMessage();
          }
        }

        const msg = ensureAssistantMessage();
        appendReasoning(msg, message.text);

        if (!hasActiveReasoning) {
          hasActiveReasoning = true;
          await taskContext.addResponseMessage({
            id: msg.id,
            content: THINKING_TAG,
            finished: false,
          });
        }

        await taskContext.addResponseMessage({
          id: msg.id,
          content: message.text,
          finished: false,
        });
        break;
      }

      case 'task': {
        if (message.text) {
          taskContext.addLogMessage('info', message.status ? `${message.status}: ${message.text}` : message.text);
        }
        break;
      }

      case 'assistant': {
        for (const block of message.message.content) {
          if (block.type === 'text') {
            if (currentAssistantMessage && hasToolCallParts(currentAssistantMessage)) {
              await finishCurrentMessage();
            }

            const msg = ensureAssistantMessage();

            if (hasActiveReasoning) {
              await taskContext.addResponseMessage({
                id: msg.id,
                content: ANSWER_TAG,
                finished: false,
              });
              hasActiveReasoning = false;
            }

            appendText(msg, block.text);

            await taskContext.addResponseMessage({
              id: msg.id,
              content: block.text,
              finished: false,
            });
          } else if (block.type === 'tool_use') {
            const msg = ensureAssistantMessage();
            const transformed = transformCursorTool(block.name, block.input as Record<string, unknown>);
            getParts(msg).push({
              type: 'tool-call',
              toolCallId: block.id,
              toolName: transformed.fullToolName,
              input: transformed.input,
            });

            taskContext.addToolMessage(block.id, transformed.serverName, transformed.toolName, transformed.input, undefined, undefined, undefined, false, false);
          }
        }
        break;
      }

      case 'tool_call': {
        ensureAssistantMessage();

        const finished =
          message.status === "completed" || message.status === "error";

        if (message.name === 'edit' && finished) {
          const diffResult = message.result as { value?: { diffString?: string } } | undefined;
          const diffString = diffResult?.value?.diffString;
          const editArgs = (message.args ?? {}) as { path: string };

          if (diffString) {
            const edits = parseUnifiedDiff(diffString, editArgs.path ?? '');

            if (edits.length > 0) {
              const parts = getParts(currentAssistantMessage);
              const originalIdx = parts.findIndex(
                (p): p is ToolCallPart => p.type === 'tool-call' && p.toolCallId === message.call_id,
              );
              if (originalIdx !== -1) {
                parts.splice(originalIdx, 1);
              }

              const fileEditFullName = powerToolName('file_edit');

              for (let i = 0; i < edits.length; i++) {
                const edit = edits[i];
                const editId = edits.length === 1 ? message.call_id : `${message.call_id}-${i}`;
                const editInput = { filePath: edit.filePath, searchTerm: edit.searchTerm, replacementText: edit.replacementText };
                const resultStr = `Successfully edited '${edit.filePath}'.`;

                parts.push({
                  type: "tool-call",
                  toolCallId: editId,
                  toolName: fileEditFullName,
                  input: editInput,
                });

                taskContext.addToolMessage(
                  editId,
                  POWER_TOOL_SERVER_NAME,
                  'file_edit',
                  editInput,
                  JSON.stringify(resultStr),
                  undefined,
                  undefined,
                  true,
                  true,
                );

                contextMessages.push({
                  id: editId,
                  role: "tool",
                  content: [
                    {
                      type: "tool-result",
                      toolCallId: editId,
                      toolName: fileEditFullName,
                      output: { type: "text", value: resultStr },
                    },
                  ],
                } as ContextToolMessage);

                await taskContext.addToGit(resolve(taskContext.getTaskDir(), edit.filePath));
              }

              break;
            }
          }
        }

        const transformed = transformCursorTool(message.name, (message.args ?? {}) as Record<string, unknown>);

        if (!hasToolCallPart(currentAssistantMessage, message.call_id)) {
          getParts(currentAssistantMessage).push({
            type: "tool-call",
            toolCallId: message.call_id,
            toolName: transformed.fullToolName,
            input: transformed.input,
          });
        }

        const transformedResult = finished
          ? transformCursorResult(message.name, message.result, message.status ?? 'success', (message.args ?? {}) as Record<string, unknown>)
          : null;

        taskContext.addToolMessage(
          message.call_id,
          transformed.serverName,
          transformed.toolName,
          transformed.input,
          transformedResult?.resultStr ?? undefined,
          undefined,
          undefined,
          finished,
          finished,
        );

        if (finished && transformedResult) {
          contextMessages.push({
            id: message.call_id,
            role: "tool",
            content: [
              {
                type: "tool-result",
                toolCallId: message.call_id,
                toolName: transformed.fullToolName,
                output: transformedResult.output,
              },
            ],
          } as ContextToolMessage);

          if (message.name === 'write' || message.name === 'edit') {
            const toolArgs = (message.args ?? {}) as { path: string };
            if (toolArgs.path) {
              await taskContext.addToGit(resolve(taskContext.getTaskDir(), toolArgs.path));
            }
          }
        }
        break;
      }
    }
  }

  await finishCurrentMessage();

  return contextMessages;
}
