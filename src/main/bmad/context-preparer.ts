import path from 'path';
import fs from 'fs/promises';

import Handlebars from 'handlebars';
import { v4 as uuidv4 } from 'uuid';
import { glob } from 'glob';
import { ContextMessage, ContextUserMessage } from '@common/types';
import { fileExists } from '@common/utils';
import * as yaml from 'yaml';

import type { BmadStatus } from '@common/bmad-types';

import logger from '@/logger';
import { execWithShellPath } from '@/utils';

export interface PreparedContext {
  contextMessages: ContextMessage[];
  contextFiles: string[];
  execute: boolean;
  taskName?: string;
}

/**
 * ContextPreparer prepares context for workflow execution based on current BMAD status
 */
export class ContextPreparer {
  constructor(private readonly projectDir: string) {}

  /**
   * Prepare context for workflow execution
   * @param workflowId - ID of workflow to prepare context for
   * @param status - Current BMAD status with workflow and artifact information
   * @returns Prepared context with messages and file paths
   */
  async prepare(workflowId: string, status: BmadStatus): Promise<PreparedContext> {
    const context: PreparedContext = {
      contextMessages: [],
      contextFiles: [],
      execute: true,
    };

    // Inject context messages based on workflow ID
    await this.injectContextMessages(workflowId, context, status);

    return context;
  }

  private async injectContextMessages(workflowId: string, context: PreparedContext, status: BmadStatus) {
    const templateInjected = await this.injectTemplate(workflowId, context);
    if (!templateInjected) {
      logger.warn('Context template not found.', { workflowId });
      return;
    }

    logger.debug('Context template loaded.', { workflowId });

    switch (workflowId) {
      case 'research':
        // research workflow doesn't auto-execute, it's waiting for user input
        context.execute = false;
        break;
      case 'quick-spec':
        await this.injectQuickSpecContext(context, status);
        break;
      case 'quick-dev':
        await this.injectQuickDevContext(context, status);
        break;
      case 'brainstorming':
        await this.injectBrainstormingContext(context, status);
        break;
      case 'sprint-planning':
        await this.injectSprintPlanningContext(context, status);
        break;
      case 'create-story':
        await this.injectCreateStoryContext(context, status);
        break;
      case 'dev-story':
        await this.injectDevStoryContext(context, status);
        break;
      case 'code-review':
        await this.injectCodeReviewContext(context, status);
        break;
    }
  }

  private async injectTemplate(workflowId: string, context: PreparedContext): Promise<boolean> {
    try {
      const module = await import(`./context/${workflowId}.json.hbs?raw`);
      const templateSource = module.default ?? module;

      logger.debug('Context template found', { workflowId });

      const template = Handlebars.compile(templateSource, {
        noEscape: true,
      });

      const rendered = template({ projectDir: this.projectDir });
      const messages = JSON.parse(rendered) as ContextMessage[];

      context.contextMessages = messages.map((msg) => ({ ...msg }));

      return true;
    } catch (error) {
      logger.error('Failed to load context template', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  private async injectBrainstormingContext(context: PreparedContext, status: BmadStatus): Promise<void> {
    const brainstormingArtifact = status.detectedArtifacts['brainstorming'];
    const hasIncompleteWorkflow = status.incompleteWorkflows?.find((w) => w.workflowId === 'brainstorming');

    // Check if there's an existing incomplete brainstorming session
    if (hasIncompleteWorkflow && brainstormingArtifact?.path) {
      const userMessage: ContextUserMessage = {
        id: uuidv4(),
        role: 'user',
        content: `We already have a brainstorming session in progress. We should continue with the existing brainstorming session at \`${brainstormingArtifact.path}\`. Here is the current content of the file: \n\`\`\`${await fs.readFile(brainstormingArtifact.path, 'utf8')}\`\`\``,
        promptContext: {
          id: 'brainstorming',
          group: {
            id: 'brainstorming',
          },
        },
      };
      context.contextMessages.push(userMessage);
    } else {
      const userMessage: ContextUserMessage = {
        id: uuidv4(),
        role: 'user',
        content: 'We have no brainstorming document in the output. Let us create a new one and start a new brainstorming session.',
        promptContext: {
          id: 'brainstorming',
          group: {
            id: 'brainstorming',
          },
        },
      };
      context.contextMessages.push(userMessage);
    }
  }

  private async injectSprintPlanningContext(context: PreparedContext, _status: BmadStatus): Promise<void> {
    const sprintStatusPath = path.join(this.projectDir, '_bmad-output/implementation-artifacts/sprint-status.yaml');
    const epicsPath = path.join(this.projectDir, '_bmad-output/planning-artifacts/epics.md');

    const sprintStatusExists = await fileExists(sprintStatusPath);
    const epicsExists = await fileExists(epicsPath);

    const messageParts: string[] = [];

    messageParts.push('**Sprint Planning Context**\n');

    if (sprintStatusExists) {
      messageParts.push('- Existing sprint-status.yaml found at `_bmad-output/implementation-artifacts/sprint-status.yaml`');
      messageParts.push('- Please preserve existing statuses when generating the new sprint-status.yaml');
      messageParts.push("- Never downgrade status (e.g., don't change 'done' to 'ready-for-dev')");
    } else {
      messageParts.push('- No existing sprint-status.yaml found, creating new file');
    }

    if (epicsExists) {
      messageParts.push('- Epics file found at `_bmad-output/planning-artifacts/epics.md`');
    } else {
      messageParts.push('- No epics file found at `_bmad-output/planning-artifacts/epics.md`');
      messageParts.push('- Please search for epic files in the planning artifacts directory');
    }

    const userMessage: ContextUserMessage = {
      id: uuidv4(),
      role: 'user',
      content: messageParts.join('\n'),
      promptContext: {
        id: 'sprint-planning-context',
        group: {
          id: 'sprint-planning',
        },
      },
    };

    context.contextMessages.push(userMessage);
  }

  private async injectCreateStoryContext(context: PreparedContext, _status: BmadStatus): Promise<void> {
    const sprintStatusPath = path.join(this.projectDir, '_bmad-output/implementation-artifacts/sprint-status.yaml');

    const sprintStatusExists = await fileExists(sprintStatusPath);
    const messageParts: string[] = [];

    messageParts.push('**Create Story Context**\n');

    if (!sprintStatusExists) {
      messageParts.push('- No sprint-status.yaml found');
      messageParts.push('- Please run sprint-planning workflow first to create the sprint status file');
      const userMessage: ContextUserMessage = {
        id: uuidv4(),
        role: 'user',
        content: messageParts.join('\n'),
        promptContext: {
          id: 'create-story-context',
          group: {
            id: 'create-story',
          },
        },
      };
      context.contextMessages.push(userMessage);
      return;
    }

    try {
      const sprintStatusContent = await fs.readFile(sprintStatusPath, 'utf8');
      const sprintStatus = yaml.parse(sprintStatusContent) as { development_status: Record<string, string> };

      const developmentStatus = sprintStatus.development_status || {};

      let nextBacklogStory: string | null = null;
      let nextBacklogStoryStatus: string | null = null;

      for (const [key, value] of Object.entries(developmentStatus)) {
        if (key === 'project' || key === 'project_key' || key === 'tracking_system' || key === 'story_location') {
          continue;
        }

        if (key.startsWith('epic-') && key.endsWith('-retrospective')) {
          continue;
        }

        if (/^epic-\d+$/.test(key)) {
          continue;
        }

        if (value === 'backlog') {
          nextBacklogStory = key;
          nextBacklogStoryStatus = value;
          break;
        }
      }

      if (nextBacklogStory) {
        messageParts.push(`- Next story to create: \`${nextBacklogStory}\``);
        messageParts.push(`- Current status: \`${nextBacklogStoryStatus}\``);
        messageParts.push('- Please create a story file for this user story');
        context.taskName = `[Create] ${nextBacklogStory}`;
      } else {
        messageParts.push('- No stories with "backlog" status found');
        messageParts.push('- All stories may already be created or no stories exist');
      }
    } catch (error) {
      logger.error('Failed to read or parse sprint-status.yaml', { error: error instanceof Error ? error.message : String(error) });
      messageParts.push('- Error reading sprint-status.yaml');
    }

    const userMessage: ContextUserMessage = {
      id: uuidv4(),
      role: 'user',
      content: messageParts.join('\n'),
      promptContext: {
        id: 'create-story-context',
        group: {
          id: 'create-story',
        },
      },
    };

    context.contextMessages.push(userMessage);
  }

  private async injectDevStoryContext(context: PreparedContext, _status: BmadStatus): Promise<void> {
    const sprintStatusPath = path.join(this.projectDir, '_bmad-output/implementation-artifacts/sprint-status.yaml');

    const sprintStatusExists = await fileExists(sprintStatusPath);
    const messageParts: string[] = [];

    messageParts.push('**Dev Story Context**\n');

    if (!sprintStatusExists) {
      messageParts.push('- No sprint-status.yaml found');
      messageParts.push('- Please run sprint-planning workflow first to create the sprint status file');
      const userMessage: ContextUserMessage = {
        id: uuidv4(),
        role: 'user',
        content: messageParts.join('\n'),
        promptContext: {
          id: 'dev-story-context',
          group: {
            id: 'dev-story',
          },
        },
      };
      context.contextMessages.push(userMessage);
      return;
    }

    try {
      const sprintStatusContent = await fs.readFile(sprintStatusPath, 'utf8');
      const sprintStatus = yaml.parse(sprintStatusContent) as { development_status: Record<string, string> };

      const developmentStatus = sprintStatus.development_status || {};

      let nextReadyForDevStory: string | null = null;
      let nextReadyForDevStoryStatus: string | null = null;

      for (const [key, value] of Object.entries(developmentStatus)) {
        if (key === 'project' || key === 'project_key' || key === 'tracking_system' || key === 'story_location') {
          continue;
        }

        if (/^epic-\d+$/.test(key)) {
          continue;
        }

        if (key.endsWith('-retrospective')) {
          continue;
        }

        if (value === 'ready-for-dev') {
          nextReadyForDevStory = key;
          nextReadyForDevStoryStatus = value;
          break;
        }
      }

      if (nextReadyForDevStory) {
        messageParts.push(`- Next story to develop: \`${nextReadyForDevStory}\``);
        messageParts.push(`- Current status: \`${nextReadyForDevStoryStatus}\``);
        messageParts.push('- Please read the story file and implement it');
        context.taskName = `[Dev] ${nextReadyForDevStory}`;
      } else {
        messageParts.push('- No stories with "ready-for-dev" status found');
        messageParts.push('- All stories may already be in progress, done, or no stories exist');
        messageParts.push('- Please run create-story workflow to create more stories if needed');
      }
    } catch (error) {
      logger.error('Failed to read or parse sprint-status.yaml', { error: error instanceof Error ? error.message : String(error) });
      messageParts.push('- Error reading sprint-status.yaml');
    }

    const userMessage: ContextUserMessage = {
      id: uuidv4(),
      role: 'user',
      content: messageParts.join('\n'),
      promptContext: {
        id: 'dev-story-context',
        group: {
          id: 'dev-story',
        },
      },
    };

    context.contextMessages.push(userMessage);
  }

  private async injectCodeReviewContext(context: PreparedContext, _status: BmadStatus): Promise<void> {
    const sprintStatusPath = path.join(this.projectDir, '_bmad-output/implementation-artifacts/sprint-status.yaml');

    const sprintStatusExists = await fileExists(sprintStatusPath);
    const messageParts: string[] = [];

    messageParts.push('**Code Review Context**\n');

    if (!sprintStatusExists) {
      messageParts.push('- No sprint-status.yaml found');
      messageParts.push('- Please run sprint-planning workflow first to create the sprint status file');
      const userMessage: ContextUserMessage = {
        id: uuidv4(),
        role: 'user',
        content: messageParts.join('\n'),
        promptContext: {
          id: 'code-review-context',
          group: {
            id: 'code-review',
          },
        },
      };
      context.contextMessages.push(userMessage);
      return;
    }

    try {
      const sprintStatusContent = await fs.readFile(sprintStatusPath, 'utf8');
      const sprintStatus = yaml.parse(sprintStatusContent) as { development_status: Record<string, string> };

      const developmentStatus = sprintStatus.development_status || {};

      let nextReviewStory: string | null = null;
      let nextReviewStoryStatus: string | null = null;

      for (const [key, value] of Object.entries(developmentStatus)) {
        if (key === 'project' || key === 'project_key' || key === 'tracking_system' || key === 'story_location') {
          continue;
        }

        if (/^epic-\d+$/.test(key)) {
          continue;
        }

        if (key.endsWith('-retrospective')) {
          continue;
        }

        if (value === 'review') {
          nextReviewStory = key;
          nextReviewStoryStatus = value;
          break;
        }
      }

      if (nextReviewStory) {
        messageParts.push(`- Next story to review: \`${nextReviewStory}\``);
        messageParts.push(`- Current status: \`${nextReviewStoryStatus}\``);
        messageParts.push('- Please read the story file and review the implementation');
        context.taskName = `[Review] ${nextReviewStory}`;
      } else {
        messageParts.push('- No stories with "review" status found');
        messageParts.push('- All stories may already be done or no stories are ready for review');
        messageParts.push('- Please run dev-story workflow to implement more stories if needed');
      }
    } catch (error) {
      logger.error('Failed to read or parse sprint-status.yaml', { error: error instanceof Error ? error.message : String(error) });
      messageParts.push('- Error reading sprint-status.yaml');
    }

    const userMessage: ContextUserMessage = {
      id: uuidv4(),
      role: 'user',
      content: messageParts.join('\n'),
      promptContext: {
        id: 'code-review-context',
        group: {
          id: 'code-review',
        },
      },
    };

    context.contextMessages.push(userMessage);
  }

  private async injectQuickDevContext(context: PreparedContext, status: BmadStatus): Promise<void> {
    // 1. Get git baseline
    let gitBaseline = 'NO_GIT';
    try {
      const { stdout } = await execWithShellPath('git rev-parse HEAD', { cwd: this.projectDir });
      gitBaseline = stdout.trim();
    } catch {
      logger.debug('Not a git repository or no commits yet', { projectDir: this.projectDir });
    }

    // 2. Find project-context.md
    let projectContextPath: string | null = null;
    try {
      const matches = await glob('**/project-context.md', {
        cwd: this.projectDir,
        ignore: ['node_modules/**', '.git/**'],
      });
      if (matches.length > 0) {
        projectContextPath = matches[0];
      }
    } catch (error) {
      logger.debug('Failed to search for project-context.md', { error });
    }

    // 3. Check for ready-for-dev tech-spec from quick-spec workflow
    const quickSpecArtifact = status.detectedArtifacts['quick-spec'];
    const hasReadyTechSpec = quickSpecArtifact?.status === 'ready-for-dev';

    // 4. Build user message content
    const messageParts: string[] = [];

    // Git baseline info
    messageParts.push(`**Git Baseline:** \`${gitBaseline}\``);

    // Project context info
    if (projectContextPath) {
      messageParts.push(`**Project Context:** Found at \`${projectContextPath}\``);
    } else {
      messageParts.push('**Project Context:** Not found');
    }

    // Mode determination
    if (hasReadyTechSpec) {
      // Mode A: Tech-spec provided
      messageParts.push('\n**Mode A: Tech-Spec Provided**');
      messageParts.push(`Tech-spec path: \`${quickSpecArtifact.path}\``);
      messageParts.push(
        `\nPlease proceed with executing the tech-spec. Set \`{execution_mode}\` = "tech-spec" and \`{tech_spec_path}\` = "${quickSpecArtifact.path}".`,
      );
    } else {
      // Mode B: No tech-spec, ask user for instructions
      messageParts.push('\n**Mode B: Direct Instructions**');
      messageParts.push(
        'No tech-spec ready for development. Please ask me what I want to build or implement, then evaluate the escalation threshold as described in step-01-mode-detection.md.',
      );
    }

    // Create and add user message
    const userMessage: ContextUserMessage = {
      id: uuidv4(),
      role: 'user',
      content: messageParts.join('\n'),
      promptContext: {
        id: 'quick-dev-context',
        group: {
          id: 'quick-dev',
        },
      },
    };

    context.contextMessages.push(userMessage);
  }

  private async injectQuickSpecContext(context: PreparedContext, status: BmadStatus): Promise<void> {
    const wipFilePath = '_bmad-output/implementation-artifacts/tech-spec-wip.md';
    const fullWipPath = path.join(this.projectDir, wipFilePath);

    const quickSpecArtifact = status.detectedArtifacts['quick-spec'];
    const quickDevCompleted = status.completedWorkflows.includes('quick-dev');

    const hasReadyTechSpec = quickSpecArtifact?.status === 'ready-for-dev';
    const wipFileExists = await fileExists(fullWipPath);

    const shouldStartFresh = !wipFileExists && (hasReadyTechSpec || quickDevCompleted);

    if (shouldStartFresh) {
      const userMessage: ContextUserMessage = {
        id: uuidv4(),
        role: 'user',
        content: 'There is no tech-spec-wip.md file yet, we are starting the empty specification.',
        promptContext: {
          id: 'quick-spec-context',
          group: {
            id: 'quick-spec',
          },
        },
      };

      context.contextMessages.push(userMessage);
    } else {
      const userMessage: ContextUserMessage = {
        id: uuidv4(),
        role: 'user',
        content: `Continuing with the existing tech-spec work in progress at \`${wipFilePath}\`.`,
        promptContext: {
          id: 'quick-spec-context',
          group: {
            id: 'quick-spec',
          },
        },
      };

      context.contextMessages.push(userMessage);
    }
  }
}
