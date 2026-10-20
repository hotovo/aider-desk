import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { PROVIDER_ID, isFreeModel, toModel } from './catalog';
import { OpenCodeFreeModel } from './model';
import { OpenCodeRuntime } from './runtime';
import { historyFingerprint, SessionState } from './session';

import type {
  AgentStartedEvent,
  AgentFinishedEvent,
  Extension,
  ExtensionContext,
  ProviderDefinition,
  TaskContext,
  TaskClosedEvent,
  InterruptedEvent,
} from '@aiderdesk/extensions';
import type { ToolSet } from 'ai';

type ScopedProfile = AgentStartedEvent['providerProfile'] & { opencodeFreeScope?: string };
type Run = {
  taskId: string;
  task: TaskContext;
  mode: string;
  promptId?: string;
  scope: string;
  historyHash: string;
  session?: SessionState;
  completed?: boolean;
};

export default class OpenCodeFreeExtension implements Extension {
  static metadata = {
    name: 'OpenCode Free',
    version: '1.0.0',
    description: 'Free OpenCode models with native shell/read and AiderDesk MCP tools',
    author: 'wladimiiir',
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/opencode-free/icon.png',
    capabilities: ['providers'],
  };

  constructor(private storageRoot = join(homedir(), '.aider-desk', 'opencode-free', 'sessions')) {}

  private runs = new Map<string, Run>();
  private tasks = new Map<string, TaskContext>();
  private runtimes = new Map<string, Set<OpenCodeRuntime>>();
  private catalogRuntimes = new Set<OpenCodeRuntime>();

  getProviders(): ProviderDefinition[] {
    return [
      {
        id: PROVIDER_ID,
        name: 'OpenCode Free',
        provider: { name: PROVIDER_ID },
        strategy: {
          loadModels: async (profile) => {
            const runtime = new OpenCodeRuntime();
            this.catalogRuntimes.add(runtime);
            try {
              const { client } = await runtime.start();
              const catalog = await client.model.list({}, { signal: AbortSignal.timeout(30000) });
              const models = catalog.data.filter(isFreeModel).map((model) => toModel(model, profile.id));
              if (!models.length) {
                return {
                  models: [],
                  success: false,
                  error: 'OpenCode currently advertises no supported free models.',
                };
              }
              return { models, success: true };
            } catch (error) {
              return {
                models: [],
                success: false,
                error: error instanceof Error ? error.message : String(error),
              };
            } finally {
              await runtime.close();
              this.catalogRuntimes.delete(runtime);
            }
          },
          createLlm: async (_profile, model, _settings, projectDir, toolSet, _systemPrompt, _metadata, _tls, sessionId, approveTool) => {
            const task = sessionId ? this.tasks.get(sessionId) : undefined;
            if (!task || !sessionId) {
              throw new Error('OpenCode Free is an Agent-mode provider and requires an active task. Use OpenCode GO or ZEN for other modes.');
            }
            const scope = (_profile as ScopedProfile).opencodeFreeScope ?? 'main';
            const runKey = `${sessionId}:${_profile.id ?? PROVIDER_ID}:${scope}`;
            const run = this.runs.get(runKey);
            if (!run || run.session) {
              throw new Error('OpenCode Free requires a separate agent-run context for each conversation.');
            }
            const workspaceDirectory = task.getTaskDir() || projectDir;
            if (!workspaceDirectory || !projectDir) {
              throw new Error('OpenCode Free requires a project workspace.');
            }
            const sessionState = new SessionState(this.storageRoot, projectDir, sessionId, _profile.id ?? PROVIDER_ID, scope, workspaceDirectory, model.id);
            run.session = sessionState;
            const runtime = new OpenCodeRuntime();
            const active = this.runtimes.get(sessionId) ?? new Set<OpenCodeRuntime>();
            active.add(runtime);
            this.runtimes.set(sessionId, active);
            const release = async () => {
              await runtime.close();
              active.delete(runtime);
              if (active.size === 0 && this.runtimes.get(sessionId) === active) {
                this.runtimes.delete(sessionId);
              }
            };
            try {
              const tools = (toolSet ?? {}) as ToolSet;
              const { client, provider, bridge, workspace } = await runtime.start(workspaceDirectory, tools, sessionState.storageDirectory);
              const catalog = await client.model.list({}, { signal: AbortSignal.timeout(30000) });
              const free = catalog.data.find((entry) => `opencode/${entry.modelID}` === model.id && isFreeModel(entry));
              if (!free) {
                throw new Error(`Model ${model.id} is not currently available for free. Refresh the model library; no paid fallback is allowed.`);
              }
              const existingSessionId = await sessionState.restore(run.historyHash, (id) => client.session.get({ sessionID: id }));
              await sessionState.invalidate();
              const llm = provider(model.id, {
                ...(existingSessionId ? { sessionId: existingSessionId, sessionMode: 'existing' as const } : {}),
                location: { directory: workspace },
                systemPrompt:
                  'Use native shell and read for commands and file reading. All other operations must use the AiderDesk MCP tools. Never delegate to another OpenCode agent. Native tools follow AiderDesk approval policies; do not work around rejections.',
                logger: false,
              });
              return new OpenCodeFreeModel(model.id, llm, tools, bridge, release, approveTool, async (metadata) => {
                await sessionState.observe(metadata);
                run.completed = true;
              });
            } catch (error) {
              await release();
              throw error;
            }
          },
        },
      },
    ];
  }

  async onAgentStarted(event: AgentStartedEvent, context: ExtensionContext): Promise<Partial<AgentStartedEvent> | void> {
    if (event.providerProfile.provider.name !== PROVIDER_ID) {
      return;
    }
    const task = context.getTaskContext();
    if (task) {
      this.tasks.set(task.data.id, task);
      const scope =
        event.mode === 'subagent' ? `subagent:${event.agentProfile?.id}:${event.promptContext?.group?.id ?? event.promptContext?.id ?? randomUUID()}` : 'main';
      const profile: ScopedProfile = { ...event.providerProfile, opencodeFreeScope: scope };
      const key = `${task.data.id}:${profile.id ?? PROVIDER_ID}:${scope}`;
      this.runs.set(key, {
        taskId: task.data.id,
        task,
        scope,
        mode: event.mode ?? 'agent',
        promptId: event.promptContext?.id,
        historyHash: historyFingerprint(event.contextMessages ?? []),
      });
      return { providerProfile: profile };
    }
  }

  async onAgentFinished(event: AgentFinishedEvent, context: ExtensionContext): Promise<void> {
    const id = context.getTaskContext()?.data.id;
    if (!id) {
      return;
    }
    const promptId = event.resultMessages?.find((message) => message.promptContext?.id)?.promptContext?.id;
    const matches = [...this.runs.entries()].filter(
      ([, run]) =>
        run.taskId === id &&
        run.mode === event.mode &&
        (promptId ? run.promptId === promptId : run.historyHash === historyFingerprint(event.contextMessages ?? [])),
    );
    if (matches.length === 1) {
      const [key, run] = matches[0];
      this.runs.delete(key);
      if (!event.aborted && run.completed && run.session) {
        const record = await run.session.checkpoint([...(event.contextMessages ?? []), ...(event.resultMessages ?? [])]);
        if (record && run.scope === 'main') {
          await run.task.updateTask({ metadata: { ...run.task.data.metadata, opencodeFreeSession: record } });
        }
      }
    }
    if (!this.runtimes.has(id)) {
      this.tasks.delete(id);
    }
  }

  async onInterrupted(event: InterruptedEvent, context: ExtensionContext): Promise<void> {
    const id = context.getTaskContext()?.data.id;
    if (id && !event.interruptId) {
      await this.finish(id);
    }
  }

  async onTaskClosed(event: TaskClosedEvent): Promise<void> {
    await this.finish(event.task.id);
  }

  private async finish(id: string): Promise<void> {
    for (const [key, run] of this.runs) {
      if (run.taskId === id) {
        this.runs.delete(key);
      }
    }
    this.tasks.delete(id);
    const runtimes = this.runtimes.get(id);
    this.runtimes.delete(id);
    await Promise.all([...(runtimes ?? [])].map((runtime) => runtime.close()));
  }

  async onUnload(): Promise<void> {
    const runtimes = [...this.runtimes.values()].flatMap((active) => [...active]).concat([...this.catalogRuntimes]);
    this.runtimes.clear();
    this.catalogRuntimes.clear();
    this.tasks.clear();
    this.runs.clear();
    await Promise.allSettled(runtimes.map((runtime) => runtime.close()));
  }
}
