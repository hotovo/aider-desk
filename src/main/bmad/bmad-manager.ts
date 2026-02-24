import * as path from 'path';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

import { v4 as uuidv4 } from 'uuid';
import { BMAD_WORKFLOWS } from '@common/bmad-workflows';
import { StoryStatus } from '@common/types';
import { glob } from 'glob';
import * as yaml from 'yaml';
import * as yamlFront from 'yaml-front-matter';

import { ContextPreparer } from './context-preparer';

import type {
  BmadError,
  BmadStatus,
  InstallResult,
  WorkflowExecutionResult,
  IncompleteWorkflowMetadata,
  SprintStatusData,
  WorkflowArtifacts,
  ContextFile,
} from '@common/types';
import type { Task } from '@/task';

import logger from '@/logger';

export class BmadManager {
  constructor(private readonly projectDir: string) {}

  checkInstallation(): boolean {
    try {
      const bmadPath = path.join(this.projectDir, '_bmad', 'bmm');
      return fs.existsSync(bmadPath);
    } catch (error) {
      logger.error('BMAD installation check failed', { error });
      return false;
    }
  }

  getVersion(): string | undefined {
    try {
      const configPath = path.join(this.projectDir, '_bmad', 'bmm', 'config.yaml');
      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf-8');
        const lines = configContent.split('\n');

        for (const line of lines) {
          if (line.startsWith('# Version:')) {
            return line.split(':')[1].trim();
          }
        }
      }
      return undefined;
    } catch (error) {
      logger.error('BMAD version detection failed', { error });
      return undefined;
    }
  }

  /**
   * Parses a step identifier to extract the step number.
   * Handles formats:
   * - Pure numbers: '1', '5', '12'
   * - Prefixed step IDs: 'step-01-document-discovery', 'step-5-analysis'
   * - Falls back to index + 1 for unrecognized formats
   *
   * @param stepId - The step identifier string
   * @param index - The index of the step in the array (used as fallback)
   * @returns The extracted step number
   */
  private parseStepNumber = (stepId: string, index: number): number => {
    // Try pure number first
    const pureNumber = parseInt(stepId, 10);
    if (!isNaN(pureNumber)) {
      return pureNumber;
    }

    // Try to extract number from patterns like 'step-01-...' or 'step-1-...'
    const stepPattern = /^step-(\d+)/i;
    const match = stepId.match(stepPattern);
    if (match) {
      return parseInt(match[1], 10);
    }

    // Fallback to index + 1
    return index + 1;
  };

  private VALID_STORY_STATUSES: StoryStatus[] = [StoryStatus.Backlog, StoryStatus.ReadyForDev, StoryStatus.InProgress, StoryStatus.Review, StoryStatus.Done];

  private isValidStoryStatus = (status: string): status is StoryStatus => {
    return this.VALID_STORY_STATUSES.includes(status as StoryStatus);
  };

  /**
   * Parses sprint-status.yaml and extracts story statuses (excluding epics and retrospectives)
   * Also determines which workflows are completed based on story statuses:
   * - 'dev-story' and 'code-review' are completed if all stories are 'done' (non-empty)
   * - 'create-story' is completed if there are no 'backlog' stories
   * @param projectRoot - Absolute path to the project root directory
   * @returns SprintStatusData with array of story statuses and completed workflows, or undefined if file doesn't exist
   */
  private async parseSprintStatus(projectRoot: string): Promise<SprintStatusData | undefined> {
    const sprintStatusPath = path.join(projectRoot, '_bmad-output/implementation-artifacts/sprint-status.yaml');

    try {
      const content = await fsPromises.readFile(sprintStatusPath, 'utf-8');
      const parsed = yaml.parse(content) as { development_status?: Record<string, string> };

      if (!parsed?.development_status) {
        return undefined;
      }

      const storyStatuses: StoryStatus[] = [];

      for (const [key, status] of Object.entries(parsed.development_status)) {
        if (key.startsWith('epic') || key.endsWith('-retrospective')) {
          continue;
        }

        if (this.isValidStoryStatus(status)) {
          storyStatuses.push(status as StoryStatus);
        }
      }

      const completedWorkflows: string[] = ['sprint-planning'];
      if (storyStatuses.length === 0) {
        return { storyStatuses, completedWorkflows };
      }

      if (!storyStatuses.includes(StoryStatus.Backlog)) {
        completedWorkflows.push('create-story');

        if (!storyStatuses.includes(StoryStatus.ReadyForDev)) {
          completedWorkflows.push('dev-story');

          if (!storyStatuses.includes(StoryStatus.Review)) {
            completedWorkflows.push('code-review');
          }
        }
      }

      logger.info('Parsed sprint-status.yaml', { storyStatuses, completedWorkflows });

      return { storyStatuses, completedWorkflows };
    } catch {
      return undefined;
    }
  }

  /**
   * Scans for completed workflow artifacts in the project
   * Uses a hybrid two-tier detection strategy:
   * - Tier 1: Fast file existence check using glob patterns
   * - Tier 2: Detailed state parsing via YAML frontmatter for resume capability
   * @param projectRoot - Absolute path to the project root directory
   * @returns Workflow artifacts with completed workflows and artifact details
   */
  private async scanWorkflows(projectRoot: string): Promise<WorkflowArtifacts> {
    // Check if _bmad-output directory exists
    const outputDir = path.join(projectRoot, '_bmad-output');

    try {
      await fsPromises.access(outputDir);
    } catch {
      // Directory doesn't exist or permission denied - return greenfield state
      return {
        completedWorkflows: [],
        inProgressWorkflows: [],
        detectedArtifacts: {},
      };
    }

    // Scan for artifacts using glob patterns from workflow registry
    const completedWorkflows: string[] = [];
    const inProgressWorkflows: string[] = [];
    const detectedArtifacts: WorkflowArtifacts['detectedArtifacts'] = {};
    const incompleteWorkflows: IncompleteWorkflowMetadata[] = [];
    // Track workflows with non-completing status for quick-dev (same artifact pattern as quick-spec)
    const workflowsWithNonCompletingStatus = new Set<string>();

    for (const workflow of BMAD_WORKFLOWS) {
      const { id, outputArtifact } = workflow;

      try {
        // Resolve glob pattern relative to project root
        const fullPattern = path.join(projectRoot, outputArtifact);

        // Use glob to find matching files
        const matches = await glob(fullPattern, {
          windowsPathsNoEscape: true,
        });

        if (matches.length > 0) {
          const artifactPath = matches[0];

          // Try to parse YAML frontmatter for stepsCompleted and status
          let stepsCompleted: string[] | undefined;
          let status: string | undefined;
          let frontmatterError: string | undefined;

          try {
            const content = await fsPromises.readFile(artifactPath, 'utf-8');
            const { __content, ...properties } = yamlFront.loadFront(content);

            logger.debug('Parsed frontmatter', { parsed: properties });

            if (properties.stepsCompleted) {
              stepsCompleted = properties.stepsCompleted;
            }

            if (properties.status) {
              status = properties.status;
            }
          } catch (parseError) {
            // File read or YAML parse error - track corruption
            frontmatterError = parseError instanceof Error ? parseError.message : 'Unknown error parsing frontmatter';
            // Artifact is still detected (file existence), just no detailed state
          }

          // Store artifact details
          detectedArtifacts[id] = {
            path: artifactPath,
            ...(stepsCompleted && { stepsCompleted }),
            ...(status && { status }),
            ...(frontmatterError && { error: frontmatterError }),
          };

          // Track quick-dev workflows with non-completing status
          if (id === 'quick-dev' && status) {
            const statusLower = status.toLowerCase();
            const hasCompletingStatus = statusLower.includes('complete') || statusLower.includes('done');
            if (!hasCompletingStatus) {
              workflowsWithNonCompletingStatus.add(id);
            }
          }

          // Determine completion status using workflow.totalSteps from registry
          const workflowTotalSteps = workflow.totalSteps;

          if (workflowTotalSteps > 0) {
            const stepsCompletedNumbers = stepsCompleted?.map((s, i) => this.parseStepNumber(s, i)) || [];
            const maxCompletedStep = stepsCompletedNumbers.length > 0 ? Math.max(...stepsCompletedNumbers) : 0;

            // Workflow is complete if:
            // 1. No stepsCompleted in frontmatter (legacy/simple artifact) - assume complete
            // 2. stepsCompleted exists and max step >= totalSteps from registry
            // 3. For quick-spec workflow: status is 'ready-for-dev'
            // 4. For quick-dev workflow: status (lowercase) contains 'complete' or 'done'
            const isQuickSpecReadyForDevStatus = id === 'quick-spec' && status === 'ready-for-dev';
            const statusLower = status?.toLowerCase() || '';
            const isQuickDevCompletedByStatus = id === 'quick-dev' && (statusLower.includes('complete') || statusLower.includes('done'));

            // quick-dev uses status field only for completion, ignores stepsCompleted
            const isLegacyComplete = !stepsCompleted && id !== 'quick-dev';
            const isStepsComplete = id === 'quick-dev' ? false : maxCompletedStep >= workflowTotalSteps;
            const isFullyCompleted = isLegacyComplete || isStepsComplete || isQuickSpecReadyForDevStatus || isQuickDevCompletedByStatus;

            logger.debug('Workflow completion status', {
              workflowId: id,
              stepsCompleted,
              maxCompletedStep,
              workflowTotalSteps,
              status,
              isLegacyComplete,
              isStepsComplete,
              isQuickSpecReadyForDevStatus,
              isQuickDevCompletedByStatus,
              isFullyCompleted,
            });

            if (isFullyCompleted) {
              completedWorkflows.push(id);
            } else {
              if (id === 'quick-dev' && detectedArtifacts['quick-spec']?.status === 'ready-for-dev') {
                // quick-dev is not in progress if quick-spec is ready-for-dev
                continue;
              }

              // Workflow is in progress
              inProgressWorkflows.push(id);

              // Also add to incompleteWorkflows for resume functionality
              try {
                const stats = await fsPromises.stat(artifactPath);
                const nextStep = stepsCompletedNumbers.length === 0 ? 1 : maxCompletedStep + 1;

                incompleteWorkflows.push({
                  workflowId: id,
                  artifactPath,
                  stepsCompleted: stepsCompletedNumbers,
                  nextStep,
                  lastModified: stats.mtime,
                  ...(frontmatterError && {
                    corrupted: true,
                    corruptionError: frontmatterError,
                  }),
                });
              } catch {
                // Failed to get file stats - still mark as in progress but skip incompleteWorkflows entry
              }
            }
          }
        }
      } catch {
        // Glob error - continue scanning other workflows
      }
    }

    const sprintStatus = await this.parseSprintStatus(projectRoot);

    if (sprintStatus) {
      for (const workflowId of sprintStatus.completedWorkflows) {
        if (!completedWorkflows.includes(workflowId)) {
          completedWorkflows.push(workflowId);
        }
      }
    }

    // Remove workflows with non-completing status from completedWorkflows
    // This ensures quick-dev with status like 'ready-for-dev' is not marked as completed
    for (const workflowId of workflowsWithNonCompletingStatus) {
      const index = completedWorkflows.indexOf(workflowId);
      if (index !== -1) {
        completedWorkflows.splice(index, 1);
      }
    }

    return {
      completedWorkflows,
      inProgressWorkflows,
      detectedArtifacts,
      incompleteWorkflows,
      sprintStatus,
    };
  }

  async getBmadStatus(): Promise<BmadStatus> {
    const installed = this.checkInstallation();
    const version = installed ? this.getVersion() : undefined;

    // Scan for workflow artifacts
    const workflowArtifacts = await this.scanWorkflows(this.projectDir);

    return {
      projectDir: this.projectDir,
      installed,
      version,
      availableWorkflows: BMAD_WORKFLOWS,
      completedWorkflows: workflowArtifacts.completedWorkflows,
      inProgressWorkflows: workflowArtifacts.inProgressWorkflows,
      incompleteWorkflows: workflowArtifacts.incompleteWorkflows,
      detectedArtifacts: workflowArtifacts.detectedArtifacts,
      sprintStatus: workflowArtifacts.sprintStatus,
    };
  }

  async install(): Promise<InstallResult> {
    try {
      // Check for legacy BMAD v4 folder (.bmad-method)
      const legacyV4Path = path.join(this.projectDir, '.bmad-method');
      if (fs.existsSync(legacyV4Path)) {
        const bmadError: BmadError = {
          errorCode: 'BMAD_INSTALL_FAILED',
          message: 'Legacy BMAD v4 installation detected. Please remove the .bmad-method folder and try again.',
          recoveryAction: 'Remove the .bmad-method folder from your project directory, then retry installation.',
        };
        throw bmadError;
      }

      // Get safe username for config
      let safeUsername: string;
      try {
        const username = os.userInfo().username;
        safeUsername = username.charAt(0).toUpperCase() + username.slice(1);
      } catch {
        safeUsername = process.env.USER || process.env.USERNAME || 'User';
      }

      // Determine if this is a reinstall/update
      const isReinstall = this.checkInstallation();

      // Build npx command with non-interactive flags
      const commandParts = [
        'npx',
        '-y', // Auto-confirm npx
        'bmad-method@latest',
        'install',
        `--directory ${this.projectDir}`,
        '--modules bmm',
        '--tools none',
        `--user-name "${safeUsername}"`,
        '--communication-language English',
        '--document-output-language English',
        '--output-folder _bmad-output',
      ];

      // Add action flag if updating
      if (isReinstall) {
        commandParts.push('--action update');
      }

      commandParts.push('--yes'); // Accept all defaults and skip prompts

      const command = commandParts.join(' ');

      logger.info('Installing BMAD using npx', {
        command,
        isReinstall,
        directory: this.projectDir,
      });

      // Execute the npx command
      const execAsync = promisify(exec);
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.projectDir,
        env: { ...process.env, FORCE_COLOR: '0' },
      });

      if (stderr) {
        logger.warn('BMAD installation stderr output', { stderr });
      }

      logger.debug('BMAD installation stdout', { stdout });

      // Verify installation
      const installed = this.checkInstallation();
      if (!installed) {
        throw new Error('Installation verification failed - BMAD directory not detected');
      }

      const version = this.getVersion();
      logger.info('BMAD installation completed', {
        version,
        actionType: isReinstall ? 'update' : 'install',
      });

      return {
        success: true,
        version,
        message: isReinstall ? 'BMAD updated successfully' : 'BMAD installed successfully',
      };
    } catch (error: unknown) {
      logger.error('BMAD installation failed', { error });

      const bmadError: BmadError = {
        errorCode: 'BMAD_INSTALL_FAILED',
        message: `Failed to install BMAD: ${error instanceof Error ? error.message : String(error)}`,
        recoveryAction: this.getRecoveryAction(error),
        details: error instanceof Error ? error.stack : String(error),
      };

      throw bmadError;
    }
  }

  private getRecoveryAction(error: unknown): string {
    if (error && typeof error === 'object' && 'code' in error) {
      const code = (error as { code: string }).code;

      switch (code) {
        case 'EACCES':
        case 'EPERM':
          return 'Check write permissions for project directory';
        case 'ENOSPC':
          return 'Free up disk space and retry installation';
        case 'ENOENT':
          return 'Ensure BMAD library is bundled with application';
        default:
          break;
      }
    }

    return 'Try restarting the application and retry installation';
  }

  /**
   * Execute a BMAD workflow via Agent Mode
   * @param workflowId - ID of the workflow to execute
   * @param task - Task instance for Agent Mode execution
   * @returns Workflow execution result with success status
   */
  /**
   * Reset BMAD workflow state by clearing the _bmad-output directory
   * @returns Promise resolving to success status
   */
  async resetWorkflow(): Promise<{ success: boolean; message?: string }> {
    try {
      const outputDir = path.join(this.projectDir, '_bmad-output');

      // Check if directory exists
      if (!fs.existsSync(outputDir)) {
        logger.info('BMAD output directory does not exist, nothing to reset');
        return {
          success: true,
          message: 'No workflow state to reset',
        };
      }

      // Remove the directory recursively
      await fsPromises.rm(outputDir, { recursive: true, force: true });

      logger.info('BMAD workflow state reset successfully', { outputDir });

      return {
        success: true,
        message: 'Workflow state reset successfully',
      };
    } catch (error) {
      logger.error('Failed to reset BMAD workflow state', { error });

      return {
        success: false,
        message: `Failed to reset workflow state: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async executeWorkflow(workflowId: string, task: Task): Promise<WorkflowExecutionResult> {
    try {
      const workflow = BMAD_WORKFLOWS.find((w) => w.id === workflowId);
      if (!workflow) {
        throw new Error(`Workflow '${workflowId}' not found in registry`);
      }

      // 1. Get current BMAD status
      const status = await this.getBmadStatus();

      // 2. Prepare context using ContextPreparer
      const preparer = new ContextPreparer(this.projectDir);
      const preparedContext = await preparer.prepare(workflowId, status);

      logger.info('Context prepared for workflow execution', {
        workflowId,
        contextFilesCount: preparedContext.contextFiles.length,
      });

      // 3. Execute workflow via Agent Mode
      const agentProfile = await task.getTaskAgentProfile();
      if (!agentProfile) {
        throw new Error('No agent profile configured for this task');
      }

      const promptContext = { id: uuidv4() };

      logger.info('Executing workflow via Agent Mode', {
        workflowId,
        agentProfile: agentProfile.name,
      });

      const contextFiles: ContextFile[] = preparedContext.contextFiles.map((filePath) => ({
        path: filePath,
        readOnly: true,
      }));

      // Store prepared context messages in task context and send to UI
      if (preparedContext.contextMessages.length > 0) {
        await task.loadContextMessages(preparedContext.contextMessages);
        logger.info('Prepared context messages loaded into task context', {
          workflowId,
          contextMessagesCount: preparedContext.contextMessages.length,
        });
      }

      if (!task.task.name) {
        await task.saveTask({ name: preparedContext.taskName ?? workflow.name });
      }

      // Store workflow ID in task metadata
      await task.updateTask({
        metadata: {
          ...task.task.metadata,
          bmadWorkflowId: workflowId,
        },
      });

      if (preparedContext.execute) {
        task.addLogMessage('loading');
        await task.runPromptInAgent(
          agentProfile,
          null, // No user prompt - workflow is system-driven
          promptContext,
          preparedContext.contextMessages,
          contextFiles,
        );
      }

      logger.info('Workflow execution completed', { workflowId });

      // 4. Return success
      return {
        success: true,
      };
    } catch (error) {
      logger.error('Workflow execution failed:', { workflowId, error });

      // Determine error code based on error type
      let errorCode = 'WORKFLOW_EXECUTION_FAILED';
      let recoveryAction = 'Check workflow configuration and retry';

      if (error instanceof Error) {
        if (error.message.includes('agent profile')) {
          errorCode = 'AGENT_PROFILE_MISSING';
          recoveryAction = 'Configure an agent profile for this task';
        } else if (
          error.message.includes('Workflow definition') ||
          error.message.includes('Workflow not found') ||
          error.message.includes('WORKFLOW_NOT_FOUND')
        ) {
          errorCode = 'WORKFLOW_DEFINITION_MISSING';
          recoveryAction = 'Ensure BMAD library is installed and workflow exists';
        }
      }

      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : String(error),
          errorCode,
          recoveryAction,
        },
      };
    }
  }
}
