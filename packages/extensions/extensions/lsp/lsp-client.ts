import path from 'path';
import fs from 'fs/promises';

import { createMessageConnection, StreamMessageReader, StreamMessageWriter, MessageConnection } from 'vscode-jsonrpc/node';
import { ExtensionContext } from '@aiderdesk/extensions';

import type { Diagnostic, Range } from 'vscode-languageserver-types';
import type { ChildProcessWithoutNullStreams } from 'child_process';
import type { LspServerInfo, LspServerHandle } from './lsp-servers';

export interface LspDiagnostic {
  severity: number;
  message: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  source?: string;
  code?: string | number;
}

export interface LspClientOptions {
  serverInfo: LspServerInfo;
  handle: LspServerHandle;
  rootDir: string;
  context: ExtensionContext;
}

interface PublishDiagnosticsParams {
  uri: string;
  diagnostics: Diagnostic[];
}

export class LspClient {
  private connection: MessageConnection | null = null;
  private process: ChildProcessWithoutNullStreams;
  private diagnostics: Map<string, LspDiagnostic[]> = new Map();
  private openFiles: Map<string, number> = new Map();
  private serverInfo: LspServerInfo;
  private rootDir: string;
  private context: ExtensionContext;
  private initializationOptions?: Record<string, unknown>;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(options: LspClientOptions) {
    this.serverInfo = options.serverInfo;
    this.process = options.handle.process;
    this.rootDir = options.rootDir;
    this.context = options.context;
    this.initializationOptions = options.handle.initializationOptions;
  }

  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    this.connection = createMessageConnection(new StreamMessageReader(this.process.stdout), new StreamMessageWriter(this.process.stdin));

    this.connection.onNotification('textDocument/publishDiagnostics', (params: PublishDiagnosticsParams) => {
      const filePath = this.uriToPath(params.uri);
      this.context.log(`Received publishDiagnostics for ${params.uri} -> ${filePath} (${params.diagnostics.length} diagnostics)`, 'info');
      const diags: LspDiagnostic[] = params.diagnostics.map((d: Diagnostic) => ({
        severity: d.severity || 1,
        message: d.message,
        range: {
          start: { line: d.range.start.line, character: d.range.start.character },
          end: { line: d.range.end.line, character: d.range.end.character },
        },
        source: d.source,
        code: d.code,
      }));
      this.diagnostics.set(filePath, diags);
      this.context.log(`Stored diagnostics for ${filePath}: ${diags.map((d) => `severity=${d.severity}: ${d.message}`).join(', ')}`, 'info');
    });

    this.connection.onRequest('window/workDoneProgress/create', () => null);
    this.connection.onRequest('workspace/configuration', async () => {
      return [this.initializationOptions || {}];
    });

    this.connection.listen();

    await this.connection.sendRequest('initialize', {
      rootUri: this.pathToUri(this.rootDir),
      processId: this.process.pid,
      workspaceFolders: [
        {
          name: 'workspace',
          uri: this.pathToUri(this.rootDir),
        },
      ],
      initializationOptions: this.initializationOptions,
      capabilities: {
        window: {
          workDoneProgress: true,
        },
        workspace: {
          configuration: true,
        },
        textDocument: {
          synchronization: {
            didOpen: true,
            didChange: true,
          },
          publishDiagnostics: {
            relatedInformation: true,
          },
        },
      },
    });

    await this.connection.sendNotification('initialized');
    this.initialized = true;
    this.context.log(`LSP client for ${this.serverInfo.id} initialized`, 'info');
  }

  private pathToUri(filePath: string): string {
    return `file://${filePath}`;
  }

  private uriToPath(uri: string): string {
    return new URL(uri).pathname;
  }

  async notifyFileChanged(filePath: string): Promise<void> {
    if (!this.connection || !this.initialized) {
      await this.initialize();
    }

    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(this.rootDir, filePath);
    this.context.log(`notifyFileChanged: input=${filePath}, absolute=${absolutePath}`, 'info');

    let content: string;
    try {
      content = await fs.readFile(absolutePath, 'utf-8');
    } catch {
      this.context.log(`Failed to read file ${absolutePath} for LSP`, 'error');
      return;
    }

    const version = this.openFiles.get(absolutePath);

    if (version !== undefined) {
      const nextVersion = version + 1;
      this.openFiles.set(absolutePath, nextVersion);
      await this.connection!.sendNotification('textDocument/didChange', {
        textDocument: {
          uri: this.pathToUri(absolutePath),
          version: nextVersion,
        },
        contentChanges: [{ text: content }],
      });
    } else {
      this.diagnostics.delete(absolutePath);
      this.openFiles.set(absolutePath, 0);
      await this.connection!.sendNotification('textDocument/didOpen', {
        textDocument: {
          uri: this.pathToUri(absolutePath),
          languageId: this.serverInfo.languageId,
          version: 0,
          text: content,
        },
      });
    }
  }

  async waitForDiagnostics(filePath: string, timeoutMs: number): Promise<LspDiagnostic[]> {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(this.rootDir, filePath);
    this.context.log(`waitForDiagnostics: input=${filePath}, absolute=${absolutePath}`, 'info');

    const initialDiags = this.diagnostics.get(absolutePath);
    this.context.log(`waitForDiagnostics: initial diagnostics count=${initialDiags?.length ?? 'undefined'}`, 'info');

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        resolve();
      }, timeoutMs);

      const checkInterval = setInterval(() => {
        const currentDiags = this.diagnostics.get(absolutePath);
        if (currentDiags && currentDiags !== initialDiags) {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          resolve();
        }
      }, 50);

      setTimeout(() => {
        clearTimeout(timeout);
        clearInterval(checkInterval);
        resolve();
      }, timeoutMs);
    });

    return this.diagnostics.get(absolutePath) || [];
  }

  getDiagnostics(filePath: string): LspDiagnostic[] {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(this.rootDir, filePath);
    return this.diagnostics.get(absolutePath) || [];
  }

  async findReferences(filePath: string, line: number, character: number): Promise<{ uri: string; range: Range }[] | null> {
    if (!this.connection || !this.initialized) {
      await this.initialize();
    }

    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(this.rootDir, filePath);
    await this.notifyFileChanged(absolutePath);

    try {
      const result = await this.connection!.sendRequest('textDocument/references', {
        textDocument: { uri: this.pathToUri(absolutePath) },
        position: { line, character },
        context: { includeDeclaration: true },
      });

      return result as { uri: string; range: Range }[] | null;
    } catch (error) {
      this.context.log(`Failed to get references: ${error}`, 'error');
      return null;
    }
  }

  async shutdown(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.sendRequest('shutdown');
        await this.connection.sendNotification('exit');
      } catch {
        // Ignore errors during shutdown
      }
      this.connection = null;
    }

    if (this.process) {
      this.process.kill();
    }

    this.initialized = false;
    this.initPromise = null;
  }

  get serverId(): string {
    return this.serverInfo.id;
  }
}
