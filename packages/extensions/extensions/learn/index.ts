import { OS } from '@aiderdesk/extensions';

import { buildLearnPrompt } from './learn-prompt.js';
import { createSaveSkillTool } from './skill-writer.js';

import type { Extension, ExtensionContext, CommandDefinition, ToolDefinition } from '@aiderdesk/extensions';

const LEARN_COMMAND: CommandDefinition = {
  name: 'learn',
  description: 'Learn a reusable skill from anything you describe (dirs, URLs, this chat, notes)',
  arguments: [
    {
      description: 'What to learn from — directories, URLs, "what we just did", pasted notes, or a description',
      required: false,
    },
  ],
  async execute(args: string[], context: ExtensionContext): Promise<void> {
    const userRequest = args.join(' ').trim();
    const prompt = buildLearnPrompt(userRequest);

    const taskContext = context.getTaskContext();
    if (!taskContext) {
      context.log('No active task context available', 'error');
      return;
    }

    await taskContext.runPrompt(prompt, 'agent');
  },
};

export const metadata = {
  name: 'Learn',
  version: '1.0.0',
  description: 'Adds a /learn command that creates reusable skills from any source — directories, URLs, conversation history, or pasted notes',
  iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/learn/icon.png',
  author: 'wladimiiir',
  capabilities: ['commands', 'tools'],
  supportedOS: [OS.Linux, OS.MacOS, OS.Windows],
};

export default class LearnExtension implements Extension {
  static metadata = metadata;

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('Learn Extension loaded', 'info');
  }

  getCommands(_context: ExtensionContext): CommandDefinition[] {
    return [LEARN_COMMAND];
  }

  getTools(_context: ExtensionContext): ToolDefinition[] {
    return [createSaveSkillTool()];
  }
}
