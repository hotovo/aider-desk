/**
 * LSP (Language Server Protocol) Integration Extension
 *
 * This extension provides LSP integration for AiderDesk, enabling:
 * - Automatic error detection after file edits
 * - LSP-powered tools for the AI assistant
 *
 * Features:
 * - Automatic diagnostics after power---file_edit and power---file_write
 * - Tool: lsp-find-references
 *
 * Supported Languages (out of the box):
 * - TypeScript/JavaScript (.ts, .tsx, .js, .jsx, .mjs, .cjs)
 * - Python (.py, .pyi, .pyw)
 *
 * Prerequisites:
 * - TypeScript: typescript-language-server must be available (npx will install it)
 * - Python: pyright-langserver must be available (npx will install it)
 *
 * The extension automatically:
 * 1. Starts the appropriate LSP server when a file is first accessed
 * 2. Notifies the server of file changes
 * 3. Waits for diagnostics and appends errors to tool output
 */

import path from 'path';

import { z } from 'zod';

import { LspManager } from './lsp-manager';

import type { Extension, ExtensionContext, ToolDefinition, ToolFinishedEvent, ProjectStartedEvent, ProjectStoppedEvent } from '@aiderdesk/extensions';
import type { LspDiagnostic } from './lsp-client';

interface FilePositionInput {
  filePath: string;
  line: number;
  character: number;
}

const FILE_EDIT_TOOL = 'power---file_edit';
const FILE_WRITE_TOOL = 'power---file_write';

const DIAGNOSTIC_WAIT_TIMEOUT_MS = 3000;

const metadata = {
  name: 'LSP Integration',
  version: '1.0.0',
  description: 'Language Server Protocol integration for code intelligence and error detection',
  author: 'wladimiiir',
  capabilities: ['tools', 'code-intelligence'],
};

export default class LspExtension implements Extension {
  static metadata = metadata;
  private managers: Map<string, LspManager> = new Map();

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('LSP Extension loaded', 'info');
  }

  async onUnload(): Promise<void> {
    for (const manager of this.managers.values()) {
      await manager.shutdown();
    }
    this.managers.clear();
  }

  private getManager(projectDir: string, context: ExtensionContext): LspManager {
    let manager = this.managers.get(projectDir);
    if (!manager) {
      manager = new LspManager(context);
      this.managers.set(projectDir, manager);
    }
    return manager;
  }

  async onProjectStarted(event: ProjectStartedEvent, context: ExtensionContext): Promise<void> {
    context.log(`LSP Extension: Project started at ${event.baseDir}`, 'debug');
    this.getManager(event.baseDir, context);
  }

  async onProjectStopped(event: ProjectStoppedEvent, context: ExtensionContext): Promise<void> {
    context.log(`LSP Extension: Project stopped at ${event.baseDir}`, 'debug');
    const manager = this.managers.get(event.baseDir);
    if (manager) {
      await manager.shutdown();
      this.managers.delete(event.baseDir);
    }
  }

  getTools(_context: ExtensionContext, _mode: string): ToolDefinition[] {
    return [
      {
        name: 'lsp-find-references',
        description:
          'Find all references to a symbol at a given position in a file. Returns a list of locations where the symbol is used across the project. Use this to understand how a function, variable, or class is used.',
        inputSchema: z.object({
          filePath: z.string().describe('The absolute path to the file'),
          line: z.number().describe('The line number (0-based)'),
          character: z.number().describe('The character position (0-based)'),
        }),
        execute: async (input, _signal, context) => {
          const params = input as unknown as FilePositionInput;
          const projectDir = context.getProjectDir();
          const manager = this.getManager(projectDir, context);
          const client = await manager.getClient(params.filePath, projectDir);

          if (!client) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'No LSP server available for this file type. Supported extensions: .ts, .tsx, .js, .jsx, .py',
                },
              ],
              isError: true,
            };
          }

          const references = await client.findReferences(params.filePath, params.line, params.character);

          if (!references || references.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'No references found.',
                },
              ],
            };
          }

          const formatted = references
            .map((ref) => {
              const filePath = ref.uri.replace('file://', '');
              const line = ref.range.start.line + 1;
              const char = ref.range.start.character + 1;
              return `${filePath}:${line}:${char}`;
            })
            .join('\n');

          return {
            content: [
              {
                type: 'text',
                text: `Found ${references.length} reference(s):\n${formatted}`,
              },
            ],
          };
        },
      },
    ];
  }

  async onToolFinished(event: ToolFinishedEvent, context: ExtensionContext): Promise<void | Partial<ToolFinishedEvent>> {
    context.log(`onToolFinished called for tool: ${event.toolName}`, 'info');

    if (event.toolName !== FILE_EDIT_TOOL && event.toolName !== FILE_WRITE_TOOL) {
      context.log(`Tool ${event.toolName} is not a file edit/write tool, skipping`, 'info');
      return;
    }

    const filePath = event.input?.filePath as string | undefined;
    if (!filePath) {
      context.log('No filePath in tool input, skipping', 'info');
      return;
    }

    context.log(`Processing file: ${filePath}`, 'info');

    const ext = path.extname(filePath);
    const projectDir = context.getProjectDir();
    const manager = this.getManager(projectDir, context);

    context.log(`File extension: ${ext}, project dir: ${projectDir}`, 'info');

    if (!manager.isExtensionSupported(ext)) {
      context.log(`Extension ${ext} is not supported by LSP, skipping`, 'info');
      return;
    }

    context.log(`Extension ${ext} is supported, getting LSP client...`, 'info');

    const client = await manager.getClient(filePath, projectDir);
    if (!client) {
      context.log(`Failed to get LSP client for ${filePath}`, 'info');
      return;
    }

    context.log(`Got LSP client (server: ${client.serverId}), notifying file changed...`, 'info');

    try {
      await client.notifyFileChanged(filePath);
      context.log(`File change notified, waiting for diagnostics (timeout: ${DIAGNOSTIC_WAIT_TIMEOUT_MS}ms)...`, 'info');

      const diagnostics = await client.waitForDiagnostics(filePath, DIAGNOSTIC_WAIT_TIMEOUT_MS);
      context.log(`Received ${diagnostics.length} diagnostic(s) for ${filePath}`, 'info');

      const errors = diagnostics.filter((d) => d.severity === 1);
      context.log(`Filtered to ${errors.length} error(s) (severity=1)`, 'info');

      if (errors.length === 0) {
        context.log('No errors found, returning without modifying output', 'info');
        return;
      }

      context.log(`Formatting ${errors.length} error(s) for tool output`, 'info');

      const formatted = this.formatDiagnosticsForToolOutput(filePath, errors);
      const currentOutput = typeof event.output === 'string' ? event.output : '';

      context.log(`Appending diagnostics to tool output (original length: ${currentOutput.length})`, 'info');

      return {
        output: `${currentOutput}\n\n${formatted}`,
      };
    } catch (error) {
      context.log(`LSP error for ${filePath}: ${error}`, 'error');
    }
  }

  private formatDiagnosticsForToolOutput(filePath: string, diagnostics: LspDiagnostic[]): string {
    const fileName = path.basename(filePath);
    const lines: string[] = [`⚠️ ${fileName} has ${diagnostics.length} error(s):`, '<file_diagnostics>'];

    for (const diag of diagnostics) {
      const line = diag.range.start.line + 1;
      const col = diag.range.start.character + 1;
      const source = diag.source ? ` [${diag.source}]` : '';
      lines.push(`error${source} [${line}:${col}] ${diag.message}`);
    }

    lines.push('</file_diagnostics>');
    return lines.join('\n');
  }
}
