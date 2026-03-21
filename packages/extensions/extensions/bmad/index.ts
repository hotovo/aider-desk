/**
 * BMAD Extension
 *
 * Provides BMAD (Breakthrough Method for Agile AI-Driven Development) mode
 * with structured workflows for planning, designing, and implementing software projects.
 *
 * Features:
 * - Registers 'bmad' mode for structured development workflows
 * - Welcome page UI with workflow selection and progress tracking
 * - Task actions UI showing current workflow and suggested next steps
 * - BMAD action extraction from assistant messages
 *
 * Usage:
 * 1. This extension automatically registers the 'bmad' mode
 * 2. Select 'BMAD' mode from the mode selector in AiderDesk
 * 3. Use the welcome page to start workflows
 * 4. Task actions show current workflow progress and next steps
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { BmadManager } from './lib/bmad-manager';
import { ContextPreparer } from './lib/context-preparer';
import { BMAD_WORKFLOWS as _BMAD_WORKFLOWS } from './lib/workflows';
import { generateSuggestions } from './lib/bmad-suggestions';
import { BmadAction } from './lib/types';

import type {
  Extension,
  ExtensionContext,
  ModeDefinition,
  UIComponentDefinition,
  TaskUpdatedEvent,
  AgentStartedEvent,
  ContextMessage,
  ToolApprovalEvent,
} from '@aiderdesk/extensions';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// BMAD Actions that can be extracted from assistant messages
const BMAD_ACTIONS: Array<{ letter: string; label: string }> = [
  { letter: 'Y', label: 'Yes' },
  { letter: 'N', label: 'No' },
  { letter: 'C', label: 'Continue' },
  { letter: 'C', label: 'Complete' },
  { letter: 'E', label: 'Edit' },
  { letter: 'Q', label: 'Questions' },
  { letter: 'A', label: 'Advanced Elicitation' },
  { letter: 'P', label: 'Party Mode' },
];

// Component IDs
const WELCOME_PAGE_ID = 'bmad-welcome-page';
const TASK_ACTIONS_ID = 'bmad-task-actions';

// Track previous mode per task to detect mode changes
const previousModes = new Map<string, string>();

// Manager instances per project
const managers = new Map<string, BmadManager>();

/**
 * Extract BMAD actions from the last assistant message
 */
const extractBmadActions = (lastAssistantMessage: ContextMessage | undefined): BmadAction[] | undefined => {
  if (!lastAssistantMessage || lastAssistantMessage.role !== 'assistant') {
    return undefined;
  }

  // Extract text content from message
  let content = '';
  if (typeof lastAssistantMessage.content === 'string') {
    content = lastAssistantMessage.content;
  } else if (Array.isArray(lastAssistantMessage.content)) {
    // Content is an array of parts, extract text from parts with type='text'
    content = lastAssistantMessage.content
      .filter((part) => typeof part === 'object' && part !== null && 'type' in part && part.type === 'text' && 'text' in part)
      .map((part) => (part as { type: 'text'; text: string }).text)
      .join('\n');
  }

  const lines = content.split('\n');
  const lastTenLines = lines.slice(-10);

  const extractedActions: BmadAction[] = [];

  for (const line of lastTenLines) {
    for (const action of BMAD_ACTIONS) {
      if (line.toLowerCase().replaceAll('*', '').includes(`[${action.letter}] ${action.label}`.toLowerCase())) {
        extractedActions.push({
          actionLetter: action.letter,
          actionName: action.label,
        });
      }
    }
  }

  return extractedActions.length > 0 ? extractedActions : undefined;
};

/**
 * Get or create a BmadManager for a project
 */
const getManager = (projectDir: string, context: ExtensionContext): BmadManager => {
  let manager = managers.get(projectDir);
  if (!manager) {
    manager = new BmadManager(projectDir, context);
    managers.set(projectDir, manager);
  }
  return manager;
};

export default class BmadExtension implements Extension {
  static metadata = {
    name: 'BMAD Method',
    version: '1.0.0',
    description: 'Provides BMAD mode with structured workflows for planning, designing, and implementing software projects',
    author: 'AiderDesk',
    capabilities: ['modes', 'ui', 'workflows'],
  };

  async onLoad(context: ExtensionContext) {
    context.log('BMAD Extension loaded', 'info');
  }

  getModes(_context: ExtensionContext): ModeDefinition[] {
    return [
      {
        name: 'bmad',
        label: 'BMAD',
        description:
          "Guided workflows for planning, spec'ing, and implementing features",
        icon: 'FiLayers',
      },
    ];
  }

  getUIComponents(context: ExtensionContext): UIComponentDefinition[] {
    // Get current mode from task context
    const taskContext = context.getTaskContext();
    const currentMode = taskContext?.data?.currentMode;

    // Only return components if mode is 'bmad'
    if (currentMode !== 'bmad') {
      return [];
    }

    // Read JSX templates from files
    const welcomePageJsx = readFileSync(join(__dirname, './ui/WelcomePage.jsx'), 'utf-8');
    const taskActionsJsx = readFileSync(join(__dirname, './ui/TaskActions.jsx'), 'utf-8');

    return [
      {
        id: WELCOME_PAGE_ID,
        placement: 'welcome-page',
        jsx: welcomePageJsx,
        loadData: true,
        noDataCache: true
      },
      {
        id: TASK_ACTIONS_ID,
        placement: 'task-state-actions-all',
        jsx: taskActionsJsx,
        loadData: true,
        noDataCache: true,
      },
    ];
  }

  async onTaskUpdated(event: TaskUpdatedEvent, context: ExtensionContext): Promise<void | Partial<TaskUpdatedEvent>> {
    const taskId = event.task.id;
    const currentMode = event.task.currentMode;
    const previousMode = previousModes.get(taskId);

    context.log(`Task updated: ${taskId}, currentMode: ${currentMode}, previousMode: ${previousMode}`, 'debug');
    // Detect mode change
    if (currentMode !== previousMode) {
      previousModes.set(taskId, currentMode || '');

      // Trigger UI components reload when mode changes
      if (currentMode === 'bmad' || previousMode === 'bmad' || previousMode === undefined) {
        context.triggerUIComponentsReload();
      }
    }

    return undefined;
  }

  async onAgentStarted(event: AgentStartedEvent, context: ExtensionContext): Promise<void | Partial<AgentStartedEvent>> {
    if (event.mode !== 'bmad') {
      return undefined;
    }

    context.log('BMAD mode active - preparing workflow context', 'debug');

    const projectDir = context.getProjectDir();
    const taskContext = context.getTaskContext();

    if (!taskContext) {
      return undefined;
    }

    // Get current workflow from task metadata
    const workflowId = taskContext.data.metadata?.bmadWorkflowId as string | undefined;
    if (!workflowId) {
      return undefined;
    }

    const manager = getManager(projectDir, context);
    const status = await manager.getBmadStatus();

    // Prepare context using ContextPreparer
    const preparer = new ContextPreparer(projectDir, context);
    const preparedContext = await preparer.prepare(workflowId, status);

    context.log(`Context prepared for workflow: ${workflowId}`, 'debug');

    // Return modified context messages
    if (preparedContext.contextMessages.length > 0) {
      return {
        contextMessages: [...preparedContext.contextMessages, ...event.contextMessages],
      };
    }

    return undefined;
  }

  async getUIExtensionData(componentId: string, context: ExtensionContext): Promise<unknown> {
    const projectDir = context.getProjectDir();
    const taskContext = context.getTaskContext();

    if (!projectDir) {
      return { status: null, error: 'No project directory' };
    }

    const manager = getManager(projectDir, context);

    try {
      const status = await manager.getBmadStatus();

      if (componentId === WELCOME_PAGE_ID) {
        const suggestedWorkflows = generateSuggestions(status.completedWorkflows, status.detectedArtifacts, status.sprintStatus, taskContext?.data?.metadata);

        return {
          status,
          suggestedWorkflows,
          isLoading: false,
          error: null,
        };
      }

      if (componentId === TASK_ACTIONS_ID) {
        // Get current workflow from task metadata
        const currentWorkflowId = taskContext?.data?.metadata?.bmadWorkflowId as string | undefined;
        const currentWorkflow = currentWorkflowId ? (status.availableWorkflows.find((w) => w.id === currentWorkflowId) ?? null) : null;

        // Generate suggestions
        const suggestedWorkflows = generateSuggestions(status.completedWorkflows, status.detectedArtifacts, status.sprintStatus, taskContext?.data?.metadata);

        // Extract BMAD actions from messages
        let bmadActions: BmadAction[] = [];
        if (taskContext) {
          try {
            const messages = await taskContext.getContextMessages();
            // Find the last assistant message
            const lastAssistantMessage = messages
              .slice()
              .reverse()
              .find((message) => message.role === 'assistant');

            context.log(`Last assistant message: ${JSON.stringify(lastAssistantMessage)}`, 'info');

            bmadActions = extractBmadActions(lastAssistantMessage) || [];
          } catch (error) {
            context.log(`Failed to extract BMAD actions: ${error}`, 'error');
          }
        }

        return {
          status,
          currentWorkflow,
          suggestedWorkflows,
          bmadActions,
          error: null,
        };
      }
    } catch (error) {
      context.log(`Failed to get BMAD status: ${error}`, 'error');
      return {
        status: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    return undefined;
  }

  async onToolApproval(event: ToolApprovalEvent, context: ExtensionContext): Promise<void | Partial<ToolApprovalEvent>> {
    // Auto-approve file operations in _bmad-output/ directory
    if (
      event.toolName === "power---file_edit" ||
      event.toolName === "power---file_write"
    ) {
      const filePath = (event.input as { filePath?: string })?.filePath;
      if (typeof filePath !== "string") {
        return undefined;
      }

      // Check if the file is inside _bmad-output/ directory
      if (filePath.includes("_bmad-output/")) {
        context.log(
          `Auto-approving ${event.toolName} for ${filePath}`,
          "debug",
        );
        return { allowed: true };
      }
    }

    if (event.toolName === "power---bash") {
      const command = (event.input as { command?: string })?.command;
      if (typeof command !== "string") {
        return undefined;
      }
      if (command.includes("_bmad-output/") || command.includes("git diff")) {
        context.log(
          `Auto-approving ${event.toolName} for ${command}`,
          "debug",
        );
        return { allowed: true };
      }
    }

    return undefined;
  }

  async executeUIExtensionAction(componentId: string, action: string, args: unknown[], context: ExtensionContext): Promise<unknown> {
    const projectDir = context.getProjectDir();
    const taskContext = context.getTaskContext();

    if (!projectDir) {
      return { success: false, error: 'No project directory' };
    }

    const manager = getManager(projectDir, context);

    try {
      switch (action) {
        case 'install': {
          const result = await manager.install();
          // Trigger UI refresh after installation
          context.triggerUIDataRefresh(WELCOME_PAGE_ID);
          return result;
        }

        case 'reset-workflow': {
          const result = await manager.resetWorkflow();
          // Trigger UI refresh after reset
          context.triggerUIDataRefresh(WELCOME_PAGE_ID);
          context.triggerUIDataRefresh(TASK_ACTIONS_ID);
          return result;
        }

        case 'get-status': {
          // Just trigger a refresh
          context.triggerUIDataRefresh(componentId);
          return { success: true };
        }

        case 'run-action': {
          const actionName = args[0] as string;

          if (!actionName) {
            return { success: false, error: 'Action name is required' };
          }

          if (!taskContext) {
            return { success: false, error: 'Task context is required' };
          }

          try {
            // Run the prompt with the action name
            await taskContext.runPrompt(actionName, 'bmad');
            context.log(`Ran BMAD action: ${actionName}`, 'info');
            return { success: true };
          } catch (error) {
            context.log(`Failed to run action '${actionName}': ${error}`, 'error');
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        }

        case 'execute-workflow': {
          const workflowId = args[0] as string;
          const _taskId = args[1] as string;
          const provider = args[2] as string | undefined;
          const model = args[3] as string | undefined;
          const asSubtask = args[4] as boolean | undefined;

          if (!workflowId) {
            return { success: false, error: 'Workflow ID is required' };
          }

          if (!taskContext) {
            return { success: false, error: 'Task context is required' };
          }

          // Execute workflow using BmadManager
          const result = await manager.executeWorkflow(workflowId, taskContext, provider, model, asSubtask);

          if (result.success) {
            context.log(`Workflow '${workflowId}' started`, 'debug');
          }

          return result;
        }

        case 'open-artifact': {
          const artifactPath = args[0] as string;

          if (!artifactPath) {
            return { success: false, error: 'Artifact path is required' };
          }

          const opened = await context.openPath(artifactPath);

          if (opened) {
            context.log(`Opened artifact: ${artifactPath}`, 'debug');
          } else {
            context.log(`Failed to open artifact: ${artifactPath}`, 'error');
          }

          return { success: opened };
        }

        case 'change-workflow': {
          const workflowId = args[0] as string;

          if (!workflowId) {
            return { success: false, error: 'Workflow ID is required' };
          }

          if (!taskContext) {
            return { success: false, error: 'Task context is required' };
          }

          try {
            const currentMetadata = taskContext.data.metadata || {};
            await taskContext.updateTask({
              metadata: {
                ...currentMetadata,
                bmadWorkflowId: workflowId,
              },
            });

            context.log(`Changed workflow to: ${workflowId}`, 'debug');

            // Trigger UI refresh to update the display
            context.triggerUIDataRefresh(TASK_ACTIONS_ID);

            return { success: true };
          } catch (error) {
            context.log(`Failed to change workflow: ${error}`, 'error');
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        }

        default:
          return { success: false, error: `Unknown action: ${action}` };
      }
    } catch (error) {
      context.log(`Failed to execute action '${action}': ${error}`, 'error');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
