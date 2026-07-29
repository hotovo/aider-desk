import { ExtensionDisplayAPI } from '@common/api';
import { BrowserBootstrap, ExtensionUIComponent, ExtensionUIRefreshData, TaskData, TaskStateData } from '@common/types';
import { type AxiosInstance, create } from 'axios';
import { io, Socket } from 'socket.io-client';

export type ReadonlyEvent = {
  type: string;
  data: unknown;
};

type EventListener = (event: ReadonlyEvent) => void;

const EVENT_TYPES = [
  'task-created',
  'task-updated',
  'task-started',
  'task-completed',
  'task-cancelled',
  'task-deleted',
  'user-message',
  'response-chunk',
  'response-completed',
  'tool',
  'tool-input-chunk',
  'log',
  'command-output',
  'clear-task',
  'message-removed',
  'extension-ui-refresh',
];

const getBaseUrl = (): string => {
  const port = window.location.port === '5173' ? '24337' : window.location.port;
  return `${window.location.protocol}//${window.location.hostname}${port ? `:${port}` : ''}`;
};

export const loadBrowserBootstrap = async (): Promise<BrowserBootstrap> => {
  const response = await create().get<BrowserBootstrap>(`${getBaseUrl()}/api/readonly/bootstrap`);
  return response.data;
};

export class ReadonlyBrowserApi implements ExtensionDisplayAPI {
  private readonly client: AxiosInstance;
  private readonly socket: Socket;
  private readonly listeners = new Set<EventListener>();
  private readonly libraryTaskIds = new Map<string, string | undefined>();
  private readonly extensionListeners = new Set<(data: ExtensionUIRefreshData) => void>();

  constructor(private readonly projectDir: string) {
    const baseUrl = getBaseUrl();
    this.client = create({ baseURL: `${baseUrl}/api/readonly` });
    this.socket = io(baseUrl, {
      auth: { readonly: true },
      autoConnect: true,
      forceNew: true,
      reconnection: true,
    });
    this.socket.on('connect', () => {
      this.socket.emit('message', {
        action: 'readonly-subscribe-events',
        projectDir: this.projectDir,
        eventTypes: EVENT_TYPES,
      });
    });
    this.socket.on('event', (event: ReadonlyEvent) => {
      this.listeners.forEach((listener) => listener(event));
      if (event.type === 'extension-ui-refresh') {
        const data = event.data as ExtensionUIRefreshData;
        this.extensionListeners.forEach((listener) => listener(data));
      }
    });
  }

  destroy(): void {
    this.socket.emit('message', { action: 'readonly-unsubscribe-events' });
    this.socket.disconnect();
    this.listeners.clear();
    this.extensionListeners.clear();
  }

  onEvent(callback: EventListener): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  async getTasks(): Promise<TaskData[]> {
    const response = await this.client.get<TaskData[]>('/tasks', { params: { projectDir: this.projectDir } });
    return response.data;
  }

  async loadTask(taskId: string): Promise<TaskStateData> {
    const response = await this.client.get<TaskStateData>(`/tasks/${encodeURIComponent(taskId)}`, { params: { projectDir: this.projectDir } });
    return response.data;
  }

  async getExtensionUIComponents(placement?: string, projectDir?: string, taskId?: string): Promise<ExtensionUIComponent[]> {
    const response = await this.client.get<ExtensionUIComponent[]>('/extensions/ui-components', {
      params: { projectDir: projectDir ?? this.projectDir, placement, taskId },
    });
    response.data.forEach((component) => {
      Object.values(component.libraries ?? {}).forEach((spec) => this.libraryTaskIds.set(spec, taskId));
    });
    return response.data;
  }

  async getUIExtensionData(extensionId: string, componentId: string, projectDir?: string, taskId?: string): Promise<unknown> {
    const response = await this.client.get('/extensions/ui-data', {
      params: { projectDir: projectDir ?? this.projectDir, extensionId, componentId, taskId },
    });
    return response.data;
  }

  async executeUIExtensionAction(
    extensionId: string,
    componentId: string,
    action: string,
    args: unknown[],
    projectDir?: string,
    taskId?: string,
  ): Promise<unknown> {
    const response = await this.client.post('/extensions/ui-action', {
      projectDir: projectDir ?? this.projectDir,
      taskId,
      extensionId,
      componentId,
      action,
      args,
    });
    return response.data;
  }

  onExtensionUIRefresh(callback: (data: ExtensionUIRefreshData) => void): () => void {
    this.extensionListeners.add(callback);
    return () => this.extensionListeners.delete(callback);
  }

  async loadExtensionLibrary(librarySpec: string): Promise<string> {
    const response = await this.client.get<string>('/extensions/library', {
      params: { projectDir: this.projectDir, taskId: this.libraryTaskIds.get(librarySpec), spec: librarySpec },
      responseType: 'text',
    });
    return response.data;
  }
}
