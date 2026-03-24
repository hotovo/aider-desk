/**
 * Permission Gate Extension
 *
 * Prompts for confirmation before running potentially dangerous bash commands.
 * Patterns checked: rm -rf, sudo, chmod/chown 777
 */

import type { Extension, ExtensionContext, ToolCalledEvent } from '@aiderdesk/extensions';

const dangerousPatterns = [/\brm\s+(-rf?|--recursive)/i, /\bsudo\b/i, /\b(chmod|chown)\b.*777/i];

export default class PermissionGateExtension implements Extension {
  static metadata = {
    name: 'Permission Gate',
    version: '1.0.0',
    description: 'Prompts for confirmation before running potentially dangerous bash commands (rm -rf, sudo, chmod/chown 777)',
    author: 'wladimiiir',
    capabilities: ['security'],
  };

  async onLoad(context: ExtensionContext) {
    context.log('Permission Gate Extension loaded', 'info');
  }

  async onToolCalled(event: ToolCalledEvent, context: ExtensionContext): Promise<void | Partial<ToolCalledEvent>> {
    context.log(`onToolCalled triggered: toolName=${event.toolName}`, 'debug');

    if (event.toolName !== 'power---bash') {
      context.log(`Ignoring non-bash tool: ${event.toolName}`, 'debug');
      return undefined;
    }

    const command = (event.input as { command?: string })?.command;
    context.log(`Bash command detected: ${command}`, 'debug');

    if (typeof command !== 'string') {
      context.log('Command is not a string, skipping', 'warn');
      return undefined;
    }

    const isDangerous = dangerousPatterns.some((p) => p.test(command));
    context.log(`Dangerous check result: ${isDangerous}`, 'debug');

    if (isDangerous) {
      context.log(`Dangerous command detected: ${command}`, 'warn');

      const taskContext = context.getTaskContext();
      if (!taskContext) {
        context.log('Dangerous command blocked (no task context for confirmation)', 'warn');
        return { output: 'Bash command execution denied by extension. Reason: Internal error in extension.' };
      }

      context.log('Asking user for confirmation...', 'info');
      const answer = await taskContext.askQuestion(`⚠️ Dangerous command:\n\n  ${command}\n\nAllow?`, {
        answers: [
          { text: '(Y)es', shortkey: 'y' },
          { text: '(N)o', shortkey: 'n' },
        ],
        defaultAnswer: 'No',
      });

      context.log(`User answered: ${answer}`, 'debug');

      if (answer !== '(Y)es') {
        context.log(`Blocked dangerous command: ${command}`, 'info');
        return { output: 'Bash command execution denied by extension. Reason: This is dangerous command and should not be executed.'};
      }

      context.log(`Allowed dangerous command: ${command}`, 'info');
    }

    return undefined;
  }
}
