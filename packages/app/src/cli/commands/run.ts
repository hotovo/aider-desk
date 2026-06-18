import { request } from 'http';

import { TUI, ProcessTerminal, matchesKey as piMatchesKey, Key } from '@earendil-works/pi-tui';
import { Command } from 'commander';

import { DEFAULT_HOST, resolvePort } from '../constants';
import { RunStreamModel, RunStreamView } from './run-stream-view';

type EventData = {
  baseDir?: string;
  taskId?: string;
  id?: string;
  // response-chunk / response-completed
  chunk?: string;
  messageId?: string;
  reasoning?: string;
  // response-completed
  content?: string;
  finished?: boolean;
  // tool
  toolName?: string;
  toolCallId?: string;
  output?: string;
  response?: string;
  error?: string;
  args?: unknown;
  // log
  level?: string;
  message?: string;
  // ask-question
  question?: string;
  // task-updated / task-created
  name?: string;
  state?: string;
  provider?: string;
  model?: string;
  // usage
  usageReport?: unknown;
};

const parseEventData = (raw: string): EventData | undefined => {
  try {
    return JSON.parse(raw) as EventData;
  } catch {
    return undefined;
  }
};

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

const createDeferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const formatToolArgs = (args: unknown): string => {
  if (!args || typeof args !== 'object') {
    return '';
  }
  const entries = Object.entries(args as Record<string, unknown>);
  if (entries.length === 0) {
    return '';
  }
  const summary = entries
    .map(([key, value]) => {
      const str = typeof value === 'string' ? value : JSON.stringify(value);
      const truncated = str.length > 60 ? str.substring(0, 57) + '...' : str;
      return `${key}=${truncated}`;
    })
    .join(', ');
  return `(${summary})`;
};

const readStdin = async (): Promise<string> => {
  if (process.stdin.isTTY) {
    return '';
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf-8').trim();
};

const fetchJSON = async (
  host: string,
  port: number,
  path: string,
  method: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> => {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const options = {
      hostname: host,
      port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };

    const req = request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8');
        let data: unknown;
        try {
          data = JSON.parse(raw);
        } catch {
          data = raw;
        }
        resolve({ status: res.statusCode || 200, data });
      });
    });

    req.on('error', reject);
    req.setTimeout(300_000, () => {
      req.destroy(new Error('Request timed out'));
    });

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
};

const callInterrupt = (host: string, port: number, projectDir: string, taskId: string): Promise<void> => {
  if (!taskId) return Promise.resolve();
  const body = JSON.stringify({ projectDir, taskId });
  return new Promise((resolve) => {
    const options = {
      hostname: host,
      port,
      path: '/api/project/interrupt',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = request(options, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve());
    });
    req.on('error', () => resolve());
    req.setTimeout(2000, () => {
      req.destroy();
      resolve();
    });
    req.write(body);
    req.end();
  });
};

type SSEStreamResult = {
  stream: NodeJS.ReadableStream & {
    destroy(error?: Error): void;
  };
  taskId: string;
};

const requestSSEStream = (host: string, port: number, body: string): Promise<SSEStreamResult> => {
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

    const req = request(options, (res) => {
      if (res.statusCode !== 200) {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8');
          reject(new Error(`Server returned ${res.statusCode}: ${raw}`));
        });
        return;
      }
      const taskId = res.headers['x-task-id'] as string | undefined;
      resolve({ stream: res, taskId: taskId || '' });
    });

    req.on('error', reject);
    req.setTimeout(600_000, () => {
      req.destroy(new Error('Request timed out'));
    });

    req.write(body);
    req.end();
  });
};

const parseSSEEvents = (stream: NodeJS.ReadableStream): AsyncIterable<{ type: string; data: string }> => {
  const events: { type: string; data: string }[] = [];
  let resolve: (() => void) | null = null;

  const push = (event: { type: string; data: string }) => {
    events.push(event);
    if (resolve) {
      resolve();
      resolve = null;
    }
  };

  let buffer = '';
  let currentType = '';
  let currentData = '';

  stream.on('data', (chunk: Buffer) => {
    buffer += chunk.toString('utf-8');
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith(':')) {
        continue;
      } else if (line.startsWith('event:')) {
        currentType = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        currentData += (currentData ? '\n' : '') + line.slice(5).trimStart();
      } else if (line === '') {
        if (currentType || currentData) {
          push({ type: currentType, data: currentData });
          currentType = '';
          currentData = '';
        }
      }
    }
  });

  return {
    [Symbol.asyncIterator]() {
      return {
        async next() {
          while (events.length === 0) {
            const d = createDeferred<void>();
            resolve = d.resolve;
            await d.promise;
          }
          const event = events.shift()!;
          return { value: event, done: false };
        },
      };
    },
  };
};

type Format = 'text' | 'json';

const formatJSONLine = (type: string, raw: Record<string, unknown>): string => {
  const { taskId, baseDir, ...data } = raw;
  return JSON.stringify({ type, taskId: taskId as string | undefined, projectDir: baseDir as string | undefined, data }) + '\n';
};

const runPrompt = async (
  messages: string[],
  opts: {
    port?: string;
    host?: string;
    format: string;
    quiet: boolean;
    model?: string;
    agentProfile?: string;
    taskId?: string;
  },
): Promise<void> => {
  const port = resolvePort(opts.port ? parseInt(opts.port) : undefined);
  const host = opts.host || DEFAULT_HOST;
  const format = opts.format === 'json' ? 'json' : 'text';
  const quiet = opts.quiet;

  const projectDir = process.cwd();

  // Build prompt from args + stdin
  let prompt = messages.join(' ').trim();
  const stdinContent = await readStdin();
  if (stdinContent) {
    prompt = prompt ? `${prompt}\n\n${stdinContent}` : stdinContent;
  }

  if (!prompt) {
    process.stderr.write('Error: No prompt provided. Pass a message or pipe stdin.\n');
    process.exit(1);
  }

  // 1. Health check
  try {
    const health = await fetchJSON(host, port, '/api/health', 'GET');
    if (health.status !== 200 || (health.data as { status?: string }).status !== 'ok') {
      process.stderr.write('Error: AiderDesk server is not healthy.\n');
      process.exit(1);
    }
  } catch {
    process.stderr.write(
      `Error: AiderDesk server is not running on ${host}:${port}. Start it first with 'aiderdesk' or 'aiderdesk start'.\n`,
    );
    process.exit(1);
  }

  // 2. Send prompt with Accept: text/event-stream — single request, streaming response
  const requestBody: Record<string, unknown> = { prompt, projectDir };
  if (opts.model) {
    requestBody.model = opts.model;
  }
  if (opts.agentProfile) {
    requestBody.agentProfileId = opts.agentProfile;
  }
  if (opts.taskId) {
    requestBody.taskId = opts.taskId;
  }
  const body = JSON.stringify(requestBody);
  let reqClosed = false;

  const sseResponse = await requestSSEStream(host, port, body);
  const taskId = sseResponse.taskId;

  const eventStream = parseSSEEvents(sseResponse.stream);

  // Handle Ctrl+C gracefully: destroy the stream, best-effort call the
  // server's interrupt endpoint, then exit 130.
  let interrupted = false;
  const handleInterrupt = (tui?: TUI) => {
    if (interrupted) {
      process.exit(130);
    }
    interrupted = true;
    if (tui) {
      tui.stop();
    }
    process.stderr.write('\nInterrupting...\n');
    if (!reqClosed) {
      sseResponse.stream.destroy();
    }
    void callInterrupt(host, port, projectDir, taskId).then(() => process.exit(130));
    setTimeout(() => process.exit(130), 2000);
  };

  process.on('SIGINT', () => handleInterrupt());
  process.on('SIGTERM', () => handleInterrupt());

  // 3. Consume SSE events. When stdout/stdin are both TTYs and the format
  // is text + non-quiet, render the live streaming UI with collapsible
  // reasoning/tool views. Otherwise use the plain stdout/stderr stream.
  const interactive = format === 'text' && !quiet && !!process.stdout.isTTY && !!process.stdin.isTTY;

  if (interactive) {
    await runInteractiveStream({
      host,
      port,
      projectDir,
      taskId,
      prompt,
      eventStream,
      sseResponse,
      onInterrupt: (tui: TUI) => handleInterrupt(tui),
      onDone: (success: boolean) => {
        reqClosed = true;
        process.exit(success ? 0 : 1);
      },
    });
    return;
  }

  // Plain (non-interactive) streaming path
  let currentResponseText = '';
  let finished = false;
  let lastResponseCompleted: Record<string, unknown> | null = null;
  const seenToolStarts = new Set<string>();
  const seenToolEnds = new Set<string>();

  if (format === 'text' && !quiet) {
    process.stderr.write(`Running prompt in ${projectDir}\n`);
  }

  for await (const event of eventStream) {
    const eventData = parseEventData(event.data);
    if (!eventData) continue;

    switch (event.type) {
      case 'response-chunk': {
        if (format === 'json' && !quiet) {
          process.stdout.write(formatJSONLine('response-chunk', eventData));
        } else if (format === 'text' && !quiet) {
          const text = eventData.chunk || '';
          if (text) {
            process.stdout.write(text);
            currentResponseText += text;
          }
        }
        break;
      }

      case 'response-completed': {
        if (format === 'json' && !quiet) {
          process.stdout.write(formatJSONLine('response-completed', eventData));
        } else if (quiet) {
          lastResponseCompleted = eventData;
        } else {
          if (eventData.content) {
            const remainingContent = eventData.content.startsWith(currentResponseText)
              ? eventData.content.slice(currentResponseText.length)
              : eventData.content;
            if (remainingContent) {
              process.stdout.write(remainingContent);
            }
            if (!eventData.content.endsWith('\n')) {
              process.stdout.write('\n');
            }
          } else if (currentResponseText && !currentResponseText.endsWith('\n')) {
            process.stdout.write('\n');
          }
        }
        currentResponseText = '';
        break;
      }

      case 'stream-end': {
        if (quiet && lastResponseCompleted) {
          if (format === 'json') {
            process.stdout.write(formatJSONLine('response-completed', lastResponseCompleted));
          } else {
            const content = (lastResponseCompleted.content as string) || '';
            if (content) {
              process.stdout.write(content);
              if (!content.endsWith('\n')) {
                process.stdout.write('\n');
              }
            }
          }
        }
        finished = true;
        break;
      }

      case 'tool': {
        const toolId = eventData.id || '';
        if (toolId && eventData.toolName) {
          if (!eventData.finished) {
            if (seenToolStarts.has(toolId)) {
              break;
            }
            seenToolStarts.add(toolId);
            if (format === 'json' && !quiet) {
              process.stdout.write(formatJSONLine('tool-start', eventData));
            } else if (format === 'text' && !quiet) {
              const argsSummary = formatToolArgs(eventData.args);
              process.stderr.write(`  \x1b[2m⚙ ${eventData.toolName}${argsSummary}\x1b[0m\n`);
            }
          } else {
            if (seenToolEnds.has(toolId)) {
              break;
            }
            seenToolEnds.add(toolId);
            if (format === 'json' && !quiet) {
              process.stdout.write(formatJSONLine('tool-end', eventData));
            } else if (format === 'text' && !quiet) {
              const hasError = eventData.response === 'error';
              const symbol = hasError ? '✗' : '✓';
              process.stderr.write(`  \x1b[2m${symbol} ${eventData.toolName}\x1b[0m\n`);
            }
          }
        }
        break;
      }

      case 'log': {
        if (format === 'json' && !quiet) {
          process.stdout.write(formatJSONLine('log', eventData));
        } else if (format === 'text' && eventData.level === 'error' && eventData.message) {
          process.stderr.write(`\x1b[31mError: ${eventData.message}\x1b[0m\n`);
        }
        break;
      }

      case 'ask-question': {
        if (format === 'json' && !quiet) {
          process.stdout.write(formatJSONLine('ask-question', eventData));
        } else if (format === 'text' && eventData.question) {
          process.stderr.write(`\n? ${eventData.question}\n`);
        }
        break;
      }

      default: {
        if (format === 'json' && !quiet) {
          process.stdout.write(formatJSONLine(event.type, eventData));
        }
        break;
      }
    }

    if (finished) {
      break;
    }
  }

  reqClosed = true;
  process.exit(finished ? 0 : 1);
};

// === Interactive (TUI) streaming path ===

type InteractiveRunArgs = {
  host: string;
  port: number;
  projectDir: string;
  taskId: string;
  prompt: string;
  eventStream: AsyncIterable<{ type: string; data: string }>;
  sseResponse: SSEStreamResult;
  onInterrupt: (tui: TUI) => void;
  onDone: (success: boolean) => void;
};

const runInteractiveStream = async (args: InteractiveRunArgs): Promise<void> => {
  const terminal = new ProcessTerminal();
  const tui = new TUI(terminal);

  const model = new RunStreamModel();
  const view = new RunStreamView(tui, model, {
    projectDir: args.projectDir,
    taskId: args.taskId,
    host: args.host,
    port: args.port,
    prompt: args.prompt,
    onInterrupt: () => {},
  });
  tui.addChild(view);
  tui.setFocus(view);
  tui.addInputListener((data: string) => {
    if (piMatchesKey(data, Key.ctrl('c'))) {
      view.setInterrupted();
      args.onInterrupt(tui);
      return { consume: true };
    }
    return undefined;
  });
  process.stdout.write('\x1b[2J\x1b[H');
  tui.start();

  let success = false;
  try {
    for await (const event of args.eventStream) {
      const eventData = parseEventData(event.data);
      if (!eventData) continue;
      switch (event.type) {
        case 'response-chunk': {
          if (eventData.reasoning && eventData.messageId) {
            model.appendReasoning(eventData.messageId, eventData.reasoning);
          }
          if (eventData.chunk && eventData.messageId) {
            model.appendAnswer(eventData.messageId, eventData.chunk);
          }
          view.notifyChanged();
          break;
        }
        case 'response-completed': {
          if (eventData.messageId) {
            model.completeResponse(eventData.messageId, eventData.content);
          }
          view.notifyChanged();
          break;
        }
        case 'tool': {
          const toolId = eventData.id || '';
          if (toolId && eventData.toolName) {
            if (!eventData.finished) {
              model.startTool(toolId, eventData.toolName, eventData.args);
            } else {
              const hasError = eventData.response === 'error';
              model.endTool(toolId, eventData.response, hasError);
            }
            view.notifyChanged();
          }
          break;
        }
        case 'log': {
          if (eventData.level === 'loading') {
            if (eventData.message) {
              view.setLoadingMessage(eventData.message);
            } else {
              view.setLoadingMessage(null);
            }
          } else if (eventData.level === 'error' && eventData.message) {
            view.setLoadingMessage(null);
          }
          break;
        }
        case 'stream-end': {
          success = true;
          view.setFinished();
          break;
        }
        default:
          break;
      }
      if (success) {
        break;
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message === 'Request timed out') {
      view.setInterrupted();
    }
  } finally {
    args.sseResponse.stream.destroy();
    // Allow the user a moment to read the final state before exiting.
    setTimeout(() => {
      tui.stop();
      args.onDone(success);
    }, 750);
  }
};

export function registerRunCommand(program: Command): void {
  program
    .command('run [message...]')
    .description('Run a prompt non-interactively and stream output')
    .option('-p, --port <port>', 'server port (env: AIDER_DESK_PORT)', parseInt)
    .option('--host <host>', `server host (default: ${DEFAULT_HOST})`)
    .option('-f, --format <format>', 'output format: text (default) or json', 'text')
    .option('-q, --quiet', 'suppress progress indicators')
    .option('-m, --model <model>', 'model to use (format: provider/model, e.g. openai/gpt-4o)')
    .option('-a, --agent-profile <id>', 'agent profile ID to use')
    .option('-t, --task-id <id>', 'run on an existing task instead of creating a new one')
    .action((messages, opts) => {
      runPrompt(messages, opts);
    });
}
