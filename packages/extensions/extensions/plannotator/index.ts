/**
  * Plannotator Extension - Plan-based development workflow with visual review
 *
 * Features:
 * - Planning mode with tool restrictions (read-only + PLAN.md writes)
 * - Context injection for planning workflow
 * - Execution tracking via checklist items
 * - Browser-based plan review UI (coming soon)
 *
 * The extension tracks mode and phase per task, responding to mode changes
 * regardless of how they were triggered (command or UI).
 *
 * Commands:
 * - /plannotator - Toggle plannotator mode
 *
 * Tools:
 * - exit_plan_mode - Exit planning phase and start execution
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import { startPlanReviewServer, openBrowser } from './review-server.js';
import { parseChecklist, markCompletedSteps, type ChecklistItem } from './utils.js';

import type {
  Extension,
  ExtensionContext,
  ModeDefinition,
  ToolDefinition,
  CommandDefinition,
  ToolCalledEvent,
  ToolApprovalEvent,
  AgentStartedEvent,
  AgentFinishedEvent,
  TaskInitializedEvent,
  TaskClosedEvent,
  ImportantRemindersEvent,
  AgentProfile,
} from "@aiderdesk/extensions";

// Load review HTML at module initialization
const __dirname = dirname(fileURLToPath(import.meta.url));
let indexHtmlContent = '';
try {
  indexHtmlContent = readFileSync(resolve(__dirname, 'index.html'), 'utf-8');
} catch {
  // HTML not found - review feature will be unavailable
}

// Phase schema
type Phase = 'idle' | 'planning' | 'executing';

interface TaskState {
  phase: Phase;
  planFile: string;
  checklistItems: ChecklistItem[];
}

// Planning instructions
const PLANNING_INSTRUCTIONS = `[PLANNOTATOR - PLANNING PHASE]
You are in plan mode. You MUST NOT make any changes to the codebase — no edits, no commits, no installs, no destructive commands. The ONLY file you may write to or edit is the plan file: PLAN.md.

Available tools: file_read, glob, grep, bash (read-only), semantic_search, file_write (PLAN.md only), file_edit (PLAN.md only), exit_plan_mode

Do not run destructive bash commands (rm, git push, npm install, etc.) — focus on reading and exploring the codebase. Web fetching (curl, wget) is fine.

## Iterative Planning Workflow

You are pair-planning with the user. Explore the code to build context, then write your findings into PLAN.md as you go. The plan starts as a rough skeleton and gradually becomes the final plan.

### The Loop

Repeat this cycle until the plan is complete:

1. **Explore** — Use file_read, glob, grep, and bash to understand the codebase. Actively search for existing functions, utilities, and patterns that can be reused — avoid proposing new code when suitable implementations already exist.
2. **Update the plan file** — After each discovery, immediately capture what you learned in PLAN.md. Don't wait until the end. Use file_write for the initial draft, then file_edit for all subsequent updates.
3. **Ask the user** — When you hit an ambiguity or decision you can't resolve from code alone, ask. Then go back to step 1.

### First Turn

Start by quickly scanning key files to form an initial understanding of the task scope. Then write a skeleton plan (headers and rough notes) and ask the user your first round of questions. Don't explore exhaustively before engaging the user.

### Asking Good Questions

- Never ask what you could find out by reading the code.
- Batch related questions together.
- Focus on things only the user can answer: requirements, preferences, tradeoffs, edge-case priorities.
- Scale depth to the task — a vague feature request needs many rounds; a focused bug fix may need one or none.

### Plan File Structure

Your plan file should use markdown with clear sections:
- **Context** — Why this change is being made: the problem, what prompted it, the intended outcome.
- **Approach** — Your recommended approach only, not all alternatives considered.
- **Files to modify** — List the critical file paths that will be changed.
- **Reuse** — Reference existing functions and utilities you found, with their file paths.
- **Steps** — Implementation checklist:
  - [ ] 1. Step 1 description
  - [ ] 2. Step 2 description
- **Verification** — How to test the changes end-to-end (run the code, run tests, manual checks).

Keep the plan concise enough to scan quickly, but detailed enough to execute effectively.

### When to Submit

Your plan is ready when you've addressed all ambiguities and it covers: what to change, which files to modify, what existing code to reuse, and how to verify. Call exit_plan_mode to submit for review.

### Revising After Feedback

When the user denies a plan with feedback:
1. Read PLAN.md to see the current plan.
2. Use the file_edit tool to make targeted changes addressing the feedback — do NOT rewrite the entire file.
3. Call exit_plan_mode again to resubmit.

### Ending Your Turn

Your turn should only end by either:
- Asking the user a question to gather more information.
- Calling exit_plan_mode when the plan is ready for review.`;

const EXECUTING_INSTRUCTIONS = `[PLANNOTATOR - EXECUTING PLAN]
Full tool access is enabled. Execute the plan from PLAN.md.

After completing each step, include [DONE:n] in your response where n is the step number.`;

export default class PlannotatorExtension implements Extension {
  static metadata = {
    name: 'Plannotator Extension',
    version: '1.1.0',
    description: 'Plan-based development workflow with planning mode and plan review utilizing plannotator.ai',
    author: 'wladimiiir',
    capabilities: ['modes', 'tools', 'commands', 'workflow'],
  };

  // Track state per task
  private taskStates: Map<string, TaskState> = new Map();

  async onLoad(context: ExtensionContext) {
    context.log('Plannotator Extension loaded', 'info');
  }

  async onUnload() {
    this.taskStates.clear();
  }

  // ── Modes ────────────────────────────────────────────────────────────

  getModes(): ModeDefinition[] {
    return [
      {
        name: 'plannotator',
        label: 'Plannotator',
        description: 'Planning and execution workflow with tool restrictions',
        icon: 'GoProjectRoadmap',
      },
    ];
  }

  // ── Commands ──────────────────────────────────────────────────────────

  getCommands(): CommandDefinition[] {
    return [
      {
        name: 'plannotator',
        description: 'Toggle plannotator mode',
        arguments: [
          {
            description: 'Plan file path (default: PLAN.md)',
            required: false,
          },
        ],
        execute: async (args: string[], context: ExtensionContext) => {
          const taskContext = context.getTaskContext();
          if (!taskContext) {
            context.log('No task context available', 'error');
            return;
          }

          const currentMode = taskContext.data.currentMode;
          const planFile = args[0] || 'PLAN.md';

          if (currentMode === 'plannotator') {
            // Exit plannotator mode
            await taskContext.updateTask({ currentMode: 'agent' });
            taskContext.addLogMessage('info', 'Exited plannotator mode. Switched to agent mode.');
          } else {
            // Enter plannotator mode
            await taskContext.updateTask({ currentMode: 'plannotator' });

            // Initialize task state with planning phase
            const taskState = this.getTaskState(taskContext.data.id);
            taskState.phase = 'planning';
            taskState.planFile = planFile;

            taskContext.addLogMessage('info', `Entered plannotator mode. Create your plan in ${planFile}`);
          }
        },
      },
    ];
  }

  // ── Tools ─────────────────────────────────────────────────────────────

  getTools(context: ExtensionContext, mode: string, agentProfile: AgentProfile): ToolDefinition[] {
    if (agentProfile.isSubagent) {
      return [];
    }
    return [
      {
        name: 'exit_plan_mode',
        description: 'Exit planning phase and proceed to execution. Call this after your plan in PLAN.md is ready for implementation.',
        inputSchema: z.object({
          summary: z.string().optional().describe('Brief summary of the plan'),
        }),
        execute: async (input, signal, context: ExtensionContext) => {
          const taskContext = context.getTaskContext();
          if (!taskContext) {
            return "Error: No task context available.";
          }

          const taskState = this.getTaskState(taskContext.data.id);

          if (taskState.phase !== 'planning') {
            return 'Error: Not in planning phase. Use /plannotator to enter plannotator mode first.';
          }

          const planPath = join(taskContext.getTaskDir(), taskState.planFile);
          if (!existsSync(planPath)) {
            return `Error: ${taskState.planFile} does not exist. Write your plan first, then call exit_plan_mode again.`;
          }

          const planContent = readFileSync(planPath, 'utf-8');
          if (planContent.trim().length === 0) {
            return `Error: ${taskState.planFile} is empty. Write your plan first, then call exit_plan_mode again.`;
          }

          // Parse checklist items
          taskState.checklistItems = parseChecklist(planContent);
          context.log(`Parsed ${taskState.checklistItems.length} checklist items`, 'info');

          // Check if review HTML is available
          if (!indexHtmlContent) {
            const errorMsg = 'Error: Review UI not available. review.html file is missing.';
            context.log(errorMsg, 'error');
            taskContext.addLogMessage('error', errorMsg);
            return {
              content: [{ type: 'text', text: errorMsg }],
              isError: true,
            };
          }

          // Start review server
          context.log('Starting plan review server...', 'info');
          const server = startPlanReviewServer({
            plan: planContent,
            htmlContent: indexHtmlContent,
            origin: 'aiderdesk',
          });

          // Open browser
          context.log(`Opening modal-overlay with ${server.url}`, 'info');
          void context.openUrl(server.url, 'modal-overlay');

          // Wait for user decision or abort signal
          const result = await new Promise<{ approved: boolean; feedback?: string } | 'aborted'>((resolve) => {
            const abortHandler = () => {
              server.stop();
              resolve('aborted');
            };

            signal?.addEventListener('abort', abortHandler);

            server.waitForDecision().then((decision) => {
              signal?.removeEventListener('abort', abortHandler);
              resolve(decision);
            });
          });

          // Small delay before closing server
          await new Promise((resolve) => setTimeout(resolve, 1500));
          server.stop();

          // Handle abort
          if (result === 'aborted') {
            taskContext.addLogMessage('info', 'Plan review was interrupted by user');
            return 'Interrupted by user';
          }

          if (result.approved) {
            // Switch to executing phase
            taskState.phase = 'executing';
            context.log(`Task ${taskContext.data.id} transitioned to executing phase`, 'info');

            const doneMsg =
              taskState.checklistItems.length > 0 ? 'After completing each step, include [DONE:n] in your response where n is the step number.' : '';

            const feedbackMsg = result.feedback
              ? `\n\n## Implementation Notes\n\nThe user approved your plan but added the following notes to consider during implementation:\n\n${result.feedback}\n\nProceed with implementation, incorporating these notes where applicable.`
              : '';

            return `Plan approved! You now have full tool access (read, bash, edit, write). Execute the plan in ${taskState.planFile}. ${doneMsg}${feedbackMsg}`;
          } else {
            // Plan rejected - agent must revise
            const feedbackText = result.feedback || 'Plan rejected. Please revise.';
            context.log('Plan rejected by user', 'info');

            return `Plan not approved.\n\nUser feedback: ${feedbackText}\n\nRevise the plan:\n1. Read ${taskState.planFile} to see the current plan.\n2. Use the file_edit tool to make targeted changes addressing the feedback above — do not rewrite the entire file.\n3. Call exit_plan_mode again when ready.`;
          }
        },
      },
    ];
  }

  // ── Event Handlers ────────────────────────────────────────────────────

  async onTaskInitialized(event: TaskInitializedEvent, context: ExtensionContext): Promise<void> {
    context.log(`Task initialized: ${event.task.id}`, 'debug');
  }

  async onTaskClosed(event: TaskClosedEvent, context: ExtensionContext): Promise<void> {
    // Clean up task state
    this.taskStates.delete(event.task.id);
    context.log(`Task closed and state cleaned up: ${event.task.id}`, 'debug');
  }

  async onToolCalled(event: ToolCalledEvent, context: ExtensionContext): Promise<void | Partial<ToolCalledEvent>> {
    const taskContext = context.getTaskContext();
    if (!taskContext || taskContext.data.currentMode !== 'plannotator') {
      return undefined;
    }

    const taskState = this.getTaskState(taskContext.data.id);

    if (taskState.phase !== 'planning') {
      return undefined;
    }

    // Special handling for file_write and file_edit
    if (event.toolName === 'power---file_write' || event.toolName === 'power---file_edit') {
      const projectContext = context.getProjectContext();
      if (!projectContext) {
        return undefined;
      }

      const filePath = (event.input as { filePath?: string })?.filePath;
      if (typeof filePath !== 'string') {
        return undefined;
      }

      const allowedPath = join(projectContext.baseDir, taskState.planFile);
      const targetPath = join(projectContext.baseDir, filePath);

      if (targetPath !== allowedPath) {
        context.log(`Blocked write to ${filePath} (only ${taskState.planFile} allowed)`, 'warn');
        return {
          output: `Plannotator: writes are restricted to ${taskState.planFile} during planning. Blocked: ${filePath}`,
        };
      }

      if (event.toolName === 'power---file_write' && event.input.mode !== 'overwrite') {
        return {
          input: {
            ...event.input,
            mode: 'overwrite',
          },
        }
      }
    }

    // Restrict bash commands to read-only
    if (event.toolName === 'power---bash') {
      const command = (event.input as { command?: string })?.command;
      if (typeof command !== 'string') {
        return undefined;
      }

      const readOnlyPattern = /^(ls|cat|git|pwd|echo|which|grep|find|head|tail|less|wc|tree|curl|wget)/;
      if (!readOnlyPattern.test(command)) {
        context.log(`Blocked non-read-only bash command: ${command}`, 'warn');
        return {
          output: 'Only read-only bash commands are allowed in planning phase (ls, cat, git, grep, etc.).',
        };
      }
    }

    return undefined;
  }

  async onToolApproval(event: ToolApprovalEvent, context: ExtensionContext): Promise<void | Partial<ToolApprovalEvent>> {
    const taskContext = context.getTaskContext();
    if (!taskContext || taskContext.data.currentMode !== 'plannotator') {
      return undefined;
    }

    const taskState = this.getTaskState(taskContext.data.id);

    if (taskState.phase !== 'planning') {
      return undefined;
    }

    if (event.toolName !== 'power---file_write' && event.toolName !== 'power---file_edit') {
      return undefined;
    }

    const filePath = (event.input as { filePath?: string })?.filePath;
    if (typeof filePath !== 'string') {
      return undefined;
    }

    if (filePath === taskState.planFile) {
      context.log(`Auto-approving ${event.toolName} for ${filePath}`, 'debug');
      return { allowed: true };
    }

    return undefined;
  }

  async onAgentStarted(event: AgentStartedEvent, context: ExtensionContext): Promise<void | Partial<AgentStartedEvent>> {
    // Only inject context if in plannotator mode and not a subagent
    if (event.mode !== 'plannotator' || event.agentProfile.isSubagent) {
      return undefined;
    }

    const taskContext = context.getTaskContext();
    if (!taskContext) {
      return undefined;
    }

    const taskState = this.getTaskState(taskContext.data.id);

    // If entering plannotator mode for the first time, start in planning phase
    if (taskState.phase === 'idle') {
      taskState.phase = 'planning';
      context.log(`Task ${taskContext.data.id} entering plannotator mode - starting planning phase`, 'info');
    }

    context.log(`Plannotator mode active - phase: ${taskState.phase}`, 'info');

    let instructions: string;

    if (taskState.phase === 'planning') {
      instructions = PLANNING_INSTRUCTIONS;
    } else if (taskState.phase === 'executing') {
      // Re-read plan file and parse checklist
      const projectContext = context.getProjectContext();
      if (projectContext) {
        const planPath = join(projectContext.baseDir, taskState.planFile);
        if (existsSync(planPath)) {
          const planContent = readFileSync(planPath, 'utf-8');
          taskState.checklistItems = parseChecklist(planContent);
        }
      }

      const remaining = taskState.checklistItems.filter((t) => !t.completed);
      if (remaining.length > 0) {
        const todoList = remaining.map((t) => `- [ ] ${t.text}`).join('\n');
        instructions = `${EXECUTING_INSTRUCTIONS}\n\nRemaining steps:\n${todoList}`;
      } else {
        instructions = EXECUTING_INSTRUCTIONS;
      }
    } else {
      return undefined;
    }

    const instructionMessage = {
      id: 'plannotator-instructions',
      role: 'user' as const,
      content: instructions,
    };

    return { contextMessages: [instructionMessage, ...event.contextMessages] };
  }

  async onAgentFinished(event: AgentFinishedEvent, context: ExtensionContext): Promise<void | Partial<AgentFinishedEvent>> {
    const taskContext = context.getTaskContext();
    if (!taskContext || taskContext.data.currentMode !== 'plannotator') {
      return undefined;
    }

    const taskState = this.getTaskState(taskContext.data.id);

    if (taskState.phase !== 'executing' || taskState.checklistItems.length === 0) {
      return undefined;
    }

    // Track [DONE:n] markers in result messages
    let hasChanges = false;
    for (const message of event.resultMessages) {
      if (message.role === 'assistant' && typeof message.content === 'string') {
        const completedCount = markCompletedSteps(message.content, taskState.checklistItems);
        if (completedCount > 0) {
          hasChanges = true;
        }
      }
    }

    if (hasChanges) {
      // Check if all items are completed
      if (taskState.checklistItems.every((t) => t.completed)) {
        taskContext.addLogMessage('info', 'Plan execution completed!');
      }
    }

    return undefined;
  }

  async onImportantReminders(event: ImportantRemindersEvent, context: ExtensionContext): Promise<void | Partial<ImportantRemindersEvent>> {
    const taskContext = context.getTaskContext();
    if (!taskContext || taskContext.data.currentMode !== 'plannotator') {
      return undefined;
    }

    const taskState = this.getTaskState(taskContext.data.id);

    if (taskState.phase !== 'planning') {
      return undefined;
    }

    // Add reminder about exit_plan_mode
    const reminder = `\n## Plannotator Mode Active

You are in planning phase. Your available tools are restricted to read-only operations and writing to ${taskState.planFile}.

**When your plan is ready**: Call the \`exit_plan_mode\` tool to exit planning phase and begin implementation. Your plan should be complete with all sections filled out (Context, Approach, Files to modify, Steps, Verification).`;

    return {
      remindersContent: event.remindersContent + reminder,
    };
  }

  // ── Task State Management ─────────────────────────────────────────────

  private getTaskState(taskId: string): TaskState {
    if (!this.taskStates.has(taskId)) {
      this.taskStates.set(taskId, {
        phase: 'idle',
        planFile: 'PLAN.md',
        checklistItems: [],
      });
    }
    return this.taskStates.get(taskId)!;
  }
}
