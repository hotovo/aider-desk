/**
 * BMAD Extension (v2)
 *
 * Lean backend for AiderDesk that regulates everything around a standard
 * `npx bmad-method install` installation:
 *
 * - Discovers the installed method's own menu (_bmad/_config/* +
 *   _bmad/<module>/module-help.csv) — no workflow registry of its own.
 * - Starts ORIGINAL workflows by injecting their SKILL.md (one generic
 *   template) so the installed method drives execution.
 * - Shows project progress, sprint board and next steps in the AiderDesk UI.
 * - Manages install/update of the bmad-method package.
 * - Auto-approves safe reads/writes inside _bmad-output/.
 *
 * Slash-style skill invocation (/bmad-help etc.) is handled natively by
 * AiderDesk's project-skill support — the extension does not intercept chat.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { v4 as uuidv4 } from 'uuid';

import { BmadManager, getBmadPackage } from './lib/bmad-manager';
import { generateSuggestions } from './lib/bmad-suggestions';
import { computeProgressSummary } from './lib/progress';
import { buildProjectOverview, computePhaseStepper } from './lib/ui-overview';
import { listInstalledSkills, resolveSkillsDir } from './lib/skills';
import { balanceFences, getPreprocessedSkillContent } from './lib/skill-preprocessor';
import { hasContextMessages } from './lib/context-preparer';
import { orderedPhases } from './lib/install-registry';
import { phaseDisplayName } from './lib/progress';
import {
  containsBarePythonInvocation,
  isAutoApprovedBashCommand,
  isAutoApprovedReadPath,
  isAutoApprovedWritePath,
  skillReadDirs,
} from './lib/tool-approval';
import { BmadAction, UpdateInfo } from './lib/types';

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
const MODE_SWITCHER_ID = 'bmad-mode-switcher';

// Single source for the extension version - package.json remains the
// canonical version record and is read once at module load. Shown in the UI
// header and used by the metadata below.
const EXTENSION_VERSION = (() => {
  try {
    return (
      (JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8')) as { version?: string })
        .version ?? 'unknown'
    );
  } catch {
    return 'unknown';
  }
})();

/** Cap a Map to its most recent `max` entries (memory hygiene). */
const boundedSet = <K, V>(map: Map<K, V>, key: K, value: V, max = 50): void => {
  map.set(key, value);
  if (map.size > max) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) {
      map.delete(oldest);
    }
  }
};

// Track previous mode per task to detect mode changes
const previousModes = new Map<string, string>();

// Track previous task state per task (UI refresh trigger)
const previousTaskStates = new Map<string, string>();

// Manager instances per project
const managers = new Map<string, BmadManager>();

// UI component sources are static per extension build - read them once and
// reuse the strings across getUIComponents calls (hot reload re-instantiates
// the module anyway).
let uiSources: { welcomePage: string; taskActions: string; modeSwitcher: string } | undefined;

/**
 * Build the continuation context message injected on agent start. The
 * workflow and skill paths of onAgentStarted share this builder - only
 * label, ids and paths differ.
 */
const buildContinuationMessage = (vars: {
  kind: 'Workflow' | 'Skill';
  name: string;
  /** Id shown in the text (may carry a menu-code suffix) */
  displayId: string;
  /** Prompt-context id used for continuation detection */
  contextId: string;
  groupId: string;
  skillPath: string;
  skillsDir?: string;
  projectDir: string;
}): ContextMessage => {
  const parts = [
    `[BMAD continuation] ${vars.kind}: ${vars.name} (${vars.displayId}).`,
    `Skill file: \`${vars.skillPath}\`.`,
    `Continue execution from where you left off.`,
  ];

  const skillLeaf = vars.skillPath.replace(/\\/g, '/').split('/').slice(-2)[0];
  const preprocessed = vars.skillsDir
    ? getPreprocessedSkillContent(vars.projectDir, vars.skillsDir, skillLeaf)
    : null;

  if (preprocessed) {
    parts.push(
      `\nPreprocessed skill content for reference:\n\`\`\`markdown\n${balanceFences(preprocessed.slice(0, 8000))}\n\`\`\``,
    );
  } else {
    parts.push(
      `If you need to re-read the SKILL.md, load \`${vars.skillPath}\` fully and continue following it.`,
    );
  }

  parts.push(
    `IMPORTANT: When running Python scripts, \`uv run\` is the ONLY correct command. NEVER execute raw \`python3\`.`,
    `PITFALL (Windows consoles): Python scripts printing emoji or other non-ASCII text crash with UnicodeEncodeError under the legacy console codepage. On Windows ALWAYS prefix such runs: $env:PYTHONIOENCODING='utf-8'; uv run _bmad/scripts/<script>.py`,
  );

  return {
    id: uuidv4(),
    role: 'user',
    content: parts.join('\n'),
    promptContext: {
      id: vars.contextId,
      group: {
        id: vars.groupId,
      },
    },
  };
};

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
    // First access this session: make sure pre-existing installations also
    // carry the state-detection hints in their bmad-help skill.
    manager.ensureHelpSkillStateHints();
  }
  return manager;
};

export default class BmadExtension implements Extension {
  static metadata = {
    name: 'BMAD Method',
    version: EXTENSION_VERSION,
    description: 'Lean backend for a standard bmad-method installation: discovers its menu, starts original workflows, tracks progress',
    author: '777marvin',
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/bmad/icon.png',
    capabilities: ['modes', 'ui'],
  };

  async onLoad(context: ExtensionContext) {
    // Belt and suspenders for the Windows console encoding pitfall (hint is
    // also injected into starts/continuations): processes spawned later by
    // AiderDesk's bash tool inherit this environment, so `uv run` Python
    // scripts emit utf-8 regardless of the legacy console codepage. Only set
    // when absent - an explicit user environment wins.
    process.env.PYTHONIOENCODING ??= 'utf-8';
    context.log('BMAD Extension loaded', 'info');
  }

  /**
   * Called when the extension is disabled, uninstalled or hot-reloaded
   * (AiderDesk 0.80+ invokes this reliably on toggle). Drops all cached
   * per-project managers and mode/state trackers so a fresh load starts clean.
   */
  async onUnload() {
    managers.clear();
    previousModes.clear();
    previousTaskStates.clear();
  }

  getModes(_context: ExtensionContext): ModeDefinition[] {
    return [
      {
        name: 'bmad',
        label: 'BMAD',
        description:
          "Guided workflows of the installed BMAD method",
        icon: 'FiLayers',
      },
    ];
  }

  getUIComponents(context: ExtensionContext): UIComponentDefinition[] {
    const projectDir = context.getProjectDir();
    if (!projectDir) {
      return [];
    }

    // Read JSX templates from files (cached at module level)
    uiSources ??= {
      welcomePage: readFileSync(join(__dirname, './ui/WelcomePage.jsx'), 'utf-8'),
      taskActions: readFileSync(join(__dirname, './ui/TaskActions.jsx'), 'utf-8'),
      modeSwitcher: readFileSync(join(__dirname, './ui/ModeSwitcher.jsx'), 'utf-8'),
    };

    const welcomePageComponent: UIComponentDefinition = {
      id: WELCOME_PAGE_ID,
      placement: 'welcome-page',
      jsx: uiSources.welcomePage,
      loadData: true,
      noDataCache: true,
    };

    // Gate on the project's BMAD installation (any module combination).
    // Non-BMAD projects keep the default AiderDesk welcome screen intact: in
    // BMAD mode the welcome page offers the installation, in all other modes
    // a compact top-bar button ('task-top-bar-right' is an append-only slot
    // and never replaces UI) switches the task to BMAD mode. Without a task
    // context the mode is unknown, so no components are returned.
    const installed = getManager(projectDir, context).checkInstallation();
    if (!installed) {
      const taskContext = context.getTaskContext();
      if (!taskContext) {
        return [];
      }
      if (taskContext.data?.currentMode === 'bmad') {
        return [welcomePageComponent];
      }
      return [
        {
          id: MODE_SWITCHER_ID,
          placement: 'task-top-bar-right',
          jsx: uiSources.modeSwitcher,
          loadData: false,
          noDataCache: true,
        },
      ];
    }

    return [
      welcomePageComponent,
      {
        id: TASK_ACTIONS_ID,
        placement: 'task-state-actions-all',
        jsx: uiSources.taskActions,
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
      boundedSet(previousModes, taskId, currentMode || '');

      // Trigger UI components reload when mode changes
      if (currentMode === 'bmad' || previousMode === 'bmad' || previousMode === undefined) {
        context.triggerUIComponentsReload();
      }
    }

    // Live status — when the task state changes, drop the cached BMAD status
    // (artifacts may have been written since the last scan) and refresh both
    // UI surfaces so progress updates without a manual reload.
    const state = event.task.state;
    const previousState = previousTaskStates.get(taskId);
    if (state !== previousState) {
      boundedSet(previousTaskStates, taskId, state || '');
      const projectDir = context.getProjectDir();
      const projectManager = projectDir ? managers.get(projectDir) : undefined;
      projectManager?.invalidateCache();
      context.triggerUIDataRefresh(TASK_ACTIONS_ID);
      context.triggerUIDataRefresh(WELCOME_PAGE_ID);
    }

    return undefined;
  }

  async onAgentStarted(event: AgentStartedEvent, context: ExtensionContext): Promise<void | Partial<AgentStartedEvent>> {
    if (event.mode !== 'bmad') {
      return undefined;
    }

    context.log('BMAD mode active - continuation context', 'debug');

    const projectDir = context.getProjectDir();
    const taskContext = context.getTaskContext();

    if (!taskContext || !projectDir) {
      return undefined;
    }

    // Get current workflow/skill from task metadata ('' means cleared)
    const workflowId = (taskContext.data.metadata?.bmadWorkflowId as string | undefined) || undefined;
    const skillId = (taskContext.data.metadata?.bmadSkillId as string | undefined) || undefined;

    const manager = getManager(projectDir, context);

    if (workflowId) {
      // Clean break: ids come from the CURRENT installation's catalog.
      // Stale ids from older extension versions are logged and skipped.
      const entry = manager.getCatalogEntry(workflowId);
      if (!entry) {
        context.log(`Workflow '${workflowId}' not found in the installed method's catalog`, 'warn');
        return undefined;
      }

      // Full template injection only when the conversation does not already carry
      // this workflow's context — re-injecting on every agent start duplicates
      // message ids and breaks redo/regenerate UI references (hasContextMessages).
      const status = await manager.getBmadStatus();

      if (
        !hasContextMessages(event.contextMessages, [entry.skillId])
      ) {
        context.log(`Continuation for workflow: ${entry.name} (${workflowId})`, 'debug');

        const continuationMessage = buildContinuationMessage({
          kind: 'Workflow',
          name: entry.name,
          displayId: entry.id,
          contextId: entry.skillId,
          groupId: entry.skillId,
          skillPath: entry.skillPath,
          skillsDir: status.skillsDir,
          projectDir,
        });

        return {
          contextMessages: [continuationMessage, ...event.contextMessages],
        };
      }

      return undefined;
    }

    if (skillId) {
      const skill = listInstalledSkills(projectDir).find((s) => s.id === skillId);
      if (!skill) {
        context.log(`Skill '${skillId}' from task metadata is not installed - skipping context injection`, 'warn');
        return undefined;
      }

      // Full template injection only when not already present.
      if (!hasContextMessages(event.contextMessages, ['workflow-start', skillId])) {
        context.log(`Continuation for skill: ${skill.name} (${skillId})`, 'debug');

        const segments = skill.skillPath.replace(/\\/g, '/').split('/');
        const skillsDir = segments.slice(0, -2).join('/');

        const continuationMessage = buildContinuationMessage({
          kind: 'Skill',
          name: skill.name,
          displayId: skillId,
          contextId: skillId,
          groupId: 'workflow-start',
          skillPath: skill.skillPath,
          skillsDir,
          projectDir,
        });

        return {
          contextMessages: [continuationMessage, ...event.contextMessages],
        };
      }

      return undefined;
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
        const suggestedWorkflows = generateSuggestions(status, taskContext?.data?.metadata);

        // Compute progress summary for the welcome page dashboard
        const progressSummary = computeProgressSummary(status);

        // Phase stepper + overview. Passing the task's workflow id lets the
        // dashboard prefer the actually-selected workflow for its active
        // badge instead of the first artifact marked in-progress.
        const phaseSteps = computePhaseStepper(status, progressSummary);
        const currentWorkflowId = taskContext?.data?.metadata?.bmadWorkflowId as string | undefined;
        const overview = buildProjectOverview(status, suggestedWorkflows, progressSummary, currentWorkflowId);

        // All skills installed by the installer, including add-on modules
        let installedSkills: ReturnType<typeof listInstalledSkills> = [];
        try {
          installedSkills = listInstalledSkills(projectDir);
        } catch (error) {
          context.log(`Failed to list installed skills: ${error}`, 'error');
        }

        // Check for updates only if BMAD is installed
        let updateInfo: UpdateInfo | undefined;
        if (status.installed) {
          try {
            updateInfo = await manager.checkForBmadUpdate();
          } catch (error) {
            context.log(`Update check failed: ${error}`, 'warn');
          }
        }

        // Ordered phase labels for the UI groups (original method phases)
        const phases = orderedPhases(status.catalog).map((phase) => ({
          phase,
          phaseName: phaseDisplayName(phase),
        }));

        return {
          status,
          suggestedWorkflows,
          progressSummary,
          phaseSteps,
          overview,
          installedSkills,
          installPackage: getBmadPackage(),
          expectedVersion: manager.getExpectedVersion(),
          uvAvailable: await manager.checkUvAvailable(),
          updateInfo: updateInfo ?? null,
          extensionVersion: EXTENSION_VERSION,
          phases,
          isLoading: false,
          error: null,
        };
      }

      if (componentId === TASK_ACTIONS_ID) {
        // Get current workflow from task metadata
        const currentWorkflowId = taskContext?.data?.metadata?.bmadWorkflowId as string | undefined;
        const currentWorkflow = currentWorkflowId ? (status.catalog.find((w) => w.id === currentWorkflowId) ?? null) : null;

        // Generate suggestions
        const suggestedWorkflows = generateSuggestions(status, taskContext?.data?.metadata);

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

            bmadActions = extractBmadActions(lastAssistantMessage) || [];
          } catch (error) {
            context.log(`Failed to extract BMAD actions: ${error}`, 'error');
          }
        }

        // Compute progress summary for the task actions mini-bar
        const progressSummary = computeProgressSummary(status);

        const phaseSteps = computePhaseStepper(status, progressSummary);
        const overview = buildProjectOverview(
          status,
          suggestedWorkflows,
          progressSummary,
          currentWorkflowId,
        );

        // Check for updates only if BMAD is installed
        let updateInfo: UpdateInfo | undefined;
        if (status.installed) {
          try {
            updateInfo = manager.getCachedUpdateInfo();
          } catch (error) {
            context.log(`Getting cached update info failed: ${error}`, 'warn');
          }
        }

        const phases = orderedPhases(status.catalog).map((phase) => ({
          phase,
          phaseName: phaseDisplayName(phase),
        }));

        return {
          status,
          progressSummary,
          phaseSteps,
          overview,
          currentWorkflow,
          suggestedWorkflows,
          bmadActions,
          updateInfo: updateInfo ?? null,
          phases,
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
    // Auto-approval policy lives in lib/tool-approval.ts (pure + tested):
    // segment-based path matching and a single-plain-command shell gate.
    const projectDir = context.getProjectDir();

    // Auto-approve read-only access to BMAD content: skills, module configs and outputs.
    // Skills instruct the agent to read many step/reference files - approving each one manually adds no safety.
    if (event.toolName === "power---file_read") {
      const filePath = (event.input as { filePath?: string })?.filePath;
      if (typeof filePath === "string") {
        const skillDirs = skillReadDirs(projectDir ? resolveSkillsDir(projectDir) : undefined);
        if (isAutoApprovedReadPath(filePath, skillDirs)) {
          context.log(`Auto-approving ${event.toolName} for ${filePath}`, "debug");
          return { allowed: true };
        }
      }
      return undefined;
    }

    // Auto-approve file operations in generated output areas only
    if (
      event.toolName === "power---file_edit" ||
      event.toolName === "power---file_write"
    ) {
      const filePath = (event.input as { filePath?: string })?.filePath;
      if (typeof filePath !== "string") {
        return undefined;
      }

      if (isAutoApprovedWritePath(filePath)) {
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

      // Hardened approvals: exactly ONE anchored, side-effect-free command -
      // no chaining, pipes, redirection, newlines, backticks or substitution.
      if (isAutoApprovedBashCommand(command)) {
        context.log(`Auto-approving ${event.toolName} for ${command}`, "debug");
        return { allowed: true };
      }

      // Enforce uv run for ALL bare Python invocations.
      if (containsBarePythonInvocation(command)) {
        context.log(
          `Blocked bare python command: ${command} - use 'uv run' instead`,
          "warn",
        );
        return { allowed: false };
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

        case 'switch-to-bmad': {
          // Mode switcher on non-BMAD projects: jump into BMAD mode so the
          // welcome page (install prompt) shows. The mode change persists via
          // updateTask and the following onTaskUpdated reload swaps the
          // switcher for the welcome page.
          if (!taskContext) {
            return { success: false, error: 'Task context is required' };
          }

          await taskContext.updateTask({ currentMode: 'bmad' });
          context.log('Switched task mode to BMAD', 'info');
          context.triggerUIComponentsReload();
          return { success: true };
        }

        case 'reset-workflow': {
          const result = await manager.resetWorkflow();
          // Trigger UI refresh after reset
          context.triggerUIDataRefresh(WELCOME_PAGE_ID);
          context.triggerUIDataRefresh(TASK_ACTIONS_ID);
          return result;
        }

        case 'refresh-data': {
          context.triggerUIDataRefresh(componentId);
          return { success: true };
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

        case 'execute-skill': {
          const skillId = args[0] as string;
          const _taskId = args[1] as string;
          const provider = args[2] as string | undefined;
          const model = args[3] as string | undefined;
          const asSubtask = args[4] as boolean | undefined;

          if (!skillId) {
            return { success: false, error: 'Skill ID is required' };
          }

          if (!taskContext) {
            return { success: false, error: 'Task context is required' };
          }

          const result = await manager.executeSkill(skillId, taskContext, provider, model, asSubtask);

          if (result.success) {
            context.log(`Skill '${skillId}' started`, 'debug');
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

        case 'open-skill-file': {
          const skillId = args[0] as string;

          if (!skillId) {
            return { success: false, error: 'Skill ID is required' };
          }

          const skill = listInstalledSkills(projectDir).find((s) => s.id === skillId);
          if (!skill) {
            return { success: false, error: `Skill '${skillId}' not found` };
          }

          const opened = await context.openPath(join(projectDir, skill.skillPath));
          context.log(
            opened ? `Opened skill file: ${skill.skillPath}` : `Failed to open skill file: ${skill.skillPath}`,
            opened ? 'debug' : 'error',
          );
          return { success: opened };
        }

        case 'check-update': {
          try {
            const updateInfo = await manager.checkForBmadUpdate();
            context.triggerUIDataRefresh(WELCOME_PAGE_ID);
            context.triggerUIDataRefresh(TASK_ACTIONS_ID);
            return { success: true, updateInfo };
          } catch (error) {
            context.log(`Failed to check for update: ${error}`, 'error');
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        }

        case 'perform-update': {
          try {
            const result = await manager.performUpdate();
            context.triggerUIDataRefresh(WELCOME_PAGE_ID);
            context.triggerUIDataRefresh(TASK_ACTIONS_ID);
            return result;
          } catch (error) {
            context.log(`Failed to perform update: ${error}`, 'error');
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
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
            // Only allow switching to entries of the installed method.
            if (!manager.getCatalogEntry(workflowId)) {
              return { success: false, error: `Workflow '${workflowId}' is not part of the installed method` };
            }

            const currentMetadata = taskContext.data.metadata || {};
            await taskContext.updateTask({
              metadata: {
                ...currentMetadata,
                bmadWorkflowId: workflowId,
                bmadSkillId: '', // clear stale skill continuation
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
    } catch (error: unknown) {
      const message = error instanceof Error
        ? error.message
        : (typeof error === 'object' && error !== null && 'message' in error)
          ? String((error as { message: unknown }).message)
          : String(error);
      context.log(`Failed to execute action '${action}': ${message}`, 'error');
      return {
        success: false,
        error: message,
      };
    }
  }
}
