/**
 * Destructive Command Guard (dcg) Extension
 *
 * Intercepts bash commands and blocks dangerous git/shell operations
 * using the dcg (Destructive Command Guard) CLI tool.
 *
 * Prerequisites:
 *   Install dcg: https://github.com/Dicklesworthstone/destructive_command_guard
 *
 * Commands:
 *   /dcg on     - Enable command guarding
 *   /dcg off    - Disable command guarding
 *   /dcg status - Show current status
 *
 * Source: https://github.com/Dicklesworthstone/destructive_command_guard
 */

import { execFileSync } from 'node:child_process';

import { OS } from '@aiderdesk/extensions';
import type {
  CommandDefinition,
  Extension,
  ExtensionContext,
  ToolCalledEvent,
} from '@aiderdesk/extensions';

const DCG_BINARY = 'dcg';
const DCG_TIMEOUT_MS = 10_000;

let dcgAvailable: boolean | null = null;
let guardEnabled = true;

interface DcgHookOutput {
  hookSpecificOutput?: {
    hookEventName?: string;
    permissionDecision?: 'allow' | 'deny';
    permissionDecisionReason?: string;
  };
}

const getBinaryLookupCommand = (): string =>
  process.platform === 'win32' ? 'where' : 'which';

const checkDcgAvailable = (context: ExtensionContext): boolean => {
  if (dcgAvailable !== null) {
    return dcgAvailable;
  }

  try {
    execFileSync(getBinaryLookupCommand(), [DCG_BINARY], {
      stdio: 'ignore',
      timeout: 3000,
    });
    dcgAvailable = true;
    context.log('dcg binary found in PATH', 'debug');
  } catch {
    dcgAvailable = false;
    context.log(
      'dcg not found in PATH. Install it from https://github.com/Dicklesworthstone/destructive_command_guard',
      'warn',
    );
  }

  return dcgAvailable;
};

const evaluateCommand = (
  command: string,
  context: ExtensionContext,
): { blocked: boolean; reason?: string } => {
  try {
    const hookInput = JSON.stringify({
      tool_name: 'Bash',
      tool_input: { command },
    });

    const result = execFileSync(DCG_BINARY, [], {
      input: hookInput,
      encoding: 'utf-8',
      timeout: DCG_TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (!result || !result.trim()) {
      return { blocked: false };
    }

    const parsed = JSON.parse(result) as DcgHookOutput;
    const decision = parsed.hookSpecificOutput?.permissionDecision;
    const reason = parsed.hookSpecificOutput?.permissionDecisionReason;

    if (decision === 'deny') {
      context.log(`dcg blocked command: ${command}`, 'info');
      return { blocked: true, reason };
    }

    return { blocked: false };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.log(`dcg evaluation error: ${errorMessage}`, 'error');
    return { blocked: false };
  }
};

const DCG_COMMAND: CommandDefinition = {
  name: 'dcg',
  description: 'Enable or disable Destructive Command Guard',
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
        guardEnabled = true;
        sendMessage('🛡️ Destructive Command Guard enabled');
        context.log('Guarding enabled', 'info');
        break;

      case 'off':
        guardEnabled = false;
        sendMessage('🛡️ Destructive Command Guard disabled');
        context.log('Guarding disabled', 'info');
        break;

      case 'status':
        sendMessage(`Destructive Command Guard status:
  Enabled: ${guardEnabled ? '✓ yes' : '✗ no'}
  dcg binary: ${dcgAvailable === null ? 'not checked' : dcgAvailable ? '✓ installed' : '✗ not found'}`);
        break;

      default:
        sendMessage(`Usage: /dcg <action>

Actions:
  on     - Enable command guarding
  off    - Disable command guarding
  status - Show current status

Current state: ${guardEnabled ? 'enabled' : 'disabled'}`);
        break;
    }
  },
};

export default class DestructiveCommandGuardExtension implements Extension {
  static metadata = {
    name: 'Destructive Command Guard',
    version: '1.0.0',
    description:
      'Blocks dangerous git and shell commands from being executed by agents using dcg',
    author: 'wladimiiir',
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/destructive-command-guard/icon.png',
    capabilities: ['security', 'commands'],
  };

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('Destructive Command Guard extension loaded', 'info');
    checkDcgAvailable(context);
  }

  getCommands(_context: ExtensionContext): CommandDefinition[] {
    return [DCG_COMMAND];
  }

  async onToolCalled(
    event: ToolCalledEvent,
    context: ExtensionContext,
  ): Promise<void | Partial<ToolCalledEvent>> {
    if (event.toolName !== 'power---bash') {
      return undefined;
    }

    if (!guardEnabled) {
      return undefined;
    }

    if (!checkDcgAvailable(context)) {
      const taskContext = context.getTaskContext();
      const message =
        '🛡️ Destructive Command Guard: dcg binary not found in PATH — command not evaluated. ' +
        'See the extension README for installation instructions.';
      if (taskContext) {
        taskContext.addLogMessage('error', message);
      } else {
        context.log(message, 'error');
      }
      return undefined;
    }

    const input = event.input as { command?: string } | undefined;
    const command = input?.command;

    if (!command || typeof command !== 'string') {
      return undefined;
    }

    const { blocked, reason } = evaluateCommand(command, context);

    if (!blocked) {
      return undefined;
    }

    return {
      output: `🛡️ BLOCKED by dcg — destructive command detected.${reason ? `\n\n${reason}` : ''}`,
    };
  }
}
