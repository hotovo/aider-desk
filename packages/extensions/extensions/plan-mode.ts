/**
 * Plan Mode Extension
 *
 * Registers a 'plan' mode that enforces planning and analysis before coding.
 * When plan mode is active, context messages are prepended with instructions to
 * create a detailed implementation plan before making any code changes.
 *
 * Usage:
 * 1. This extension automatically registers the 'plan' mode
 * 2. Select 'Plan' mode from the mode selector in AiderDesk
 * 3. Enter your request - the extension will prepend planning instructions
 */

import type {
  Extension,
  ExtensionContext,
  ModeDefinition,
  AgentStartedEvent,
} from '@aiderdesk/extensions';

const PLAN_USER_MESSAGE = `You are in planning mode. Before making any code changes, you must first create or update a detailed implementation plan in a file called plan.md.

**Planning Document Structure**:
1. **Goal**: Clearly state what we're trying to achieve
2. **Analysis**: Break down the request into actionable steps
3. **Files to Modify**: List all files that will need to be modified or created
4. **Dependencies**: Consider how changes might affect other parts of the codebase
5. **Implementation Steps**: Outline the specific changes for each file
6. **Risks & Considerations**: Note any potential issues or edge cases

**Important**:
- Create or edit the plan.md file with your analysis
- After presenting your plan, ask the user: "May I proceed with this plan?"
- Wait for user confirmation before making any code changes`;

const PLAN_ASSISTANT_MESSAGE = `OK, I will follow the instructions and create a plan file for you.`;

export default class PlanModeExtension implements Extension {
  static metadata = {
    name: 'Plan Mode',
    version: '1.1.0',
    description: 'Adds a Plan mode that enforces planning and analysis before making code changes',
    author: 'wladimiiir',
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/plan-mode.png',
    capabilities: ['modes'],
  };

  async onLoad(context: ExtensionContext) {
    context.log('Plan Mode Extension loaded', 'info');
  }

  getModes(): ModeDefinition[] {
    return [
      {
        name: 'plan',
        label: 'Plan',
        description: 'Plan and analyze before coding',
        icon: 'GoProjectRoadmap',
      },
    ];
  }

  async onAgentStarted(event: AgentStartedEvent, context: ExtensionContext): Promise<void | Partial<AgentStartedEvent>> {
    if (event.mode !== 'plan') {
      return undefined;
    }

    context.log('Plan mode active - prepending planning instructions to context messages', 'info');

    const planUserMessage = {
      id: 'plan-mode-instructions-user',
      role: 'user' as const,
      content: PLAN_USER_MESSAGE,
    };

    const planAssistantMessage = {
      id: 'plan-mode-instructions-assistant',
      role: 'assistant' as const,
      content: PLAN_ASSISTANT_MESSAGE,
    };

    const modifiedContextMessages = [planUserMessage, planAssistantMessage, ...event.contextMessages];

    return { contextMessages: modifiedContextMessages };
  }
}
