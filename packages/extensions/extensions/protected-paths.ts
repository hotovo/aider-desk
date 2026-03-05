/**
 * Protected Paths Extension
 *
 * Blocks write and edit operations to protected paths.
 * Useful for preventing accidental modifications to sensitive files.
 */

import type {
  Extension,
  ExtensionContext,
  ToolCalledEvent,
} from '@aiderdesk/extensions';

const protectedPaths = ['.env', '.git/', 'node_modules/'];

export default class ProtectedPathsExtension implements Extension {
  static metadata = {
    name: 'Protected Paths Extension',
    version: '1.0.0',
    description: 'Blocks write and edit operations to protected paths (.env, .git/, node_modules/)',
    author: 'wladimiiir',
    capabilities: ['events'],
  };

  async onLoad(context: ExtensionContext) {
    context.log('Protected Paths Extension loaded', 'info');
  }

  async onToolCalled(event: ToolCalledEvent, context: ExtensionContext): Promise<void | Partial<ToolCalledEvent>> {
    context.log(`onToolCalled triggered: toolName=${event.toolName}`, 'info');

    if (event.toolName !== 'power---file_write' && event.toolName !== 'power---file_edit' && event.toolName !== 'power---file_read') {
      context.log(`Ignoring non-file tool: ${event.toolName}`, 'info');
      return undefined;
    }

    const path = (event.input as { filePath?: string })?.filePath;
    context.log(`File operation detected on path: ${path}`, 'info');

    if (typeof path !== 'string') {
      context.log('Path is not a string, skipping', 'warn');
      return undefined;
    }

    const isProtected = protectedPaths.some((p) => path.includes(p));
    context.log(`Protected check result: ${isProtected} for path: ${path}`, 'info');

    if (isProtected) {
      context.log(`Blocked operation on protected path: ${path}`, 'warn');

      const taskContext = context.getTaskContext();
      if (taskContext) {
        taskContext.addLogMessage('warning', `Blocked write to protected path: ${path}`);
      }

      return { output: 'You are not allowed to read this file.' };
    }

    return undefined;
  }
}
