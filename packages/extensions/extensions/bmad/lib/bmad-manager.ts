import * as path from 'path';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

import { v4 as uuidv4 } from 'uuid';
import { glob } from 'glob';
import * as yaml from 'yaml';
import * as yamlFront from 'yaml-front-matter';

import { StoryStatus } from './types';
import { BMAD_WORKFLOWS } from './workflows';
import { ContextPreparer } from './context-preparer';

import type { BmadError, BmadStatus, InstallResult, IncompleteWorkflowMetadata, SprintStatusData, WorkflowArtifacts, WorkflowExecutionResult } from './types';
import type { ExtensionContext, TaskContext, ContextFile, PromptContext } from '@aiderdesk/extensions';

export class BmadManager {
  constructor(
    private readonly projectDir: string,
    private readonly context: ExtensionContext,
  ) {}

  checkInstallation(): boolean {
    try {
      const bmadPath = path.join(this.projectDir, '_bmad', 'bmm');
      return fs.existsSync(bmadPath);
    } catch {
      this.context.log('BMAD installation check failed', 'error');
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
    } catch {
      this.context.log('BMAD version detection failed', 'error');
      return undefined;
    }
  }

  private parseStepNumber = (stepId: string, index: number): number => {
    const pureNumber = parseInt(stepId, 10);
    if (!isNaN(pureNumber)) {
      return pureNumber;
    }

    const stepPattern = /^step-(\d+)/i;
    const match = stepId.match(stepPattern);
    if (match) {
      return parseInt(match[1], 10);
    }

    return index + 1;
  };

  private VALID_STORY_STATUSES: StoryStatus[] = [StoryStatus.Backlog, StoryStatus.ReadyForDev, StoryStatus.InProgress, StoryStatus.Review, StoryStatus.Done];

  private isValidStoryStatus = (status: string): status is StoryStatus => {
    return this.VALID_STORY_STATUSES.includes(status as StoryStatus);
  };

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

      this.context.log('Parsed sprint-status.yaml', 'debug');

      return { storyStatuses, completedWorkflows };
    } catch {
      return undefined;
    }
  }

  private async scanWorkflows(projectRoot: string): Promise<WorkflowArtifacts> {
    const outputDir = path.join(projectRoot, '_bmad-output');

    try {
      await fsPromises.access(outputDir);
    } catch {
      return {
        completedWorkflows: [],
        inProgressWorkflows: [],
        detectedArtifacts: {},
      };
    }

    const completedWorkflows: string[] = [];
    const inProgressWorkflows: string[] = [];
    const detectedArtifacts: WorkflowArtifacts['detectedArtifacts'] = {};
    const incompleteWorkflows: IncompleteWorkflowMetadata[] = [];
    const workflowsWithNonCompletingStatus = new Set<string>();

    for (const workflow of BMAD_WORKFLOWS) {
      const { id, outputArtifact } = workflow;

      try {
        const fullPattern = path.join(projectRoot, outputArtifact);

        const matches = await glob(fullPattern, {
          windowsPathsNoEscape: true,
        });

        if (matches.length > 0) {
          const artifactPath = matches[0];

          let stepsCompleted: string[] | undefined;
          let status: string | undefined;
          let frontmatterError: string | undefined;

          try {
            const content = await fsPromises.readFile(artifactPath, 'utf-8');
            const { __content, ...properties } = yamlFront.loadFront(content);

            if (properties.stepsCompleted) {
              stepsCompleted = properties.stepsCompleted;
            }

            if (properties.status) {
              status = properties.status;
            }
          } catch (parseError) {
            frontmatterError = parseError instanceof Error ? parseError.message : 'Unknown error parsing frontmatter';
          }

          detectedArtifacts[id] = {
            path: artifactPath,
            ...(stepsCompleted && { stepsCompleted }),
            ...(status && { status }),
            ...(frontmatterError && { error: frontmatterError }),
          };

          if (id === 'quick-dev' && status) {
            const statusLower = status.toLowerCase();
            const hasCompletingStatus = statusLower.includes('complete') || statusLower.includes('done');
            if (!hasCompletingStatus) {
              workflowsWithNonCompletingStatus.add(id);
            }
          }

          const workflowTotalSteps = workflow.totalSteps;

          if (workflowTotalSteps > 0) {
            const stepsCompletedNumbers = stepsCompleted?.map((s, i) => this.parseStepNumber(s, i)) || [];
            const maxCompletedStep = stepsCompletedNumbers.length > 0 ? Math.max(...stepsCompletedNumbers) : 0;

            const isQuickSpecReadyForDevStatus = id === 'quick-spec' && status === 'ready-for-dev';
            const statusLower = status?.toLowerCase() || '';
            const isQuickDevCompletedByStatus = id === 'quick-dev' && (statusLower.includes('complete') || statusLower.includes('done'));

            const isLegacyComplete = !stepsCompleted && id !== 'quick-dev';
            const isStepsComplete = id === 'quick-dev' ? false : maxCompletedStep >= workflowTotalSteps;
            const isFullyCompleted = isLegacyComplete || isStepsComplete || isQuickSpecReadyForDevStatus || isQuickDevCompletedByStatus;

            if (isFullyCompleted) {
              completedWorkflows.push(id);
            } else {
              if (id === 'quick-dev' && detectedArtifacts['quick-spec']?.status === 'ready-for-dev') {
                continue;
              }

              inProgressWorkflows.push(id);

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
                // Failed to get file stats
              }
            }
          }
        }
      } catch {
        // Glob error - continue scanning
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
      const legacyV4Path = path.join(this.projectDir, '.bmad-method');
      if (fs.existsSync(legacyV4Path)) {
        const bmadError: BmadError = {
          errorCode: 'BMAD_INSTALL_FAILED',
          message: 'Legacy BMAD v4 installation detected. Please remove the .bmad-method folder and try again.',
          recoveryAction: 'Remove the .bmad-method folder from your project directory, then retry installation.',
        };
        throw bmadError;
      }

      let safeUsername: string;
      try {
        const username = os.userInfo().username;
        safeUsername = username.charAt(0).toUpperCase() + username.slice(1);
      } catch {
        safeUsername = process.env.USER || process.env.USERNAME || 'User';
      }

      const isReinstall = this.checkInstallation();

      const commandParts = [
        'npx',
        '-y',
        'bmad-method@6.0.4',
        'install',
        `--directory ${this.projectDir}`,
        '--modules bmm',
        '--tools none',
        `--user-name "${safeUsername}"`,
        '--communication-language English',
        '--document-output-language English',
        '--output-folder _bmad-output',
      ];

      if (isReinstall) {
        commandParts.push('--action update');
      }

      commandParts.push('--yes');

      const command = commandParts.join(' ');

      this.context.log('Installing BMAD using npx', 'info');

      const execAsync = promisify(exec);
      const { stdout: _stdout, stderr } = await execAsync(command, {
        cwd: this.projectDir,
        env: { ...process.env, FORCE_COLOR: '0' },
      });

      if (stderr) {
        this.context.log('BMAD installation stderr output', 'warn');
      }

      this.context.log('BMAD installation stdout', 'debug');

      const installed = this.checkInstallation();
      if (!installed) {
        throw new Error('Installation verification failed - BMAD directory not detected');
      }

      const version = this.getVersion();
      this.context.log('BMAD installation completed', 'info');

      return {
        success: true,
        version,
        message: isReinstall ? 'BMAD updated successfully' : 'BMAD installed successfully',
      };
    } catch (error: unknown) {
      this.context.log('BMAD installation failed', 'error');

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

  async resetWorkflow(): Promise<{ success: boolean; message?: string }> {
    try {
      const outputDir = path.join(this.projectDir, '_bmad-output');

      if (!fs.existsSync(outputDir)) {
        this.context.log('BMAD output directory does not exist, nothing to reset', 'info');
        return {
          success: true,
          message: 'No workflow state to reset',
        };
      }

      await fsPromises.rm(outputDir, { recursive: true, force: true });

      this.context.log('BMAD workflow state reset successfully', 'info');

      return {
        success: true,
        message: 'Workflow state reset successfully',
      };
    } catch (error) {
      this.context.log('Failed to reset BMAD workflow state', 'error');

      return {
        success: false,
        message: `Failed to reset workflow state: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async executeWorkflow(workflowId: string, taskContext: TaskContext, provider?: string, model?: string, asSubtask = false): Promise<WorkflowExecutionResult> {
    try {
      this.context.log(`Starting workflow execution: ${workflowId}, asSubtask: ${asSubtask}`, 'info');

      // If asSubtask is true, create a new subtask with the provider/model
      if (asSubtask) {
        this.context.log('Creating subtask for workflow execution...', 'debug');
        const parentId = taskContext.data.parentId || taskContext.data.id;
        
        // Get the project context to create a new task
        const projectContext = this.context.getProjectContext();
        const subtaskData = await projectContext.createTask({
          parentId,
          activate: true,
          provider,
          model,
        });

        this.context.log(`Subtask created: ${subtaskData.id}`, 'info');

        // Get the subtask context and execute the workflow on it
        const subtaskContext = projectContext.getTask(subtaskData.id);
        if (!subtaskContext) {
          throw new Error('Failed to get subtask context');
        }

        // Execute workflow on the subtask (without asSubtask to avoid infinite recursion)
        return await this.executeWorkflow(workflowId, subtaskContext, provider, model, false);
      }

      const workflow = BMAD_WORKFLOWS.find((w) => w.id === workflowId);
      if (!workflow) {
        throw new Error(`Workflow '${workflowId}' not found in registry`);
      }

      this.context.log(`Workflow found: ${workflow.name}`, 'debug');

      // 1. Get current BMAD status
      this.context.log('Getting BMAD status...', 'debug');
      const status = await this.getBmadStatus();
      this.context.log(`BMAD status retrieved: installed=${status.installed}`, 'debug');

      // 2. Prepare context using ContextPreparer
      this.context.log('Preparing workflow context...', 'debug');
      const preparer = new ContextPreparer(this.projectDir, this.context);
      const preparedContext = await preparer.prepare(workflowId, status);

      this.context.log(`Context prepared: ${preparedContext.contextMessages.length} messages, ${preparedContext.contextFiles.length} files`, 'debug');

      // 3. Execute workflow via Agent Mode
      this.context.log('Getting task agent profile...', 'debug');
      let agentProfile = await taskContext.getTaskAgentProfile();
      if (!agentProfile) {
        throw new Error('No agent profile configured for this task');
      }

      // Override provider/model if provided
      if (provider && model) {
        this.context.log(`Using custom provider/model: ${provider}/${model}`, 'debug');
        agentProfile = {
          ...agentProfile,
          provider,
          model,
        };
      }

      this.context.log(`Agent profile retrieved: ${agentProfile.name}`, 'debug');

      const promptContext: PromptContext = { id: uuidv4() };

      this.context.log('Building context files array...', 'debug');
      const contextFiles: ContextFile[] = preparedContext.contextFiles.map((filePath) => ({
        path: filePath,
        readOnly: true,
      }));

      // Store prepared context messages in task context and send to UI
      if (preparedContext.contextMessages.length > 0) {
        this.context.log('Loading context messages...', 'debug');
        await taskContext.loadContextMessages(preparedContext.contextMessages);
        this.context.log('Context messages loaded', 'debug');
      }

      if (!taskContext.data.name) {
        this.context.log('Updating task name...', 'debug');
        await taskContext.updateTask({ name: preparedContext.taskName ?? workflow.name });
      }

      // Store workflow ID in task metadata
      this.context.log('Storing workflow ID in metadata...', 'debug');
      await taskContext.updateTask({
        metadata: {
          ...taskContext.data.metadata,
          bmadWorkflowId: workflowId,
        },
      });

      if (preparedContext.execute) {
        this.context.log('Starting agent execution...', 'info');
        taskContext.addLoadingMessage();
        await taskContext.runPromptInAgent(
          agentProfile,
          'bmad',
          null, // No user prompt - workflow is system-driven
          promptContext,
          preparedContext.contextMessages,
          contextFiles,
          undefined,
          true,
          true,
        );
        this.context.log('Agent execution completed', 'info');
      } else {
        this.context.log('Workflow prepared but not set to execute', 'info');
      }

      this.context.log('Workflow execution completed', 'info');

      // 4. Return success
      return {
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.context.log(`Workflow execution failed: ${errorMessage}`, 'error');
      if (errorStack) {
        this.context.log(`Stack trace: ${errorStack}`, 'error');
      }

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
          message: errorMessage,
          errorCode,
          recoveryAction,
        },
      };
    }
  }
}
