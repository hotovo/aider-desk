/**
 * Theme Extension
 *
 * Registers a 'theme' command that switches the AiderDesk theme.
 * Uses updateSettings to change the application theme.
 *
 * Usage:
 * /theme <theme-name>
 *
 * Example:
 * /theme ocean
 *
 * Available themes:
 * - dark, light, charcoal, neon, neopunk, aurora, ocean, forest,
 *   lavender, bw, midnight, serenity, cappuccino, fresh,
 *   botanical-garden, botanical-garden-dark
 */

import type { Extension, ExtensionContext, CommandDefinition } from '@aiderdesk/extensions';

const AVAILABLE_THEMES = [
  'dark',
  'light',
  'charcoal',
  'neon',
  'neopunk',
  'aurora',
  'ocean',
  'forest',
  'lavender',
  'bw',
  'midnight',
  'serenity',
  'cappuccino',
  'fresh',
  'botanical-garden',
  'botanical-garden-dark',
] as const;

const THEME_COMMAND: CommandDefinition = {
  name: 'theme',
  description: 'Switch the AiderDesk theme',
  arguments: [
    {
      description: 'Name of the theme to apply',
      required: true,
      options: [...AVAILABLE_THEMES],
    },
  ],
  async execute(args: string[], context: ExtensionContext): Promise<void> {
    const themeName = args[0];

    const taskContext = context.getTaskContext();
    if (!taskContext) {
      context.log('No active task context available', 'error');
      return;
    }

    if (!themeName) {
      const themesList = AVAILABLE_THEMES.join(', ');
      taskContext.addLogMessage(
        'warning',
        `Usage: /theme <theme-name>\n\nAvailable themes:\n${themesList}\n\nExample: /theme ocean`
      );
      return;
    }

    if (!AVAILABLE_THEMES.includes(themeName as (typeof AVAILABLE_THEMES)[number])) {
      const themesList = AVAILABLE_THEMES.join(', ');
      taskContext.addLogMessage(
        'error',
        `Unknown theme: "${themeName}"\n\nAvailable themes:\n${themesList}`
      );
      return;
    }

    await context.updateSettings({ theme: themeName as any });
    taskContext.addLogMessage('info', `Theme changed to: ${themeName}`);
  },
};

export default class ThemeExtension implements Extension {
  static metadata = {
    name: 'Theme',
    version: '1.0.0',
    description: 'Adds a /theme command to switch AiderDesk themes',
    author: 'wladimiiir',
    capabilities: ['commands'],
  };

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('Theme Extension loaded', 'info');
  }

  getCommands(_context: ExtensionContext): CommandDefinition[] {
    return [THEME_COMMAND];
  }
}
