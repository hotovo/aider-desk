/**
 * Example Extension: Custom Command Registration
 *
 * This example demonstrates how to register custom commands that have full control
 * over their execution logic. Extension commands can perform any operations and
 * are responsible for sending prompts to the agent/aider if needed.
 *
 * Extension commands differ from file-based custom commands:
 * - File-based commands: Use templates with placeholder substitution
 * - Extension commands: Have execute functions with complete control over logic
 *
 * Usage:
 * 1. Copy this file to ~/.aider-desk/extensions/
 * 2. In AiderDesk chat: /generate-tests src/utils/helper.ts vitest
 * 3. Or: /review-pr
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import type { Extension, ExtensionContext, CommandDefinition } from '../../build/types/extension-types';

class CommandExampleExtension implements Extension {
  async onLoad(context: ExtensionContext) {
    context.log('Command Example Extension loaded', 'info');
  }

  getCommands(): CommandDefinition[] {
    return [
      {
        name: 'generate-tests',
        description: 'Generate comprehensive unit tests for a file',
        arguments: [
          { description: 'File path to generate tests for', required: true },
          { description: 'Test framework (jest, vitest, mocha)', required: false },
        ],
        execute: async (args: string[], context: ExtensionContext) => {
          const filePath = args[0];
          const framework = args[1] || 'vitest';

          // Get the project directory
          const projectDir = context.getProjectDir();
          const fullPath = path.join(projectDir, filePath);

          try {
            // Read the file content
            const fileContent = await fs.readFile(fullPath, 'utf-8');

            // Build a comprehensive prompt
            const prompt = `Generate comprehensive unit tests for the file: ${filePath}

**Test Framework**: ${framework}

**File Content**:
\`\`\`typescript
${fileContent}
\`\`\`

**Requirements**:
1. Create a new test file with proper naming convention
2. Include tests for all public functions/methods
3. Cover edge cases and error scenarios
4. Add appropriate mocking for dependencies
5. Follow ${framework} best practices
6. Include setup/teardown if needed

Please create the test file with complete, ready-to-run tests.`;

            // Send the prompt to agent/aider for execution
            await context.runPrompt(prompt, 'agent');
          } catch {
            context.log(`Failed to read file: ${filePath}`, 'error');
            const fallbackPrompt = `Generate unit tests for ${filePath} using ${framework} framework with comprehensive coverage including edge cases and error handling.`;
            await context.runPrompt(fallbackPrompt, 'agent');
          }
        },
      },
      {
        name: 'review-pr',
        description: 'Review pull request changes with detailed analysis',
        execute: async (args: string[], context: ExtensionContext) => {
          const _projectDir = context.getProjectDir();

          context.log('Starting PR review...', 'info');

          // Build a comprehensive review prompt
          const prompt = `Please review the current pull request changes.

**Review Checklist**:

1. **Code Quality**
   - Are the changes following project conventions?
   - Is the code readable and maintainable?
   - Are there any code smells or anti-patterns?

2. **Testing**
   - Are there appropriate tests for the changes?
   - Do existing tests still pass?
   - Is test coverage adequate?

3. **Security**
   - Are there any security vulnerabilities?
   - Is user input properly validated?
   - Are sensitive data properly protected?

4. **Performance**
   - Are there any performance concerns?
   - Are there any unnecessary operations?
   - Is resource usage optimal?

5. **Documentation**
   - Are complex parts properly documented?
   - Is the README updated if needed?
   - Are API changes documented?

Please provide a detailed review addressing these points.`;

          await context.runPrompt(prompt, 'agent');
        },
      },
      {
        name: 'refactor-extract',
        description: 'Extract code into a reusable function or component',
        arguments: [
          { description: 'File path containing code to extract', required: true },
          { description: 'Line numbers or description of code to extract', required: true },
          { description: 'New function/component name', required: false },
        ],
        execute: async (args: string[], context: ExtensionContext) => {
          const filePath = args[0];
          const codeLocation = args[1];
          const newName = args[2] || 'extractedFunction';

          const prompt = `Extract reusable code from ${filePath}.

**Code to Extract**: ${codeLocation}
**New Name**: ${newName}

**Steps**:
1. Identify the code block at ${codeLocation}
2. Extract it into a new function/component named '${newName}'
3. Identify and parameterize dependencies
4. Replace the original code with a call to the new function
5. Add appropriate TypeScript types
6. Add JSDoc documentation
7. Consider if it should be in a separate file

Please perform this refactoring while maintaining the same functionality.`;

          await context.runPrompt(prompt, 'code');
        },
      },
      {
        name: 'create-component',
        description: 'Create a new React component with boilerplate',
        arguments: [
          { description: 'Component name (PascalCase)', required: true },
          { description: 'Component type (functional, class)', required: false },
        ],
        execute: async (args: string[], context: ExtensionContext) => {
          const componentName = args[0];
          const componentType = args[1] || 'functional';

          const settings = await context.getSetting('components.directory');
          const componentsDir = (settings as string) || 'src/components';

          const prompt = `Create a new React component: ${componentName}

**Component Type**: ${componentType}
**Location**: ${componentsDir}/${componentName}

**Files to Create**:
1. ${componentName}.tsx - Main component file
2. ${componentName}.module.css - Component styles (CSS modules)
3. index.ts - Barrel export
4. ${componentName}.test.tsx - Component tests

**Component Requirements**:
- Use TypeScript with proper type definitions
- Include Props interface (even if empty initially)
- Add appropriate prop validation
- Include basic styling structure
- Add a simple test to verify rendering
- Follow project conventions

Please create all files with the appropriate boilerplate code.`;

          await context.runPrompt(prompt, 'code');
        },
      },
      {
        name: 'explain-code',
        description: 'Explain complex code with detailed documentation',
        arguments: [{ description: 'File path or code snippet', required: true }],
        execute: async (args: string[], _context: ExtensionContext) => {
          const target = args[0];
          const projectDir = _context.getProjectDir();

          // Try to read as file, otherwise treat as description
          try {
            const fullPath = path.join(projectDir, target);
            const content = await fs.readFile(fullPath, 'utf-8');
            const prompt = `Explain the following code from ${target} in detail:

\`\`\`
${content}
\`\`\`

**Explanation Should Include**:
1. **Overview**: What does this code do?
2. **Flow**: Step-by-step execution flow
3. **Key Concepts**: Important patterns or techniques used
4. **Dependencies**: What does it depend on?
5. **Potential Issues**: Edge cases or gotchas
6. **Improvements**: Suggestions for enhancement

Please provide a comprehensive, beginner-friendly explanation.`;

            await _context.runPrompt(prompt, 'ask');
          } catch {
            const prompt = `Explain the code related to: ${target}

Please provide a detailed explanation covering:
1. What the code does
2. How it works
3. Key concepts and patterns
4. Potential edge cases
5. Suggestions for improvement`;

            await _context.runPrompt(prompt, 'ask');
          }
        },
      },
    ];
  }
}

// Export metadata
export const metadata = {
  name: 'Command Example Extension',
  version: '1.0.0',
  description: 'Example extension demonstrating custom command registration with full execution control',
  author: 'AiderDesk Team',
  capabilities: ['commands'],
};

export default CommandExampleExtension;
