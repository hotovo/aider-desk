import { request as httpRequest, type IncomingMessage } from 'http';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Readable, Writable } from 'node:stream';

import * as acp from '@agentclientprotocol/sdk';
import { Command } from 'commander';

import { DEFAULT_HOST, DEFAULT_PORT, pkgRoot, resolvePort } from '../constants';

function getVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'));
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

type EventData = {
  baseDir?: string;
  taskId?: string;
  id?: string;
  chunk?: string;
  messageId?: string;
  reasoning?: string;
  content?: string;
  finished?: boolean;
  toolName?: string;
  toolCallId?: string;
  response?: string;
  error?: string;
  args?: unknown;
  level?: string;
  message?: string;
  question?: string;
  name?: string;
  state?: string;
  provider?: string;
  model?: string;
  usageReport?: UsageReportData;
};

type UsageReportData = {
  model?: string;
  sentTokens?: number;
  receivedTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  agentTotalCost?: number;
};

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function fetchJSON(host: string, port: number, path: string, method: string, body?: string): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: host,
      port,
      path,
      method,
      headers: body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : undefined,
    };

    const req = httpRequest(options, (res: IncomingMessage) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8');
        try {
          const data = JSON.parse(raw);
          resolve({ status: res.statusCode ?? 500, data });
        } catch {
          resolve({ status: res.statusCode ?? 500, data: raw });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10_000, () => {
      req.destroy(new Error('Request timed out'));
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

function callInterrupt(host: string, port: number, projectDir: string, taskId: string): Promise<void> {
  const body = JSON.stringify({ projectDir, taskId });
  return fetchJSON(host, port, '/api/project/interrupt', 'POST', body).then(() => undefined);
}

type SSEStreamResult = {
  stream: IncomingMessage;
  taskId: string;
};

function requestSSEStream(host: string, port: number, body: string): Promise<SSEStreamResult> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: host,
      port,
      path: '/api/run-prompt',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = httpRequest(options, (res: IncomingMessage) => {
      if (res.statusCode !== 200) {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8');
          reject(new Error(`Server returned ${res.statusCode}: ${raw}`));
        });
        return;
      }

      const taskId = (res.headers['x-task-id'] as string | undefined) ?? '';
      resolve({ stream: res, taskId });
    });

    req.on('error', reject);
    req.setTimeout(600_000, () => {
      req.destroy(new Error('Request timed out'));
    });

    req.write(body);
    req.end();
  });
}

type SSEEvent = { type: string; data: string };

function parseSSEEvents(stream: IncomingMessage): AsyncIterable<SSEEvent> {
  const events: SSEEvent[] = [];
  let resolveNext: (() => void) | null = null;
  let streamEnded = false;
  let streamError: Error | null = null;

  let buffer = '';
  let currentEventType = '';
  let currentDataLines: string[] = [];

  const flushEvent = () => {
    if (currentDataLines.length > 0) {
      events.push({
        type: currentEventType || 'message',
        data: currentDataLines.join('\n'),
      });
      currentEventType = '';
      currentDataLines = [];
    }
  };

  stream.on('data', (chunk: Buffer) => {
    buffer += chunk.toString('utf-8');
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.startsWith(':')) {
        continue;
      }
      if (line.trim() === '') {
        flushEvent();
        continue;
      }
      if (line.startsWith('event:')) {
        currentEventType = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        currentDataLines.push(line.slice(5).trimStart());
      }
    }

    if (resolveNext) {
      resolveNext();
      resolveNext = null;
    }
  });

  stream.on('close', () => {
    streamEnded = true;
    flushEvent();
    if (resolveNext) {
      resolveNext();
      resolveNext = null;
    }
  });

  stream.on('error', (err: Error) => {
    streamError = err;
    streamEnded = true;
    if (resolveNext) {
      resolveNext();
      resolveNext = null;
    }
  });

  return {
    [Symbol.asyncIterator]() {
      return {
        async next(): Promise<IteratorResult<SSEEvent>> {
          while (events.length === 0) {
            if (streamEnded) {
              if (streamError) {
                throw streamError;
              }
              return { value: undefined as unknown as SSEEvent, done: true };
            }
            const d = createDeferred<void>();
            resolveNext = d.resolve;
            await d.promise;
            resolveNext = null;
          }
          const event = events.shift()!;
          return { value: event, done: false };
        },
      };
    },
  };
}

function parseEventData(raw: string): EventData | undefined {
  try {
    return JSON.parse(raw) as EventData;
  } catch {
    return undefined;
  }
}

const TOOL_KIND_MAP: Record<string, acp.ToolKind> = {
  read: 'read',
  list: 'read',
  view: 'read',
  get: 'read',
  edit: 'edit',
  write: 'edit',
  create: 'edit',
  modify: 'edit',
  store: 'edit',
  update: 'edit',
  delete: 'delete',
  remove: 'delete',
  move: 'move',
  rename: 'move',
  search: 'search',
  find: 'search',
  grep: 'search',
  glob: 'search',
  retrieve: 'search',
  exec: 'execute',
  run: 'execute',
  command: 'execute',
  bash: 'execute',
  think: 'think',
  plan: 'think',
  fetch: 'fetch',
  download: 'fetch',
};

function inferToolKind(toolName: string): acp.ToolKind {
  const name = toolName.toLowerCase();
  for (const [pattern, kind] of Object.entries(TOOL_KIND_MAP)) {
    if (name.includes(pattern)) {
      return kind;
    }
  }
  return 'other';
}

type ToolArgs = {
  filePath?: string;
  searchTerm?: string;
  replacementText?: string;
  content?: string;
  mode?: string;
  query?: string;
  pattern?: string;
  filePattern?: string;
  command?: string;
  url?: string;
  [key: string]: unknown;
};

function parseToolArgs(args: unknown): ToolArgs {
  if (args && typeof args === 'object') {
    return args as ToolArgs;
  }
  if (typeof args === 'string') {
    try {
      return JSON.parse(args) as ToolArgs;
    } catch {
      return {};
    }
  }
  return {};
}

function extractFilePath(toolName: string, args: ToolArgs): string | undefined {
  if (args.filePath) {
    return String(args.filePath);
  }
  if (args.path) {
    return String(args.path);
  }
  if (toolName === 'bash' && args.command) {
    return undefined;
  }
  return undefined;
}

function formatToolInputAsText(toolName: string, args: ToolArgs): string {
  const parts: string[] = [];

  if (args.filePath) {
    parts.push(`File: ${args.filePath}`);
  }
  if (args.url) {
    parts.push(`URL: ${args.url}`);
  }
  if (args.query) {
    parts.push(`Query: ${args.query}`);
  }
  if (args.pattern) {
    parts.push(`Pattern: ${args.pattern}`);
  }
  if (args.filePattern) {
    parts.push(`Files: ${args.filePattern}`);
  }
  if (args.searchTerm) {
    parts.push(`Search: ${args.searchTerm}`);
  }
  if (args.command) {
    parts.push(`Command: ${args.command}`);
  }
  if (args.type) {
    parts.push(`Type: ${args.type}`);
  }
  if (args.limit !== undefined) {
    parts.push(`Limit: ${args.limit}`);
  }

  const knownKeys = new Set([
    'filePath',
    'path',
    'url',
    'query',
    'pattern',
    'filePattern',
    'searchTerm',
    'command',
    'type',
    'limit',
    'searchTerm',
    'replacementText',
    'content',
    'mode',
    'isRegex',
    'replaceAll',
    'withLines',
    'lineOffset',
    'lineLimit',
    'caseSensitive',
    'maxResults',
    'cwd',
    'ignore',
    'allowTests',
    'exact',
    'timeout',
    'language',
    'id',
  ]);

  for (const [key, value] of Object.entries(args)) {
    if (!knownKeys.has(key) && value !== undefined) {
      const valStr = typeof value === 'string' && value.length > 200 ? value.slice(0, 200) + '...' : String(value);
      parts.push(`${key}: ${valStr}`);
    }
  }

  return parts.join('\n');
}

function formatToolTitle(toolName: string, args: ToolArgs): string {
  const truncate = (s: string, max: number) => (s.length > max ? s.slice(0, max) + '...' : s);

  switch (toolName) {
    case 'grep':
      return args.searchTerm ? `Grep: "${truncate(args.searchTerm, 60)}"${args.filePattern ? ` in ${args.filePattern}` : ''}` : 'Grep';
    case 'glob':
      return args.pattern ? `Glob: ${truncate(args.pattern, 80)}` : 'Glob';
    case 'semantic_search':
      return args.query ? `Semantic Search: ${truncate(args.query, 80)}` : 'Semantic Search';
    case 'bash':
      return args.command ? `Bash: ${truncate(args.command, 80)}` : 'Bash';
    case 'file_read':
      return args.filePath ? `Read: ${args.filePath}` : 'Read File';
    case 'file_edit':
      return args.filePath ? `Edit: ${args.filePath}` : 'Edit File';
    case 'file_write':
      return args.filePath ? `Write: ${args.filePath}` : 'Write File';
    case 'fetch':
      return args.url ? `Fetch: ${truncate(args.url, 80)}` : 'Fetch';
    default:
      return toolName.charAt(0).toUpperCase() + toolName.slice(1);
  }
}

function parseToolResponse(response: string): unknown {
  if (!response) {
    return undefined;
  }
  try {
    return JSON.parse(response);
  } catch {
    return response;
  }
}

function isToolFailed(toolName: string, responseData: unknown): boolean {
  if (typeof responseData === 'string') {
    return (
      responseData.toLowerCase().startsWith('error') ||
      responseData.toLowerCase().includes('failed') ||
      responseData.toLowerCase().includes('denied') ||
      responseData.toLowerCase().includes('cancelled')
    );
  }
  return false;
}

function buildToolCallContentArray(toolName: string, args: ToolArgs, responseData: unknown): acp.ToolCallContent[] {
  const content: acp.ToolCallContent[] = [];

  if (toolName === 'file_edit' && args.filePath && args.searchTerm !== undefined && args.replacementText !== undefined) {
    content.push({
      type: 'diff',
      path: args.filePath,
      oldText: args.searchTerm,
      newText: args.replacementText,
    });
    if (typeof responseData === 'string' && responseData.includes('Successfully')) {
      content.push({
        type: 'content',
        content: { type: 'text', text: responseData },
      });
    }
    return content;
  }

  if (toolName === 'file_write' && args.filePath) {
    content.push({
      type: 'diff',
      path: args.filePath,
      oldText: null,
      newText: args.content ?? '',
    });
    if (typeof responseData === 'string' && responseData.includes('Successfully')) {
      content.push({
        type: 'content',
        content: { type: 'text', text: responseData },
      });
    }
    return content;
  }

  if (toolName === 'file_read' && typeof responseData === 'string') {
    content.push({
      type: 'content',
      content: { type: 'text', text: responseData },
    });
    return content;
  }

  if (toolName === 'bash' && typeof responseData === 'string') {
    content.push({
      type: 'terminal',
      terminalId: args._terminalId ?? 'default',
    });
    content.push({
      type: 'content',
      content: { type: 'text', text: responseData },
    });
    return content;
  }

  if (toolName === 'grep') {
    const text =
      typeof responseData === 'string' && responseData
        ? responseData
        : typeof responseData === 'string' && responseData === ''
          ? 'No matches found.'
          : JSON.stringify(responseData, null, 2);
    content.push({
      type: 'content',
      content: { type: 'text', text },
    });
    return content;
  }

  if (toolName === 'glob') {
    let text: string;
    if (Array.isArray(responseData)) {
      if (responseData.length === 0) {
        text = 'No files found.';
      } else {
        text =
          `Found ${responseData.length} ${responseData.length === 1 ? 'file' : 'files'}:\n` +
          responseData.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join('\n');
      }
    } else if (typeof responseData === 'string' && responseData) {
      text = responseData;
    } else if (typeof responseData === 'object' && responseData !== null) {
      text = JSON.stringify(responseData, null, 2);
    } else {
      text = 'No files found.';
    }
    content.push({
      type: 'content',
      content: { type: 'text', text },
    });
    return content;
  }

  if (toolName === 'semantic_search') {
    let text: string;
    if (typeof responseData === 'string' && responseData) {
      text = responseData;
    } else if (typeof responseData === 'object' && responseData !== null) {
      text = JSON.stringify(responseData, null, 2);
    } else {
      text = 'No results found.';
    }
    content.push({
      type: 'content',
      content: { type: 'text', text },
    });
    return content;
  }

  if (Array.isArray(responseData)) {
    const text = responseData.map((item) => (typeof item === 'string' ? item : JSON.stringify(item, null, 2))).join('\n');
    if (text) {
      content.push({
        type: 'content',
        content: { type: 'text', text },
      });
    }
    return content;
  }

  if (typeof responseData === 'object' && responseData !== null) {
    content.push({
      type: 'content',
      content: { type: 'text', text: JSON.stringify(responseData, null, 2) },
    });
    return content;
  }

  if (typeof responseData === 'string' && responseData) {
    content.push({
      type: 'content',
      content: { type: 'text', text: responseData },
    });
  }

  return content;
}

function contentBlocksToPrompt(blocks: acp.ContentBlock[]): { prompt: string; images: string[] } {
  const parts: string[] = [];
  const images: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case 'text':
        parts.push(block.text);
        break;
      case 'image':
        if (block.data) {
          images.push(block.data);
        }
        break;
      case 'resource': {
        const resource = block.resource;
        if (resource && 'text' in resource && resource.text) {
          parts.push(resource.text);
        }
        break;
      }
      case 'resource_link':
        parts.push(`@${block.name || block.uri}`);
        break;
    }
  }

  return { prompt: parts.join('\n\n'), images };
}

function generateSessionId(): string {
  return `acp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

type AgentProfileInfo = {
  id: string;
  name: string;
};

type ModeOption = {
  id: string;
  name: string;
  description?: string;
};

const BUILT_IN_MODES: ModeOption[] = [
  { id: 'agent', name: 'Agent', description: 'Agent mode with full tool access' },
  { id: 'code', name: 'Code', description: 'Code mode using Aider for edits' },
  { id: 'ask', name: 'Ask', description: 'Ask questions without making changes' },
  { id: 'architect', name: 'Architect', description: 'Design and plan without implementation' },
  { id: 'context', name: 'Context', description: 'Add context files to the conversation' },
];

const AIDER_MODES = ['code', 'ask', 'architect', 'context'];

const AUTONOMY_MODES: ModeOption[] = [
  { id: 'manual', name: 'Manual', description: 'Requires approval for every tool and plan' },
  { id: 'guided', name: 'Guided', description: 'Auto-approves tools, waits for plan approval' },
  { id: 'autonomous', name: 'Autonomous', description: 'Runs without interruption' },
];

const DEFAULT_MODE = 'agent';
const DEFAULT_AUTONOMY_MODE = 'guided';

function isAgentProfileVisible(mode: string): boolean {
  return !AIDER_MODES.includes(mode);
}

async function fetchAgentProfiles(host: string, port: number): Promise<AgentProfileInfo[]> {
  try {
    const response = await fetchJSON(host, port, '/api/agent-profiles', 'GET');
    if (response.status !== 200) return [];
    const profiles = response.data as AgentProfileInfo[];
    if (!Array.isArray(profiles)) return [];
    return profiles.map((p) => ({ id: p.id, name: p.name }));
  } catch {
    return [];
  }
}

async function fetchDefaultAgentProfileId(host: string, port: number, projectDir: string): Promise<string | undefined> {
  try {
    const response = await fetchJSON(host, port, `/api/project/settings?projectDir=${encodeURIComponent(projectDir)}`, 'GET');
    if (response.status !== 200) return undefined;
    const settings = response.data as { agentProfileId?: string };
    return settings?.agentProfileId;
  } catch {
    return undefined;
  }
}

function resolveDefaultProfileId(
  profiles: AgentProfileInfo[],
  projectDefault: string | undefined,
  persisted: string | undefined,
): string | undefined {
  if (projectDefault && profiles.some((p) => p.id === projectDefault)) {
    return projectDefault;
  }
  if (persisted && profiles.some((p) => p.id === persisted)) {
    return persisted;
  }
  const defaultProfile = profiles.find((p) => p.id === 'default');
  if (defaultProfile) {
    return defaultProfile.id;
  }
  return profiles[0]?.id;
}

type CustomModeDefinition = {
  name: string;
  label: string;
  description?: string;
};

async function fetchCustomModes(host: string, port: number, projectDir: string): Promise<ModeOption[]> {
  try {
    const response = await fetchJSON(host, port, `/api/project/custom-modes?projectDir=${encodeURIComponent(projectDir)}`, 'GET');
    if (response.status !== 200) return [];
    const modes = response.data as CustomModeDefinition[];
    if (!Array.isArray(modes)) return [];
    return modes.map((m) => ({ id: m.name, name: m.label, description: m.description }));
  } catch {
    return [];
  }
}

function getAllModes(customModes: ModeOption[]): ModeOption[] {
  return [...BUILT_IN_MODES, ...customModes];
}

function buildModeState(allModes: ModeOption[], currentMode: string): acp.SessionModeState {
  return {
    currentModeId: currentMode,
    availableModes: allModes.map((m) => ({
      id: m.id,
      name: m.name,
      ...(m.description ? { description: m.description } : {}),
    })),
  };
}

function buildConfigOptions(
  allModes: ModeOption[],
  agentProfiles: AgentProfileInfo[],
  currentMode: string,
  currentProfileId: string | undefined,
  currentAutonomy: string,
): acp.SessionConfigOption[] {
  const options: acp.SessionConfigOption[] = [
    {
      type: 'select',
      id: 'chat_mode',
      name: 'Mode',
      category: 'mode',
      currentValue: currentMode,
      options: allModes.map((m) => ({
        value: m.id,
        name: m.name,
        ...(m.description ? { description: m.description } : {}),
      })),
    },
  ];

  if (isAgentProfileVisible(currentMode)) {
    const profileOptions = agentProfiles.length > 0
      ? agentProfiles
      : [{ id: 'default', name: 'Default' }];
    options.push({
      type: 'select',
      id: 'agent_profile',
      name: 'Agent Profile',
      category: '_agent_profile',
      currentValue: currentProfileId ?? profileOptions[0].id,
      options: profileOptions.map((p) => ({
        value: p.id,
        name: p.name,
      })),
    });
  }

  options.push({
    type: 'select',
    id: 'autonomy_mode',
    name: 'Autonomy',
    category: '_autonomy_mode',
    currentValue: currentAutonomy,
    options: AUTONOMY_MODES.map((m) => ({
      value: m.id,
      name: m.name,
      ...(m.description ? { description: m.description } : {}),
    })),
  });

  return options;
}

type AcpSession = {
  cwd: string;
  taskId?: string;
  abortController?: AbortController;
  sseStream?: Pick<IncomingMessage, 'destroy'>;
  mode: string;
  agentProfileId?: string;
  autonomyMode: string;
  allModes: ModeOption[];
  agentProfiles: AgentProfileInfo[];
};

class AcpAgent {
  private readonly sessions = new Map<string, AcpSession>();
  private lastAgentProfileId?: string;

  constructor(
    private readonly host: string,
    private readonly port: number,
  ) {}

  async initialize(_params: acp.InitializeRequest): Promise<acp.InitializeResponse> {
    return {
      protocolVersion: acp.PROTOCOL_VERSION,
      agentCapabilities: {
        loadSession: false,
        promptCapabilities: { image: true, embeddedContext: true },
      },
      agentInfo: {
        name: 'aiderdesk',
        title: 'AiderDesk',
        version: getVersion(),
      },
      authMethods: [],
    };
  }

  async authenticate(_params: acp.AuthenticateRequest): Promise<acp.AuthenticateResponse> {
    return {};
  }

  async newSession(params: acp.NewSessionRequest): Promise<acp.NewSessionResponse> {
    const sessionId = generateSessionId();
    const cwd = params.cwd ?? '';

    const [agentProfiles, customModes, projectDefaultProfileId] = await Promise.all([
      fetchAgentProfiles(this.host, this.port),
      fetchCustomModes(this.host, this.port, cwd),
      fetchDefaultAgentProfileId(this.host, this.port, cwd),
    ]);
    const allModes = getAllModes(customModes);
    const defaultProfileId = resolveDefaultProfileId(agentProfiles, projectDefaultProfileId, this.lastAgentProfileId);

    this.sessions.set(sessionId, {
      cwd,
      mode: DEFAULT_MODE,
      agentProfileId: defaultProfileId,
      autonomyMode: DEFAULT_AUTONOMY_MODE,
      allModes,
      agentProfiles,
    });

    const configOptions = buildConfigOptions(
      allModes,
      agentProfiles,
      DEFAULT_MODE,
      defaultProfileId,
      DEFAULT_AUTONOMY_MODE,
    );

    return {
      sessionId,
      configOptions,
      modes: buildModeState(allModes, DEFAULT_MODE),
    };
  }

  async setConfigOption(params: acp.SetSessionConfigOptionRequest): Promise<acp.SetSessionConfigOptionResponse> {
    const session = this.sessions.get(params.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${params.sessionId}`);
    }

    const value = String(params.value);

    switch (params.configId) {
      case 'chat_mode':
        session.mode = value;
        break;
      case 'agent_profile':
        session.agentProfileId = value;
        this.lastAgentProfileId = value;
        break;
      case 'autonomy_mode':
        session.autonomyMode = value;
        break;
    }

    const configOptions = buildConfigOptions(
      session.allModes,
      session.agentProfiles,
      session.mode,
      session.agentProfileId,
      session.autonomyMode,
    );

    return { configOptions };
  }

  async prompt(params: acp.PromptRequest, cx: acp.AgentContext): Promise<acp.PromptResponse> {
    const session = this.sessions.get(params.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${params.sessionId}`);
    }

    const abortController = new AbortController();
    session.abortController = abortController;

    try {
      const { prompt: promptText, images } = contentBlocksToPrompt(params.prompt);

      if (!promptText && images.length === 0) {
        return { stopReason: 'end_turn' };
      }

      const requestBody: Record<string, unknown> = {
        prompt: promptText,
        projectDir: session.cwd,
        mode: session.mode,
        autonomyMode: session.autonomyMode,
      };
      if (session.taskId) {
        requestBody.taskId = session.taskId;
      }
      if (session.agentProfileId && isAgentProfileVisible(session.mode)) {
        requestBody.agentProfileId = session.agentProfileId;
      }
      if (images.length > 0) {
        requestBody.images = images;
      }

      const sseResponse = await requestSSEStream(this.host, this.port, JSON.stringify(requestBody));

      if (sseResponse.taskId && !session.taskId) {
        session.taskId = sseResponse.taskId;
      }
      session.sseStream = sseResponse.stream;

      const eventStream = parseSSEEvents(sseResponse.stream);
      let streamedReasoning = '';

      for await (const event of eventStream) {
        if (abortController.signal.aborted) {
          break;
        }

        const eventData = parseEventData(event.data);
        if (!eventData) {
          continue;
        }

        switch (event.type) {
          case 'response-chunk': {
            if (eventData.reasoning) {
              streamedReasoning += eventData.reasoning;
              await cx.notify(acp.methods.client.session.update, {
                sessionId: params.sessionId,
                update: {
                  sessionUpdate: 'agent_thought_chunk',
                  ...(eventData.messageId ? { messageId: eventData.messageId } : {}),
                  content: { type: 'text', text: eventData.reasoning },
                },
              });
            }
            if (eventData.chunk) {
              await cx.notify(acp.methods.client.session.update, {
                sessionId: params.sessionId,
                update: {
                  sessionUpdate: 'agent_message_chunk',
                  ...(eventData.messageId ? { messageId: eventData.messageId } : {}),
                  content: { type: 'text', text: eventData.chunk },
                },
              });
            }
            break;
          }

          case 'response-completed': {
            if (eventData.reasoning) {
              const remaining = eventData.reasoning.startsWith(streamedReasoning) ? eventData.reasoning.slice(streamedReasoning.length) : eventData.reasoning;
              if (remaining) {
                await cx.notify(acp.methods.client.session.update, {
                  sessionId: params.sessionId,
                  update: {
                    sessionUpdate: 'agent_thought_chunk',
                    ...(eventData.messageId ? { messageId: eventData.messageId } : {}),
                    content: { type: 'text', text: remaining },
                  },
                });
              }
              streamedReasoning = eventData.reasoning;
            }
            if (eventData.usageReport) {
              const usage = eventData.usageReport;
              await cx.notify(acp.methods.client.session.update, {
                sessionId: params.sessionId,
                update: {
                  sessionUpdate: 'usage_update',
                  used: (usage.sentTokens ?? 0) + (usage.receivedTokens ?? 0) + (usage.cacheReadTokens ?? 0),
                  size: 0,
                  ...(usage.agentTotalCost !== undefined ? { cost: { amount: usage.agentTotalCost, currency: 'USD' } } : {}),
                },
              });
            }
            break;
          }

          case 'tool': {
            const toolId = eventData.id || '';

            if (!eventData.finished) {
              const args = parseToolArgs(eventData.args);
              const filePath = extractFilePath(eventData.toolName ?? '', args);
              const inputText = formatToolInputAsText(eventData.toolName ?? '', args);
              const title = formatToolTitle(eventData.toolName ?? '', args);

              await cx.notify(acp.methods.client.session.update, {
                sessionId: params.sessionId,
                update: {
                  sessionUpdate: 'tool_call',
                  toolCallId: toolId,
                  title,
                  kind: inferToolKind(eventData.toolName ?? ''),
                  status: 'in_progress',
                  ...(eventData.args ? { rawInput: eventData.args } : {}),
                  ...(filePath ? { locations: [{ path: filePath }] } : {}),
                  ...(inputText
                    ? {
                        content: [{ type: 'content' as const, content: { type: 'text' as const, text: inputText } }],
                      }
                    : {}),
                },
              });
            } else {
              const args = parseToolArgs(eventData.args);
              const responseData = parseToolResponse(eventData.response ?? '');
              const failed = isToolFailed(eventData.toolName ?? '', responseData);
              const contentArray = buildToolCallContentArray(eventData.toolName ?? '', args, responseData);
              const inputText = formatToolInputAsText(eventData.toolName ?? '', args);

              const fullContent: acp.ToolCallContent[] = [];
              if (inputText) {
                fullContent.push({
                  type: 'content',
                  content: { type: 'text', text: inputText },
                });
              }
              fullContent.push(...contentArray);

              await cx.notify(acp.methods.client.session.update, {
                sessionId: params.sessionId,
                update: {
                  sessionUpdate: 'tool_call_update',
                  toolCallId: toolId,
                  status: failed ? 'failed' : 'completed',
                  ...(fullContent.length > 0 ? { content: fullContent } : {}),
                },
              });
            }
            break;
          }

          case 'log': {
            if (eventData.message && eventData.level !== 'loading') {
              await cx.notify(acp.methods.client.session.update, {
                sessionId: params.sessionId,
                update: {
                  sessionUpdate: 'agent_thought_chunk',
                  content: { type: 'text', text: eventData.message },
                },
              });
            }
            break;
          }

          case 'task-updated':
          case 'task-created': {
            if (eventData.name) {
              await cx.notify(acp.methods.client.session.update, {
                sessionId: params.sessionId,
                update: {
                  sessionUpdate: 'session_info_update',
                  title: eventData.name,
                  updatedAt: new Date().toISOString(),
                },
              });
            }
            break;
          }

          case 'user-message': {
            if (eventData.messageId) {
              await cx.notify(acp.methods.client.session.update, {
                sessionId: params.sessionId,
                update: {
                  sessionUpdate: 'user_message_chunk',
                  messageId: eventData.messageId,
                  content: { type: 'text', text: promptText },
                },
              });
            }
            break;
          }

          case 'stream-end': {
            return { stopReason: 'end_turn' };
          }

          case 'error': {
            process.stderr.write(`Server error: ${eventData.error || 'Unknown error'}\n`);
            return { stopReason: 'end_turn' };
          }
        }
      }

      if (abortController.signal.aborted) {
        return { stopReason: 'cancelled' };
      }

      return { stopReason: 'end_turn' };
    } catch (err) {
      if (abortController.signal.aborted) {
        return { stopReason: 'cancelled' };
      }
      throw err;
    } finally {
      session.abortController = undefined;
      session.sseStream = undefined;
    }
  }

  async cancel(params: acp.CancelNotification): Promise<void> {
    const session = this.sessions.get(params.sessionId);
    if (!session) {
      return;
    }

    session.abortController?.abort();

    if (session.sseStream) {
      try {
        session.sseStream.destroy();
      } catch {
        // already destroyed
      }
    }

    if (session.taskId) {
      try {
        await callInterrupt(this.host, this.port, session.cwd, session.taskId);
      } catch {
        // best-effort
      }
    }
  }
}

async function startAcpAgent(host: string, port: number): Promise<void> {
  try {
    const health = await fetchJSON(host, port, '/api/health', 'GET');
    const healthData = health.data as { status?: string };
    if (health.status !== 200 || healthData.status !== 'ok') {
      process.stderr.write('Error: AiderDesk server is not healthy.\n');
      process.exit(1);
    }
  } catch {
    process.stderr.write(`Error: AiderDesk server is not running on ${host}:${port}. Start it first with 'aiderdesk' or 'aiderdesk start'.\n`);
    process.exit(1);
  }

  const agentInstance = new AcpAgent(host, port);

  const input = Writable.toWeb(process.stdout);
  const output = Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>;
  const stream = acp.ndJsonStream(input, output);

  const connection = acp
    .agent({ name: 'aiderdesk', title: 'AiderDesk', version: getVersion() })
    .onRequest('initialize', (ctx) => agentInstance.initialize(ctx.params))
    .onRequest('authenticate', (ctx) => agentInstance.authenticate(ctx.params))
    .onRequest('session/new', (ctx) => agentInstance.newSession(ctx.params))
    .onRequest('session/set_config_option', (ctx) => agentInstance.setConfigOption(ctx.params))
    .onRequest('session/prompt', (ctx) => agentInstance.prompt(ctx.params, ctx.client))
    .onNotification('session/cancel', (ctx) => agentInstance.cancel(ctx.params))
    .connect(stream);

  await connection.closed;
}

export function registerAcpCommand(program: Command): void {
  program
    .command('acp')
    .description('Run as an ACP agent (Agent Client Protocol) over stdio')
    .option('-p, --port <port>', `port to listen on (default: ${DEFAULT_PORT}, env: AIDER_DESK_PORT)`, parseInt)
    .option('--host <host>', `server host (default: ${DEFAULT_HOST})`)
    .action((opts) => {
      const port = resolvePort(opts.port);
      const host = opts.host || DEFAULT_HOST;
      void startAcpAgent(host, port);
    });
}
