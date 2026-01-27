import fs from 'fs/promises';
import path from 'path';

import Handlebars from 'handlebars';
import { FSWatcher, watch } from 'chokidar';
import debounce from 'lodash/debounce';
import { AgentProfile, ConflictResolutionFileContext, SettingsData, ToolApprovalState } from '@common/types';
import {
  AIDER_TOOL_ADD_CONTEXT_FILES,
  AIDER_TOOL_DROP_CONTEXT_FILES,
  AIDER_TOOL_GET_CONTEXT_FILES,
  AIDER_TOOL_GROUP_NAME,
  AIDER_TOOL_RUN_PROMPT,
  HELPERS_TOOL_GROUP_NAME,
  MEMORY_TOOL_DELETE,
  MEMORY_TOOL_GROUP_NAME,
  MEMORY_TOOL_LIST,
  MEMORY_TOOL_RETRIEVE,
  MEMORY_TOOL_STORE,
  POWER_TOOL_BASH,
  POWER_TOOL_FILE_EDIT,
  POWER_TOOL_FILE_READ,
  POWER_TOOL_FILE_WRITE,
  POWER_TOOL_GLOB,
  POWER_TOOL_GREP,
  POWER_TOOL_GROUP_NAME,
  POWER_TOOL_SEMANTIC_SEARCH,
  SKILLS_TOOL_ACTIVATE_SKILL,
  SKILLS_TOOL_GROUP_NAME,
  SUBAGENTS_TOOL_GROUP_NAME,
  SUBAGENTS_TOOL_RUN_TASK,
  TODO_TOOL_CLEAR_ITEMS,
  TODO_TOOL_GET_ITEMS,
  TODO_TOOL_GROUP_NAME,
  TODO_TOOL_SET_ITEMS,
  TODO_TOOL_UPDATE_ITEM_COMPLETION,
  TOOL_GROUP_NAME_SEPARATOR,
} from '@common/tools';

import { registerAllHelpers } from './helpers';
import {
  CommitMessagePromptData,
  CompactConversationPromptData,
  ConflictResolutionPromptData,
  ConflictResolutionSystemPromptData,
  HandoffPromptData,
  InitProjectPromptData,
  PromptTemplateData,
  PromptTemplateName,
  TaskNamePromptData,
  ToolPermissions,
  UpdateTaskStateData,
} from './types';

import { AIDER_DESK_DEFAULT_PROMPTS_DIR, AIDER_DESK_GLOBAL_PROMPTS_DIR, AIDER_DESK_PROMPTS_DIR } from '@/constants';
import logger from '@/logger';
import { Task } from '@/task';

export class PromptsManager {
  private globalTemplates = new Map<string, HandlebarsTemplateDelegate>();
  private projectTemplatesCache = new Map<string, Map<string, HandlebarsTemplateDelegate>>();
  private watchers = new Map<string, FSWatcher>();

  constructor(
    private readonly defaultTemplatesDir = AIDER_DESK_DEFAULT_PROMPTS_DIR,
    private readonly globalPromptsDir = AIDER_DESK_GLOBAL_PROMPTS_DIR,
  ) {
    registerAllHelpers();
  }

  public async init(): Promise<void> {
    await this.compileGlobalTemplates();
    await this.setupGlobalWatcher();
  }

  private async compileGlobalTemplates(): Promise<void> {
    this.globalTemplates.clear();
    const templateNames = this.getTemplateNames();

    for (const name of templateNames) {
      const source = await this.loadGlobalTemplateSource(name);
      if (source) {
        this.globalTemplates.set(name, Handlebars.compile(source, { noEscape: true }));
      }
    }
    logger.info(`Compiled ${this.globalTemplates.size} global prompt templates`);
  }

  private async compileProjectTemplates(projectDir: string): Promise<void> {
    const projectTemplates = new Map<string, HandlebarsTemplateDelegate>();
    const templateNames = this.getTemplateNames();
    const projectPromptsDir = path.join(projectDir, AIDER_DESK_PROMPTS_DIR);

    for (const name of templateNames) {
      const source = await this.loadProjectTemplateSource(projectPromptsDir, name);
      if (source) {
        projectTemplates.set(name, Handlebars.compile(source, { noEscape: true }));
      }
    }

    if (projectTemplates.size > 0) {
      this.projectTemplatesCache.set(projectDir, projectTemplates);
      logger.info(`Compiled ${projectTemplates.size} project-specific prompt templates for ${projectDir}`);
    } else {
      this.projectTemplatesCache.delete(projectDir);
    }
  }

  private getTemplateNames(): PromptTemplateName[] {
    return [
      'system-prompt',
      'init-project',
      'workflow',
      'compact-conversation',
      'commit-message',
      'task-name',
      'conflict-resolution',
      'conflict-resolution-system',
      'update-task-state',
      'handoff',
    ];
  }

  private async loadGlobalTemplateSource(name: PromptTemplateName): Promise<string | null> {
    const fileName = `${name}.hbs`;

    // Check global prompts
    try {
      const globalPath = path.join(this.globalPromptsDir, fileName);
      const globalExists = await fs
        .access(globalPath)
        .then(() => true)
        .catch(() => false);
      if (globalExists) {
        return await fs.readFile(globalPath, 'utf8');
      }
    } catch (error) {
      logger.warn(`Failed to load global template ${name}: ${error}`);
    }

    // Fall back to default templates from resources
    try {
      const defaultPath = path.join(this.defaultTemplatesDir, fileName);
      return await fs.readFile(defaultPath, 'utf8');
    } catch (error) {
      logger.error(`Failed to load default template ${name}: ${error}`);
      return null;
    }
  }

  private async loadProjectTemplateSource(projectPromptsDir: string, name: PromptTemplateName): Promise<string | null> {
    const fileName = `${name}.hbs`;
    try {
      const projectPath = path.join(projectPromptsDir, fileName);
      const projectExists = await fs
        .access(projectPath)
        .then(() => true)
        .catch(() => false);
      if (projectExists) {
        return await fs.readFile(projectPath, 'utf8');
      }
    } catch {
      // It's fine if project template doesn't exist
    }
    return null;
  }

  private async setupGlobalWatcher(): Promise<void> {
    try {
      await fs.mkdir(this.globalPromptsDir, { recursive: true });
    } catch (error) {
      logger.warn(`Could not create global prompts directory: ${error}`);
    }

    const watcher = watch(this.globalPromptsDir, {
      persistent: true,
      usePolling: true,
      ignoreInitial: true,
    });

    const debouncedReload = debounce(async () => {
      logger.info('Global prompts changed, reloading...');
      await this.compileGlobalTemplates();
    }, 1000);

    watcher
      .on('add', debouncedReload)
      .on('change', debouncedReload)
      .on('unlink', debouncedReload)
      .on('error', (error) => {
        logger.error('Watcher error for global prompts directory:', error);
      });

    this.watchers.set('global', watcher);
  }

  public async watchProject(projectDir: string): Promise<void> {
    if (this.watchers.has(projectDir)) {
      return;
    }

    const projectPromptsDir = path.join(projectDir, '.aider-desk', 'prompts');
    try {
      await fs.mkdir(projectPromptsDir, { recursive: true });
    } catch (error) {
      logger.warn(`Could not create project prompts directory: ${error}`);
    }

    await this.compileProjectTemplates(projectDir);

    const watcher = watch(projectPromptsDir, {
      persistent: true,
      usePolling: true,
      ignoreInitial: true,
    });

    const debouncedReload = debounce(async () => {
      logger.info(`Project prompts changed for ${projectDir}, reloading...`);
      await this.compileProjectTemplates(projectDir);
    }, 1000);

    watcher
      .on('add', debouncedReload)
      .on('change', debouncedReload)
      .on('unlink', debouncedReload)
      .on('error', (error) => {
        logger.error(`Watcher error for project prompts directory ${projectDir}:`, error);
      });

    this.watchers.set(projectDir, watcher);
  }

  public async unwatchProject(projectDir: string): Promise<void> {
    const watcher = this.watchers.get(projectDir);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(projectDir);
    }
    this.projectTemplatesCache.delete(projectDir);
  }

  public async dispose(): Promise<void> {
    for (const watcher of this.watchers.values()) {
      await watcher.close();
    }
    this.watchers.clear();
    this.globalTemplates.clear();
    this.projectTemplatesCache.clear();
    logger.info('PromptsManager disposed');
  }

  private render(name: PromptTemplateName, data: unknown, projectDir?: string): string {
    if (projectDir) {
      const projectTemplates = this.projectTemplatesCache.get(projectDir);
      const projectTemplate = projectTemplates?.get(name);
      if (projectTemplate) {
        return projectTemplate(data);
      }
    }

    const template = this.globalTemplates.get(name);
    if (!template) {
      throw new Error(`Template ${name} not found`);
    }
    return template(data);
  }

  private calculateToolPermissions = (settings: SettingsData, agentProfile: AgentProfile, autoApprove: boolean): ToolPermissions => {
    const { usePowerTools = false, useMemoryTools = false, useSkillsTools = false } = agentProfile;
    const memoryEnabled = settings.memory.enabled && useMemoryTools;

    const isAllowed = (tool: string) => agentProfile.toolApprovals[tool] !== ToolApprovalState.Never;

    return {
      aiderTools: agentProfile.useAiderTools,
      powerTools: {
        semanticSearch: usePowerTools && isAllowed(`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_SEMANTIC_SEARCH}`),
        fileRead: usePowerTools && isAllowed(`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_READ}`),
        fileWrite: usePowerTools && isAllowed(`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_WRITE}`),
        fileEdit: usePowerTools && isAllowed(`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_EDIT}`),
        glob: usePowerTools && isAllowed(`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_GLOB}`),
        grep: usePowerTools && isAllowed(`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_GREP}`),
        bash: usePowerTools && isAllowed(`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_BASH}`),
        anyEnabled: false, // Will be set below
      },
      todoTools: agentProfile.useTodoTools,
      subagents: agentProfile.useSubagents ?? false,
      memory: {
        enabled: memoryEnabled,
        retrieveAllowed: memoryEnabled && isAllowed(`${MEMORY_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${MEMORY_TOOL_RETRIEVE}`),
        storeAllowed: memoryEnabled && isAllowed(`${MEMORY_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${MEMORY_TOOL_STORE}`),
        listAllowed: memoryEnabled && isAllowed(`${MEMORY_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${MEMORY_TOOL_LIST}`),
        deleteAllowed: memoryEnabled && isAllowed(`${MEMORY_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${MEMORY_TOOL_DELETE}`),
      },
      skills: {
        allowed: useSkillsTools && isAllowed(`${SKILLS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${SKILLS_TOOL_ACTIVATE_SKILL}`),
      },
      autoApprove,
    };
  };

  public getSystemPrompt = async (
    settings: SettingsData,
    task: Task,
    agentProfile: AgentProfile,
    autoApprove = task.task.autoApprove ?? false,
    additionalInstructions?: string,
  ) => {
    const toolPermissions = this.calculateToolPermissions(settings, agentProfile, autoApprove);
    toolPermissions.powerTools.anyEnabled = Object.values(toolPermissions.powerTools).some((v) => v);

    const rulesFiles = await this.getRulesContent(task, agentProfile);
    const customInstructions = [agentProfile.customInstructions, additionalInstructions].filter(Boolean).join('\n\n').trim();

    const osName = (await import('os-name')).default();
    const currentDate = new Date().toDateString();

    const data: PromptTemplateData = {
      projectDir: task.getProjectDir(),
      taskDir: task.getTaskDir(),
      additionalInstructions,
      osName,
      currentDate,
      rulesFiles,
      customInstructions,
      toolPermissions,
      workflow: '', // Placeholder
      projectGitRootDirectory: task.getTaskDir() !== task.getProjectDir() ? task.getProjectDir() : undefined,
      toolConstants: {
        SUBAGENTS_TOOL_GROUP_NAME,
        SUBAGENTS_TOOL_RUN_TASK,
        TOOL_GROUP_NAME_SEPARATOR,
        TODO_TOOL_GROUP_NAME,
        TODO_TOOL_GET_ITEMS,
        TODO_TOOL_CLEAR_ITEMS,
        TODO_TOOL_SET_ITEMS,
        TODO_TOOL_UPDATE_ITEM_COMPLETION,
        MEMORY_TOOL_GROUP_NAME,
        MEMORY_TOOL_RETRIEVE,
        MEMORY_TOOL_LIST,
        MEMORY_TOOL_DELETE,
        AIDER_TOOL_GROUP_NAME,
        AIDER_TOOL_RUN_PROMPT,
        AIDER_TOOL_ADD_CONTEXT_FILES,
        AIDER_TOOL_GET_CONTEXT_FILES,
        AIDER_TOOL_DROP_CONTEXT_FILES,
        POWER_TOOL_GROUP_NAME,
        POWER_TOOL_SEMANTIC_SEARCH,
        POWER_TOOL_FILE_READ,
        POWER_TOOL_FILE_WRITE,
        POWER_TOOL_FILE_EDIT,
        POWER_TOOL_GLOB,
        POWER_TOOL_GREP,
        POWER_TOOL_BASH,
        HELPERS_TOOL_GROUP_NAME,
      },
    };

    const projectDir = task.getProjectDir();
    data.workflow = this.render('workflow', data, projectDir);

    return this.render('system-prompt', data, projectDir);
  };

  private getRulesContent = async (task: Task, agentProfile?: AgentProfile) => {
    const ruleFiles = await task.getRuleFilesAsContextFiles(agentProfile);

    const ruleFilesContent = await Promise.all(
      ruleFiles.map(async (file) => {
        try {
          let absolutePath: string;
          if (file.path.startsWith('~/')) {
            const homeDir = (await import('os')).homedir();
            absolutePath = path.join(homeDir, file.path.slice(2));
          } else if (path.isAbsolute(file.path)) {
            absolutePath = file.path;
          } else {
            absolutePath = path.join(task.getProjectDir(), file.path);
          }

          const content = await fs.readFile(absolutePath, 'utf8');
          const fileName = path.basename(file.path);
          return `      <File name="${fileName}"><![CDATA[\n${content}\n]]></File>`;
        } catch (err) {
          logger.warn(`Failed to read rule file ${file.path}: ${err}`);
          return null;
        }
      }),
    );

    return ruleFilesContent.filter(Boolean).join('\n');
  };

  public getInitProjectPrompt = (task: Task) => {
    const data: InitProjectPromptData = {};
    return this.render('init-project', data, task.getProjectDir());
  };

  public getCompactConversationPrompt = (task: Task, customInstructions?: string) => {
    const data: CompactConversationPromptData = { customInstructions };
    return this.render('compact-conversation', data, task.getProjectDir());
  };

  public getGenerateCommitMessagePrompt = (task: Task) => {
    const data: CommitMessagePromptData = {};
    return this.render('commit-message', data, task.getProjectDir());
  };

  public getGenerateTaskNamePrompt = (task: Task) => {
    const data: TaskNamePromptData = {};
    return this.render('task-name', data, task.getProjectDir());
  };

  public getConflictResolutionSystemPrompt = (task: Task) => {
    const data: ConflictResolutionSystemPromptData = {
      POWER_TOOL_GROUP_NAME,
      TOOL_GROUP_NAME_SEPARATOR,
      POWER_TOOL_FILE_EDIT,
    };
    return this.render('conflict-resolution-system', data, task.getProjectDir());
  };

  public getConflictResolutionPrompt = (
    task: Task,
    filePath: string,
    ctx: ConflictResolutionFileContext & {
      basePath?: string;
      oursPath?: string;
      theirsPath?: string;
    },
  ) => {
    const data: ConflictResolutionPromptData = {
      filePath,
      basePath: ctx.basePath,
      oursPath: ctx.oursPath,
      theirsPath: ctx.theirsPath,
    };
    return this.render('conflict-resolution', data, task.getProjectDir());
  };

  public getUpdateTaskStatePrompt = (task: Task) => {
    const data: UpdateTaskStateData = {};
    return this.render('update-task-state', data, task.getProjectDir());
  };

  public getHandoffPrompt = async (task: Task, focus?: string) => {
    const contextFiles = await task.getContextFiles();
    const data: HandoffPromptData = {
      focus,
      contextFiles,
    };
    return this.render('handoff', data, task.getProjectDir());
  };
}
