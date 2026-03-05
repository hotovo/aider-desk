/**
 * RTK Auto-Rewrite Extension
 *
 * Transparently rewrites shell commands to their RTK equivalents,
 * reducing LLM token consumption by 60-90% on common dev commands.
 *
 * Prerequisites:
 * 1. Install RTK: brew install rtk (or use install.sh from GitHub)
 * 2. Install jq: brew install jq
 *
 * Commands:
 * /rtk on  - Enable command rewriting
 * /rtk off - Disable command rewriting
 *
 * Source: https://github.com/rtk-ai/rtk
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { CommandDefinition, Extension, ExtensionContext, ToolCalledEvent } from '@aiderdesk/extensions';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REWRITE_SCRIPT_PATH = join(__dirname, 'rtk-rewrite.sh');

let rtkAvailable: boolean | null = null;
let jqAvailable: boolean | null = null;
let scriptExists: boolean | null = null;
let rewriteEnabled = true;

const checkDependencies = (context: ExtensionContext): boolean => {
  if (rtkAvailable === null) {
    try {
      execFileSync('which', ['rtk'], { stdio: 'ignore' });
      rtkAvailable = true;
    } catch {
      rtkAvailable = false;
      context.log('RTK not found in PATH. Install with: brew install rtk', 'warn');
    }
  }

  if (jqAvailable === null) {
    try {
      execFileSync('which', ['jq'], { stdio: 'ignore' });
      jqAvailable = true;
    } catch {
      jqAvailable = false;
      context.log('jq not found in PATH. Install with: brew install jq', 'warn');
    }
  }

  if (scriptExists === null) {
    scriptExists = existsSync(REWRITE_SCRIPT_PATH);
    if (!scriptExists) {
      context.log(`Rewrite script not found: ${REWRITE_SCRIPT_PATH}`, 'warn');
    }
  }

  return rtkAvailable && jqAvailable && scriptExists;
};

const rewriteCommand = (command: string, context: ExtensionContext): string | null => {
  if (!command || typeof command !== 'string') {
    return null;
  }

  try {
    const input = JSON.stringify({
      tool_input: { command },
    });

    const result = execFileSync(REWRITE_SCRIPT_PATH, [], {
      input,
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024,
      timeout: 5000,
    });

    if (!result || !result.trim()) {
      return null;
    }

    const parsed = JSON.parse(result);
    const rewrittenCommand = parsed?.hookSpecificOutput?.updatedInput?.command;

    if (rewrittenCommand && rewrittenCommand !== command) {
      context.log(`Rewrote: "${command}" → "${rewrittenCommand}"`, 'info');
      return rewrittenCommand;
    }

    return null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.log(`Rewrite script error: ${errorMessage}`, 'error');
    return null;
  }
};

const RTK_COMMAND: CommandDefinition = {
  name: 'rtk',
  description: 'Enable or disable RTK command rewriting',
  arguments: [
    {
      description: 'Action to perform',
      required: true,
      options: ['on', 'off', 'status'],
    },
  ],
  async execute(args: string[], context: ExtensionContext): Promise<void> {
    const action = args[0]?.toLowerCase();
    const taskContext = context.getTaskContext();

    const sendMessage = (message: string) => {
      if (taskContext) {
        taskContext.addLogMessage('info', message);
      } else {
        context.log(message, 'info');
      }
    };

    switch (action) {
      case 'on':
        rewriteEnabled = true;
        sendMessage('✓ RTK command rewriting enabled');
        context.log('RTK rewriting enabled', 'info');
        break;

      case 'off':
        rewriteEnabled = false;
        sendMessage('✓ RTK command rewriting disabled');
        context.log('RTK rewriting disabled', 'info');
        break;

      case 'status':
        sendMessage(`RTK status:
  Enabled: ${rewriteEnabled ? '✓ yes' : '✗ no'}
  RTK binary: ${rtkAvailable === null ? 'not checked' : rtkAvailable ? '✓ installed' : '✗ not found'}
  jq binary: ${jqAvailable === null ? 'not checked' : jqAvailable ? '✓ installed' : '✗ not found'}
  Rewrite script: ${scriptExists === null ? 'not checked' : scriptExists ? '✓ found' : '✗ missing'}`);
        break;

      default:
        sendMessage(`Usage: /rtk <action>

Actions:
  on     - Enable command rewriting
  off    - Disable command rewriting
  status - Show current status

Current state: ${rewriteEnabled ? 'enabled' : 'disabled'}`);
        break;
    }
  },
};

export default class RTKExtension implements Extension {
  static metadata = {
    name: 'RTK Auto-Rewrite',
    version: '1.0.0',
    description: 'Transparently rewrites shell commands to RTK equivalents, reducing LLM token consumption by 60-90%',
    author: 'wladimiiir',
    capabilities: ['optimization', 'commands'],
  };

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('RTK Extension loaded', 'info');

    if (!checkDependencies(context)) {
      context.log('RTK extension disabled: missing dependencies', 'warn');
    }
  }

  getCommands(_context: ExtensionContext): CommandDefinition[] {
    return [RTK_COMMAND];
  }

  async onToolCalled(event: ToolCalledEvent, context: ExtensionContext): Promise<void | Partial<ToolCalledEvent>> {
    if (event.toolName !== 'power---bash') {
      return undefined;
    }

    if (!rewriteEnabled) {
      return undefined;
    }

    if (!checkDependencies(context)) {
      return undefined;
    }

    const input = event.input as { command?: string } | undefined;
    const command = input?.command;

    if (!command) {
      return undefined;
    }

    const rewrittenCommand = rewriteCommand(command, context);

    if (!rewrittenCommand) {
      return undefined;
    }

    return {
      input: {
        ...input,
        command: rewrittenCommand,
      },
    };
  }
}
