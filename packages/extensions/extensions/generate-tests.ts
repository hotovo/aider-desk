/**
 * Generate Tests Extension
 *
 * Registers a 'generate-tests' command that generates unit tests for a specified file.
 * Uses the agent mode to analyze the file and create comprehensive test coverage.
 *
 * Usage:
 * /generate-tests <file-path>
 *
 * Example:
 * /generate-tests src/utils/helpers.ts
 */

import type { Extension, ExtensionContext, CommandDefinition } from '@aiderdesk/extensions';

const GENERATE_TESTS_COMMAND: CommandDefinition = {
  name: 'generate-tests',
  description: 'Generate unit tests for a file',
  arguments: [
    {
      description: 'Path to the file for which to generate tests',
      required: true,
    },
  ],
  async execute(args: string[], context: ExtensionContext): Promise<void> {
    const fileName = args[0];

    const prompt = `Generate comprehensive unit tests for the file: ${fileName}

Instructions:
1. Analyze the file to understand its exports, functions, and logic
2. Create a test file following the project's existing test patterns
3. Include tests for:
   - Happy path scenarios
   - Edge cases
   - Error handling
   - Type boundaries
4. Use appropriate testing utilities from the project (e.g., Vitest, Jest, React Testing Library)
5. Place the test file in the appropriate location following project conventions`;

    const taskContext = context.getTaskContext();
    if (!taskContext) {
      context.log('No active task context available', 'error');
      return;
    }

    if (!fileName) {
      taskContext.addLogMessage('warning', 'Usage: /generate-tests <file-path>\nExample: /generate-tests src/utils/helpers.ts');
      return;
    }

    await taskContext.runPrompt(prompt, 'agent');
  },
};

export default class GenerateTestsExtension implements Extension {
  static metadata = {
    name: 'Generate Tests Extension',
    version: '1.0.0',
    description: 'Adds a /generate-tests command that generates unit tests for a specified file',
    author: 'wladimiiir',
    capabilities: ['commands'],
  };

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('Generate Tests Extension loaded', 'info');
  }

  getCommands(_context: ExtensionContext): CommandDefinition[] {
    return [GENERATE_TESTS_COMMAND];
  }
}
