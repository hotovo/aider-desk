/**
 * Tree-Sitter Repo Map Extension
 *
 * Provides an enhanced repository map using tree-sitter parsing.
 * When enabled in agent profile (includeRepoMap: true), this extension
 * generates a comprehensive map of the codebase showing:
 * - File structure and definitions
 * - Dependencies and references
 * - Symbol rankings based on PageRank algorithm
 *
 * This replaces the default repo map functionality with a more detailed
 * tree-sitter based implementation.
 */

import { getRepoMap } from '@aiderdesk/tree-sitter-utils';

import { loadConfig, saveConfig } from './config';

import type { Extension, ExtensionContext, AgentStartedEvent, CommandDefinition } from '@aiderdesk/extensions';

const REPO_MAP_USER_PREFIX = 'Here is a map of the repository:';
const REPO_MAP_ASSISTANT_RESPONSE = 'Ok, I will use the repository map as a reference.';

const REPO_MAP_COMMAND: CommandDefinition = {
  name: 'repo-map',
  description: 'Manage repository map settings',
  arguments: [
    {
      description: 'Setting to configure',
      options: ['maxLines', 'exclude'],
      required: false,
    },
    {
      description: 'Value for the setting (comma-separated for exclude patterns)',
      required: false,
    },
  ],
  async execute(args: string[], context: ExtensionContext): Promise<void> {
    const taskContext = context.getTaskContext();
    if (!taskContext) {
      context.log('No active task context available', 'error');
      return;
    }

    const [setting, value] = args;

    if (!setting) {
      // Show current config
      const config = await loadConfig();
      taskContext.addLogMessage('info', `Current repository map settings:\n\nmaxLines: ${config.maxLines}\nexclude: ${config.exclude.join(', ')}`);
      return;
    }

    if (setting === 'maxLines') {
      if (!value) {
        // Show current maxLines
        const config = await loadConfig();
        taskContext.addLogMessage('info', `Current maxLines: ${config.maxLines}`);
        return;
      }

      // Parse and validate the value
      const maxLines = parseInt(value, 10);
      if (isNaN(maxLines) || maxLines < 100) {
        taskContext.addLogMessage('error', 'Invalid maxLines value. Must be a number >= 100.');
        return;
      }

      // Save the new value
      const config = await loadConfig();
      config.maxLines = maxLines;
      await saveConfig(config);

      taskContext.addLogMessage('info', `maxLines updated to ${maxLines}`);
    } else if (setting === 'exclude') {
      if (!value) {
        // Show current exclude patterns
        const config = await loadConfig();
        taskContext.addLogMessage('info', `Current exclude patterns: ${config.exclude.join(',')}`);
        return;
      }

      // Parse comma-separated patterns
      const excludePatterns = value
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      if (excludePatterns.length === 0) {
        taskContext.addLogMessage('error', 'Invalid exclude patterns. Provide at least one pattern.');
        return;
      }

      // Save the new value
      const config = await loadConfig();
      config.exclude = excludePatterns;
      await saveConfig(config);

      taskContext.addLogMessage('info', `exclude patterns updated to: ${excludePatterns.join(',')}`);
    } else {
      taskContext.addLogMessage(
        'error',
        `Unknown setting: ${setting}\n\nAvailable settings:\n- maxLines: Maximum number of lines in the repository map\n- exclude: Comma-separated list of patterns to exclude`,
      );
    }
  },
};

class TreeSitterRepoMapExtension implements Extension {
  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('Tree-Sitter Repo Map Extension loaded', 'info');
  }

  getCommands(_context: ExtensionContext): CommandDefinition[] {
    return [REPO_MAP_COMMAND];
  }

  async onAgentStarted(event: AgentStartedEvent, context: ExtensionContext): Promise<void | Partial<AgentStartedEvent>> {
    // Only process if includeRepoMap is enabled
    if (!event.agentProfile.includeRepoMap) {
      return undefined;
    }

    context.log('Generating tree-sitter based repository map', 'info');

    try {
      // Get project directory
      const projectDir = context.getProjectDir();
      if (!projectDir) {
        context.log('No project directory available, skipping repo map', 'warn');
        return undefined;
      }

      // Load config to get maxLines
      const config = await loadConfig();

      // Extract mentioned files and identifiers from context
      const mentionedFiles = new Set<string>();
      const mentionedIdents = new Set<string>();
      const chatFiles = new Set<string>();

      // Extract from context files
      for (const file of event.contextFiles) {
        if (file.path) {
          mentionedFiles.add(file.path);
          chatFiles.add(file.path);
        }
      }

      // Extract from context messages (look for file references)
      for (const message of event.contextMessages) {
        if (typeof message.content === 'string') {
          // Simple extraction of potential file paths and identifiers
          const fileMatches = message.content.match(/[\w/.-]+\.(ts|tsx|js|jsx|py|java|go|rs|c|cpp)/g) || [];
          fileMatches.forEach((f) => mentionedFiles.add(f));

          const identMatches = message.content.match(/\b[A-Z][a-zA-Z0-9_]*\b/g) || [];
          identMatches.forEach((i) => mentionedIdents.add(i));
        }
      }

      // Generate the repository map using the library
      const repoMap = await getRepoMap(projectDir, {
        excludePatterns: config.exclude,
        mentionedFiles,
        mentionedIdents,
        chatFiles,
        maxLines: config.maxLines,
      });

      if (!repoMap) {
        context.log('No repository map generated', 'warn');
        return undefined;
      }

      // Build the content message
      const content = `${REPO_MAP_USER_PREFIX}\n\n${repoMap}`;

      // Create user and assistant messages
      const repoMapUserMessage = {
        id: 'tree-sitter-repo-map-user',
        role: 'user' as const,
        content,
      };

      const repoMapAssistantMessage = {
        id: 'tree-sitter-repo-map-assistant',
        role: 'assistant' as const,
        content: REPO_MAP_ASSISTANT_RESPONSE,
      };

      // Prepend to context messages
      const modifiedContextMessages = [repoMapUserMessage, repoMapAssistantMessage, ...event.contextMessages];

      context.log(`Repository map generated and added to context (max ${config.maxLines} lines)`, 'info');

      // Return modified event with includeRepoMap set to false to prevent default
      return {
        contextMessages: modifiedContextMessages,
        agentProfile: {
          ...event.agentProfile,
          includeRepoMap: false,
        },
      };
    } catch (error) {
      context.log(`Error generating repository map: ${error}`, 'error');
      return undefined;
    }
  }
}

export const metadata = {
  name: 'Tree-Sitter Repo Map',
  version: '1.0.0',
  description: 'Provides enhanced repository map using tree-sitter parsing with PageRank-based symbol ranking',
  author: 'AiderDesk',
  capabilities: ['events', 'commands'],
};

export default TreeSitterRepoMapExtension;
