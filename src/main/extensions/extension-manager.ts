import fs from 'fs/promises';
import path from 'path';
import os from 'os';

import { FSWatcher, watch } from 'chokidar';
import debounce from 'lodash/debounce';
import { z } from 'zod';
import { ToolApprovalState, AvailableExtension } from '@common/types';

import { ExtensionLoader } from './extension-loader';
import { ExtensionRegistry, LoadedExtension } from './extension-registry';
import { ExtensionContextImpl } from './extension-context';
import { ExtensionFetcher } from './extension-fetcher';

import type { AgentProfile } from '@common/types';
import type { Store } from '@/store';
import type { ModelManager } from '@/models';
import type { EventManager } from '@/events';
import type {
  AgentFinishedEvent,
  AgentStartedEvent,
  AgentStepFinishedEvent,
  OptimizeMessagesEvent,
  ImportantRemindersEvent,
  AiderPromptFinishedEvent,
  AiderPromptStartedEvent,
  CommandExecutedEvent,
  CustomCommandExecutedEvent,
  Extension,
  ExtensionContext,
  FilesAddedEvent,
  FilesDroppedEvent,
  HandleApprovalEvent,
  ModeDefinition,
  PromptFinishedEvent,
  PromptStartedEvent,
  QuestionAnsweredEvent,
  QuestionAskedEvent,
  ResponseChunkEvent,
  ResponseCompletedEvent,
  RuleFilesRetrievedEvent,
  SubagentFinishedEvent,
  SubagentStartedEvent,
  TaskClosedEvent,
  TaskCreatedEvent,
  TaskInitializedEvent,
  TaskPreparedEvent,
  TaskUpdatedEvent,
  ToolApprovalEvent,
  ToolCalledEvent,
  ToolDefinition,
  ToolFinishedEvent,
  CommandDefinition,
  ProjectStartedEvent,
  ProjectStoppedEvent,
} from '@common/extensions';
import type { ToolCallOptions, ToolSet } from 'ai';

import { execWithShellPath } from '@/utils/shell';
import logger from '@/logger';
import { AIDER_DESK_EXTENSIONS_DIR, AIDER_DESK_GLOBAL_EXTENSIONS_DIR } from '@/constants';
import { Project } from '@/project';
import { Task } from '@/task';

export type { LoadedExtension } from './extension-registry';

export type ExtensionsChangeListener = (extensions: LoadedExtension[]) => void;

export interface RegisteredTool {
  extensionName: string;
  tool: ToolDefinition;
}

export interface RegisteredCommand {
  extensionName: string;
  command: CommandDefinition;
}

export interface RegisteredAgent {
  extensionName: string;
  agent: AgentProfile;
}

export interface RegisteredMode {
  extensionName: string;
  mode: ModeDefinition;
}

/**
 * Mapping of extension event names to their event payload types
 */
export type ExtensionEventMap = {
  onProjectStarted: ProjectStartedEvent;
  onProjectStopped: ProjectStoppedEvent;
  onTaskCreated: TaskCreatedEvent;
  onTaskPrepared: TaskPreparedEvent;
  onTaskInitialized: TaskInitializedEvent;
  onTaskClosed: TaskClosedEvent;
  onTaskUpdated: TaskUpdatedEvent;
  onPromptStarted: PromptStartedEvent;
  onPromptFinished: PromptFinishedEvent;
  onAgentStarted: AgentStartedEvent;
  onAgentFinished: AgentFinishedEvent;
  onAgentStepFinished: AgentStepFinishedEvent;
  onOptimizeMessages: OptimizeMessagesEvent;
  onImportantReminders: ImportantRemindersEvent;
  onAiderPromptStarted: AiderPromptStartedEvent;
  onAiderPromptFinished: AiderPromptFinishedEvent;
  onToolApproval: ToolApprovalEvent;
  onToolCalled: ToolCalledEvent;
  onToolFinished: ToolFinishedEvent;
  onFilesAdded: FilesAddedEvent;
  onFilesDropped: FilesDroppedEvent;
  onRuleFilesRetrieved: RuleFilesRetrievedEvent;
  onResponseChunk: ResponseChunkEvent;
  onResponseCompleted: ResponseCompletedEvent;
  onHandleApproval: HandleApprovalEvent;
  onSubagentStarted: SubagentStartedEvent;
  onSubagentFinished: SubagentFinishedEvent;
  onQuestionAsked: QuestionAskedEvent;
  onQuestionAnswered: QuestionAnsweredEvent;
  onCommandExecuted: CommandExecutedEvent;
  onCustomCommandExecuted: CustomCommandExecutedEvent;
};

export class ExtensionManager {
  private loader: ExtensionLoader;
  private fetcher: ExtensionFetcher;
  private globalWatcher: FSWatcher | null = null;
  private projectWatchers: Map<string, FSWatcher> = new Map();
  private initialized = false;
  private listeners: ExtensionsChangeListener[] = [];

  constructor(
    private readonly store: Store,
    private readonly modelManager: ModelManager,
    private readonly eventManager: EventManager,
    private readonly registry: ExtensionRegistry = new ExtensionRegistry(),
  ) {
    this.loader = new ExtensionLoader();
    this.fetcher = new ExtensionFetcher();
  }

  private debouncedNotifyListeners = debounce(() => {
    const extensions = this.registry.getExtensions();
    for (const listener of this.listeners) {
      listener(extensions);
    }
  }, 100);

  /**
   * Filter extensions based on disabled list from settings
   * @param extensions - All loaded extensions
   * @returns Filtered extensions excluding disabled ones
   */
  private filterEnabledExtensions(extensions: LoadedExtension[]): LoadedExtension[] {
    const settings = this.store.getSettings();
    const disabledExtensions = settings.extensions?.disabled || [];

    return extensions.filter((ext) => !disabledExtensions.includes(ext.metadata.name));
  }

  addListener(listener: ExtensionsChangeListener): void {
    this.listeners.push(listener);
  }

  removeListener(listener: ExtensionsChangeListener): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  async init(): Promise<void> {
    logger.info('[Extensions] Starting extension system initialization...');

    try {
      this.registry.clear();

      await this.loadExtensionsForDir(AIDER_DESK_GLOBAL_EXTENSIONS_DIR);

      this.initialized = true;

      await this.startHotReloadWatcher();
    } catch (error) {
      logger.error(`[Extensions] Extension system initialization failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  private async initializeExtension(loaded: LoadedExtension, project?: Project): Promise<boolean> {
    const { instance, metadata } = loaded;

    if (!instance.onLoad) {
      logger.debug(`[Extensions] Extension '${metadata.name}' has no onLoad method, skipping initialization`);
      this.registry.setInitialized(metadata.name, true);
      return true;
    }

    try {
      const context = new ExtensionContextImpl(metadata.name, this.store, this.modelManager, project, undefined, this.eventManager);
      await instance.onLoad(context);
      this.registry.setInitialized(metadata.name, true);
      logger.info(`[Extensions] Initialized extension: ${metadata.name} v${metadata.version}`);
      return true;
    } catch (error) {
      logger.error(`[Extensions] Failed to call onLoad for extension '${metadata.name}':`, error);
      throw error;
    }
  }

  /**
   * Loads, registers, and initializes an extension from a file path.
   * Combines the common pattern of load → register → initialize.
   */
  private async loadAndInitializeExtension(filePath: string, project?: Project): Promise<boolean> {
    try {
      const result = await this.loader.loadExtension(filePath);
      if (!result) {
        logger.error(`[Extensions] Failed to load extension from ${filePath}`);
        return false;
      }

      const { extension, metadata } = result;
      this.registry.register(extension, metadata, filePath, project?.baseDir);

      const loaded = this.registry.getExtension(metadata.name);
      if (!loaded) {
        logger.error(`[Extensions] Failed to retrieve registered extension: ${metadata.name}`);
        return false;
      }

      const success = await this.initializeExtension(loaded, project);
      if (!success) {
        return false;
      }

      logger.info(`[Extensions] Loaded and initialized extension: ${metadata.name} v${metadata.version}`);
      return true;
    } catch (error) {
      logger.error(`[Extensions] Failed to load/initialize extension from ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Unified method to load all extensions from a directory.
   * Discovers, loads, initializes, and collects tools/commands for all extensions in the directory.
   * Used for both global initialization and project-specific loading.
   *
   * @param dir - The directory to load extensions from
   * @param project - Optional project instance (for project-specific extensions)
   * @returns Object with loadedCount, initializedCount, and errors
   */
  private async loadExtensionsForDir(dir: string, project?: Project): Promise<void> {
    let initializedCount = 0;

    const extensionPaths = await this.discoverExtensionsFromDir(dir);
    const loadedCount = extensionPaths.length;

    for (const filePath of extensionPaths) {
      try {
        const success = await this.loadAndInitializeExtension(filePath, project);
        if (success) {
          initializedCount++;
        }
      } catch (error) {
        const errorMsg = `Failed to load extension from ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
        logger.error(`[Extensions] ${errorMsg}`);
      }
    }

    if (loadedCount > 0) {
      logger.info(`[Extensions] Loaded ${initializedCount}/${loadedCount} extension(s) from ${dir}`);
    } else {
      logger.debug(`[Extensions] No extensions found in ${dir}`);
    }

    this.debouncedNotifyListeners();
  }

  getExtensions(projectDir?: string): LoadedExtension[] {
    return this.registry.getExtensions(projectDir);
  }

  getExtension(name: string): LoadedExtension | undefined {
    return this.registry.getExtension(name);
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async dispose(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    logger.info('[Extensions] Disposing extension system...');

    await this.stopGlobalWatcher();

    for (const projectDir of this.projectWatchers.keys()) {
      await this.stopProjectWatcher(projectDir);
    }

    const extensions = this.registry.getExtensions();
    for (const loaded of extensions) {
      if (!loaded.initialized || !loaded.instance.onUnload) {
        continue;
      }

      try {
        await loaded.instance.onUnload();
        logger.debug(`[Extensions] Unloaded extension: ${loaded.metadata.name}`);
      } catch (error) {
        logger.error(`[Extensions] Failed to unload extension '${loaded.metadata.name}':`, error);
      }
    }

    this.initialized = false;
    logger.info('[Extensions] Extension system disposed');
  }

  async unloadExtension(filePath: string): Promise<void> {
    const extension = this.findExtensionByPath(filePath);
    if (!extension) {
      return;
    }

    const { instance, metadata, initialized } = extension;

    if (initialized) {
      if (instance.onUnload) {
        try {
          await instance.onUnload();
          logger.debug(`[Extensions] Called onUnload for extension: ${metadata.name}`);
        } catch (error) {
          logger.error(`[Extensions] Failed to unload extension '${metadata.name}':`, error);
        }
      }
    }

    this.registry.unregister(metadata.name);
    logger.info(`[Extensions] Unloaded extension: ${metadata.name}`);
  }

  private findExtensionByPath(filePath: string): LoadedExtension | undefined {
    const extensions = this.registry.getExtensions();
    return extensions.find((ext) => ext.filePath === filePath);
  }

  private async discoverExtensionsFromDir(extensionsDir: string): Promise<string[]> {
    const extensionPaths = await this.scanDirectory(extensionsDir);

    const extensionMap = new Map<string, string>();

    for (const extPath of extensionPaths) {
      const extensionKey = path.relative(extensionsDir, extPath);
      extensionMap.set(extensionKey, extPath);
    }

    const extensions = Array.from(extensionMap.values());
    extensions.sort((a, b) => path.basename(a).localeCompare(path.basename(b)));

    if (extensions.length > 0) {
      logger.info(`[Extensions] Discovered ${extensions.length} extension(s): ${extensions.map((e) => path.basename(e)).join(', ')}`);
    }

    return extensions;
  }

  private async scanDirectory(dir: string): Promise<string[]> {
    const extensions: string[] = [];

    try {
      await fs.access(dir);
    } catch {
      logger.debug(`[Extensions] Directory does not exist: ${dir}`);
      return extensions;
    }

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const indexPathTs = path.join(dir, entry.name, 'index.ts');
          const indexPathJs = path.join(dir, entry.name, 'index.js');

          if (await this.fileExists(indexPathTs)) {
            extensions.push(indexPathTs);
          } else if (await this.fileExists(indexPathJs)) {
            extensions.push(indexPathJs);
          }
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
          extensions.push(path.join(dir, entry.name));
        }
      }
    } catch (error) {
      logger.error(`[Extensions] Failed to scan directory ${dir}:`, error);
    }

    return extensions;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async setupWatcherForDir(dir: string, onChange: () => Promise<void>): Promise<FSWatcher | null> {
    try {
      const dirExists = await fs
        .access(dir)
        .then(() => true)
        .catch(() => false);
      if (!dirExists) {
        await fs.mkdir(dir, { recursive: true });
      }

      const debouncedOnChange = debounce(onChange, 3000);

      const isRelevantFile = (filePath: string): boolean => {
        return ['.ts', '.js', '.tsx', '.jsx'].includes(path.extname(filePath));
      };

      const watcher = watch(dir, {
        persistent: true,
        usePolling: true,
        ignoreInitial: true,
        ignored: (filePath: string) => {
          const basename = path.basename(filePath);
          if (basename.startsWith('.')) {
            return true;
          }
          if (!path.extname(filePath)) {
            return false;
          }
          return !isRelevantFile(filePath);
        },
      });

      watcher
        .on('all', (_eventName, filePath) => {
          logger.info(`[Extensions] File changed: ${filePath}`);
          if (isRelevantFile(filePath)) {
            debouncedOnChange();
          }
        })
        .on('error', (error) => {
          logger.error(`[Extensions] Watcher error for directory ${dir}:`, error);
        });

      return watcher;
    } catch (error) {
      logger.error(`[Extensions] Failed to setup watcher for directory ${dir}:`, error);
      return null;
    }
  }

  private async startHotReloadWatcher(): Promise<void> {
    if (this.globalWatcher) {
      return;
    }

    this.globalWatcher = await this.setupWatcherForDir(AIDER_DESK_GLOBAL_EXTENSIONS_DIR, async () => {
      logger.info('[Extensions] Global extensions changed, reloading...');
      await this.reloadGlobalExtensions();
    });

    if (this.globalWatcher) {
      logger.info('[Extensions] Hot reload enabled for global directory');
    }
  }

  private async reloadGlobalExtensions(): Promise<void> {
    await this.unloadExtensionsForDir(AIDER_DESK_GLOBAL_EXTENSIONS_DIR);
    await this.loadExtensionsForDir(AIDER_DESK_GLOBAL_EXTENSIONS_DIR);
  }

  private async unloadExtensionsForDir(dir: string): Promise<void> {
    const extensions = this.registry.getExtensions();
    const extensionsInDir = extensions.filter((ext) => ext.filePath.startsWith(dir));

    for (const ext of extensionsInDir) {
      await this.unloadExtension(ext.filePath);
    }
  }

  private async stopGlobalWatcher(): Promise<void> {
    if (this.globalWatcher) {
      await this.globalWatcher.close();
      this.globalWatcher = null;
      logger.info('[Extensions] Hot reload disabled');
    }
  }

  async reloadProjectExtensions(project: Project): Promise<void> {
    const projectDir = project.baseDir;
    const projectExtensionsDir = path.join(projectDir, AIDER_DESK_EXTENSIONS_DIR);

    logger.info(`[Extensions] Reloading extensions for project: ${projectDir}`);

    await this.unloadExtensionsForDir(projectExtensionsDir);
    await this.loadExtensionsForDir(projectExtensionsDir, project);

    if (!this.projectWatchers.has(projectDir)) {
      const watcher = await this.setupWatcherForDir(projectExtensionsDir, async () => {
        logger.info(`[Extensions] Project extensions changed for ${projectDir}, reloading...`);
        await this.unloadExtensionsForDir(projectExtensionsDir);
        await this.loadExtensionsForDir(projectExtensionsDir, project);
      });

      if (watcher) {
        this.projectWatchers.set(projectDir, watcher);
        logger.info(`[Extensions] Started watching project extensions: ${projectDir}`);
      }
    }

    logger.info(`[Extensions] Reloaded extensions for project: ${projectDir}`);
  }

  async stopProjectWatcher(projectDir: string): Promise<void> {
    const watcher = this.projectWatchers.get(projectDir);
    if (watcher) {
      await watcher.close();
      this.projectWatchers.delete(projectDir);
      logger.info(`[Extensions] Stopped watching project extensions: ${projectDir}`);
    }
  }

  private static readonly TOOL_NAME_REGEX = /^[a-z][a-z0-9_-]*$/;

  validateToolDefinition(tool: ToolDefinition): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    try {
      if (!tool.name) {
        errors.push('Tool name must be a non-empty string');
      } else if (!ExtensionManager.TOOL_NAME_REGEX.test(tool.name)) {
        errors.push(
          `Tool name '${tool.name}' must start with a lowercase letter and contain only lowercase letters, numbers, hyphens, or underscores (e.g., 'run-linter', 'my---tool', 'tool_name')`,
        );
      }

      if (!tool.description || tool.description.trim() === '') {
        errors.push('Tool description must be a non-empty string');
      }

      if (!tool.inputSchema || !(tool.inputSchema instanceof z.ZodType)) {
        errors.push('Tool inputSchema must be a Zod schema');
      }

      if (!tool.execute || typeof tool.execute !== 'function') {
        errors.push('Tool execute must be a function');
      }
    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  getTools(task: Task, mode: string, profile: AgentProfile): RegisteredTool[] {
    const collectedTools: RegisteredTool[] = [];
    const allExtensions = this.registry.getExtensions(task.getProjectDir());
    const extensions = this.filterEnabledExtensions(allExtensions);

    for (const loaded of extensions) {
      const { instance, metadata } = loaded;

      if (!instance.getTools) {
        continue;
      }

      try {
        const context = new ExtensionContextImpl(metadata.name, this.store, this.modelManager, task.project, task, this.eventManager);
        const tools = instance.getTools(context, mode, profile);

        if (!Array.isArray(tools)) {
          logger.error(`[Extensions] Extension '${metadata.name}' getTools() did not return an array`);
          continue;
        }

        for (const tool of tools) {
          const validation = this.validateToolDefinition(tool);

          if (!validation.isValid) {
            logger.error(`[Extensions] Invalid tool '${tool.name}' from extension '${metadata.name}': ${validation.errors.join(', ')}`);
            continue;
          }

          collectedTools.push({ extensionName: metadata.name, tool });
        }
      } catch (error) {
        logger.error(`[Extensions] Failed to get tools from extension '${metadata.name}':`, error);
      }
    }

    return collectedTools;
  }

  /**
   * Creates a Vercel AI SDK compatible ToolSet from registered extension tools.
   * Each tool is wrapped with validation, error handling, and ExtensionContext creation.
   *
   * @param task - The current Task instance
   * @param mode - The current mode
   * @param profile - The agent profile with tool approval settings
   * @param abortSignal - Optional AbortSignal for cancellation support
   * @returns A ToolSet containing all approved extension tools
   */
  createExtensionToolset(task: Task, mode: string, profile: AgentProfile, abortSignal?: AbortSignal): ToolSet {
    const toolSet: ToolSet = {};
    const registeredTools = this.getTools(task, mode, profile);

    for (const { extensionName, tool } of registeredTools) {
      const toolId = tool.name;
      const context = new ExtensionContextImpl(extensionName, this.store, this.modelManager, task.project, task, this.eventManager);

      // Skip if tool is marked as Never approved
      if (profile.toolApprovals?.[toolId] === ToolApprovalState.Never) {
        logger.debug(`[Extensions] Skipping tool '${tool.name}' (marked as Never approved)`);
        continue;
      }

      toolSet[toolId] = {
        description: tool.description,
        inputSchema: tool.inputSchema,
        execute: async (input: Record<string, unknown>, options: ToolCallOptions) => {
          try {
            return await tool.execute(input, abortSignal || options.abortSignal, context);
          } catch (error) {
            // Error isolation - log and return error message
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger.error(`[Extensions] Tool '${tool.name}' failed in extension '${extensionName}':`, error);
            return `Error: ${errorMsg}`;
          }
        },
      };
    }

    const toolCount = Object.keys(toolSet).length;
    if (toolCount > 0) {
      logger.debug(`[Extensions] Created toolset with ${toolCount} extension tool(s)`);
    }

    return toolSet;
  }

  validateCommandDefinition(command: CommandDefinition): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    try {
      if (!command.name) {
        errors.push('Command name must be a non-empty string');
      } else if (!ExtensionManager.TOOL_NAME_REGEX.test(command.name)) {
        errors.push(
          `Command name '${command.name}' must start with a lowercase letter and contain only lowercase letters, numbers, hyphens, or underscores (e.g., 'generate-tests', 'my---command', 'command_name')`,
        );
      }

      if (!command.description || command.description.trim() === '') {
        errors.push('Command description must be a non-empty string');
      }

      if (!command.execute || typeof command.execute !== 'function') {
        errors.push('Command execute must be a function');
      }

      if (command.arguments && !Array.isArray(command.arguments)) {
        errors.push('Command arguments must be an array');
      }
    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  getCommands(project: Project): RegisteredCommand[] {
    const collectedCommands: RegisteredCommand[] = [];
    const allExtensions = this.registry.getExtensions(project.baseDir);
    const extensions = this.filterEnabledExtensions(allExtensions);

    for (const loaded of extensions) {
      const { instance, metadata } = loaded;

      if (!instance.getCommands) {
        continue;
      }

      try {
        const context = new ExtensionContextImpl(metadata.name, this.store, this.modelManager, project, undefined, this.eventManager);
        const commands = instance.getCommands(context);

        if (!Array.isArray(commands)) {
          logger.error(`[Extensions] Extension '${metadata.name}' getCommands() did not return an array`);
          continue;
        }

        for (const command of commands) {
          const validation = this.validateCommandDefinition(command);

          if (!validation.isValid) {
            logger.error(`[Extensions] Invalid command '${command.name}' from extension '${metadata.name}': ${validation.errors.join(', ')}`);
            continue;
          }

          collectedCommands.push({ extensionName: metadata.name, command });
        }
      } catch (error) {
        logger.error(`[Extensions] Failed to get commands from extension '${metadata.name}':`, error);
      }
    }

    return collectedCommands;
  }

  getAgents(projectDir?: string): RegisteredAgent[] {
    const collectedAgents: RegisteredAgent[] = [];
    const allExtensions = this.registry.getExtensions(projectDir);
    const extensions = this.filterEnabledExtensions(allExtensions);

    for (const loaded of extensions) {
      const { instance, metadata } = loaded;

      if (!instance.getAgents) {
        continue;
      }

      try {
        const context = new ExtensionContextImpl(metadata.name, this.store, this.modelManager, undefined, undefined, this.eventManager);
        const agents = instance.getAgents(context);

        if (!Array.isArray(agents)) {
          logger.error(`[Extensions] Extension '${metadata.name}' getAgents() did not return an array`);
          continue;
        }

        for (const agent of agents) {
          if (!agent.id || !agent.name) {
            logger.error(`[Extensions] Invalid agent from extension '${metadata.name}': missing id or name`);
            continue;
          }

          if (loaded.projectDir && !agent.projectDir) {
            agent.projectDir = loaded.projectDir;
          }

          collectedAgents.push({ extensionName: metadata.name, agent });
        }
      } catch (error) {
        logger.error(`[Extensions] Failed to get agents from extension '${metadata.name}':`, error);
      }
    }

    return collectedAgents;
  }

  getAgentById(agentId: string, projectDir?: string): RegisteredAgent | undefined {
    const agents = this.getAgents(projectDir);
    return agents.find((a) => a.agent.id === agentId);
  }

  getModes(project: Project): RegisteredMode[] {
    const collectedModes: RegisteredMode[] = [];
    const allExtensions = this.registry.getExtensions(project.baseDir);
    const extensions = this.filterEnabledExtensions(allExtensions);

    for (const loaded of extensions) {
      const { instance, metadata } = loaded;

      if (!instance.getModes) {
        continue;
      }

      try {
        const context = new ExtensionContextImpl(metadata.name, this.store, this.modelManager, project, undefined, this.eventManager);
        const modes = instance.getModes(context);

        if (!Array.isArray(modes)) {
          logger.error(`[Extensions] Extension '${metadata.name}' getModes() did not return an array`);
          continue;
        }

        for (const mode of modes) {
          const validation = this.validateModeDefinition(mode);

          if (!validation.isValid) {
            logger.error(`[Extensions] Invalid mode '${mode.name}' from extension '${metadata.name}': ${validation.errors.join(', ')}`);
            continue;
          }

          collectedModes.push({ extensionName: metadata.name, mode });
        }
      } catch (error) {
        logger.error(`[Extensions] Failed to get modes from extension '${metadata.name}':`, error);
      }
    }

    return collectedModes;
  }

  validateModeDefinition(mode: ModeDefinition): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!mode.name || typeof mode.name !== 'string') {
      errors.push('Mode must have a valid name');
    }

    if (!mode.label || typeof mode.label !== 'string') {
      errors.push('Mode must have a valid label');
    }

    if (mode.description !== undefined && typeof mode.description !== 'string') {
      errors.push('Mode description must be a string if provided');
    }

    if (mode.icon !== undefined && typeof mode.icon !== 'string') {
      errors.push('Mode icon must be a string if provided');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  async updateAgentProfile(profile: AgentProfile): Promise<AgentProfile | null> {
    const extensions = this.registry.getExtensions();

    for (const loaded of extensions) {
      const { instance, metadata } = loaded;

      if (!instance.getAgents) {
        continue;
      }

      try {
        const context = new ExtensionContextImpl(metadata.name, this.store, this.modelManager, undefined, undefined, this.eventManager);
        const agents = instance.getAgents(context);

        if (!Array.isArray(agents)) {
          continue;
        }

        const matchingAgent = agents.find((agent) => agent.id === profile.id);
        if (!matchingAgent) {
          continue;
        }

        if (!instance.onAgentProfileUpdated) {
          throw new Error(
            `Extension '${metadata.name}' does not support profile updates. Implement onAgentProfileUpdated() in your extension that provides the agent.`,
          );
        }

        logger.info(`[Extensions] Updating agent profile '${profile.id}' via extension '${metadata.name}'`);
        const updatedProfile = await instance.onAgentProfileUpdated(context, profile.id, profile);

        if (!updatedProfile) {
          throw new Error(`Extension '${metadata.name}' did not return an updated profile`);
        }

        logger.info(`[Extensions] Agent profile '${profile.id}' updated successfully`);
        return updatedProfile;
      } catch (error) {
        logger.error(`[Extensions] Failed to update agent profile from extension '${metadata.name}':`, error);
        throw error;
      }
    }

    return null;
  }

  async executeCommand(commandName: string, args: string[], project: Project, task?: Task): Promise<void> {
    const commands = this.getCommands(project);
    const registered = commands.find((c) => c.command.name === commandName);

    if (!registered) {
      throw new Error(`Extension command '${commandName}' not found`);
    }

    const { extensionName, command } = registered;

    try {
      const context = new ExtensionContextImpl(extensionName, this.store, this.modelManager, project, task, this.eventManager);

      logger.info(`[Extensions] Executing command '${commandName}' from extension '${extensionName}'`);
      await command.execute(args, context);

      logger.debug(`[Extensions] Command '${commandName}' executed successfully`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[Extensions] Command '${commandName}' failed in extension '${extensionName}':`, error);
      throw new Error(`Extension command '${commandName}' failed: ${errorMsg}`);
    }
  }

  /**
   * Fetch available extensions from a repository URL
   * @param repositories - Array of repository URLs
   * @param forceRefresh - Force refresh cache and refetch
   * @returns Array of available extensions with metadata
   */
  async getAvailableExtensions(repositories: string[], forceRefresh = false): Promise<AvailableExtension[]> {
    return this.fetcher.getAvailableExtensions(repositories, forceRefresh);
  }

  /**
   * Install an extension from a repository
   * @param extensionId - Extension identifier
   * @param repositoryUrl - Repository URL where the extension is located
   * @param projectDir - Optional project directory for project-level install
   * @returns true if installation succeeded
   */
  async installExtension(extensionId: string, repositoryUrl: string, projectDir?: string): Promise<boolean> {
    try {
      logger.info(`[Extensions] Installing extension '${extensionId}' from ${repositoryUrl}`);

      const targetDir = projectDir ? path.join(projectDir, AIDER_DESK_EXTENSIONS_DIR) : AIDER_DESK_GLOBAL_EXTENSIONS_DIR;

      await fs.mkdir(targetDir, { recursive: true });

      const availableExtensions = await this.getAvailableExtensions([repositoryUrl]);
      const extension = availableExtensions.find((ext) => ext.id === extensionId);

      if (!extension) {
        throw new Error(`Extension '${extensionId}' not found in repository`);
      }

      const githubRawBase = this.fetcher.getRawUrl(repositoryUrl);
      if (!githubRawBase) {
        throw new Error('Invalid GitHub repository URL');
      }

      if (extension.type === 'single' && extension.file) {
        const url = `${githubRawBase}/${extension.file}`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Failed to download: ${response.statusText}`);
        }

        const code = await response.text();
        const targetPath = path.join(targetDir, extension.file);
        await fs.writeFile(targetPath, code, 'utf-8');

        logger.info(`[Extensions] Installed single-file extension: ${extension.file}`);
      } else if (extension.type === 'folder' && extension.folder) {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ext-install-'));

        try {
          const cloneUrl = this.getCloneUrl(repositoryUrl);
          if (!cloneUrl) {
            throw new Error('Invalid repository URL for cloning');
          }

          logger.debug(`[Extensions] Cloning repository to ${tempDir}`);
          await execWithShellPath(`git clone --depth 1 "${cloneUrl}" "${tempDir}"`);

          const extensionsPath = this.getExtensionsPath(repositoryUrl, tempDir);
          const sourcePath = path.join(extensionsPath, extension.folder);
          const targetPath = path.join(targetDir, extension.folder);

          if (!(await this.fileExists(sourcePath))) {
            throw new Error(`Extension folder not found in repository: ${extension.folder}`);
          }

          await fs.cp(sourcePath, targetPath, { recursive: true });

          if (extension.hasDependencies) {
            logger.info(`[Extensions] Installing dependencies for ${extension.name}...`);
            await this.installDependencies(targetPath);
          }

          logger.info(`[Extensions] Installed folder extension: ${extension.folder}`);
        } finally {
          try {
            await fs.rm(tempDir, { recursive: true, force: true });
          } catch (cleanupError) {
            logger.warn(`[Extensions] Failed to cleanup temp directory ${tempDir}:`, cleanupError);
          }
        }
      }

      await this.loadExtensionsForDir(targetDir);

      logger.info(`[Extensions] Successfully installed ${extension.name}`);
      return true;
    } catch (error) {
      logger.error(`[Extensions] Failed to install extension '${extensionId}':`, error);
      return false;
    }
  }

  /**
   * Install npm dependencies for a folder extension
   */
  private async installDependencies(extensionPath: string): Promise<void> {
    const { spawn } = await import('child_process');

    return new Promise((resolve, reject) => {
      const child = spawn('npm', ['install'], {
        cwd: extensionPath,
        stdio: 'inherit',
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`npm install failed with code ${code}`));
        }
      });

      child.on('error', reject);
    });
  }

  private getCloneUrl(webUrl: string): string | null {
    try {
      const url = new URL(webUrl);
      if (url.hostname !== 'github.com') {
        return null;
      }

      const pathParts = url.pathname.split('/').filter(Boolean);
      if (pathParts.length < 2) {
        return null;
      }

      const owner = pathParts[0];
      const repo = pathParts[1];
      return `https://github.com/${owner}/${repo}.git`;
    } catch {
      return null;
    }
  }

  private getExtensionsPath(repoUrl: string, clonedRepoPath: string): string {
    try {
      const url = new URL(repoUrl);
      const pathParts = url.pathname.split('/').filter(Boolean);

      if (pathParts.length > 4 && pathParts[2] === 'tree') {
        const extensionPath = pathParts.slice(4).join('/');
        return path.join(clonedRepoPath, extensionPath);
      }

      return clonedRepoPath;
    } catch {
      return clonedRepoPath;
    }
  }

  /**
   * Uninstall an extension
   * @param extensionId - Extension identifier (name)
   * @param projectDir - Optional project directory for project-level uninstall
   * @returns true if uninstallation succeeded
   */
  async uninstallExtension(extensionId: string, projectDir?: string): Promise<boolean> {
    try {
      logger.info(`[Extensions] Uninstalling extension '${extensionId}'`);

      const extension = this.registry.getExtension(extensionId);
      if (!extension) {
        throw new Error(`Extension '${extensionId}' not found`);
      }

      if (projectDir && extension.projectDir !== projectDir) {
        throw new Error(`Extension '${extensionId}' does not belong to project ${projectDir}`);
      }

      if (!extension.filePath) {
        throw new Error(`Extension '${extensionId}' has no file path`);
      }

      const parsedPath = path.parse(extension.filePath);
      const isFolderExtension = parsedPath.name === 'index';

      if (isFolderExtension) {
        const folderPath = parsedPath.dir;
        await fs.rm(folderPath, { recursive: true, force: true });
        logger.info(`[Extensions] Removed folder: ${folderPath}`);
      } else {
        await fs.unlink(extension.filePath);
        logger.info(`[Extensions] Removed file: ${extension.filePath}`);
      }

      this.registry.unregister(extensionId);

      logger.info(`[Extensions] Successfully uninstalled ${extensionId}`);
      return true;
    } catch (error) {
      logger.error(`[Extensions] Failed to uninstall extension '${extensionId}':`, error);
      return false;
    }
  }

  /**
   * Dispatches an event to all loaded and initialized extensions.
   * Runs in parallel with HookManager triggers, allowing extensions to respond
   * to the same events as hooks. Events can be modified or blocked by extensions.
   *
   * @param eventName - The name of the event to dispatch
   * @param event - The event payload
   * @param project - The current Project instance
   * @param task - Optional Task instance (not available for all events)
   * @returns The potentially modified event (blocked status is part of the event)
   */
  async dispatchEvent<K extends keyof ExtensionEventMap>(
    eventName: K,
    event: ExtensionEventMap[K],
    project: Project,
    task?: Task,
  ): Promise<ExtensionEventMap[K]> {
    // Get all extensions (global + project-specific)
    const allExtensions = this.registry.getExtensions();
    const enabledExtensions = this.filterEnabledExtensions(allExtensions);

    // Early exit if no extensions
    if (enabledExtensions.length === 0) {
      return event;
    }

    // Sort extensions: global first, then project-specific
    const sortedExtensions = this.sortExtensionsForDispatch(enabledExtensions, project.baseDir);

    let currentEvent = { ...event };

    for (const loaded of sortedExtensions) {
      // Skip uninitialized extensions
      if (!loaded.initialized) {
        continue;
      }

      const { instance, metadata } = loaded;

      // Get the handler method dynamically
      const handler = (instance as Extension)[eventName];

      // Skip if extension doesn't handle this event
      if (typeof handler !== 'function') {
        continue;
      }

      try {
        // Create ExtensionContext for this extension
        const context = new ExtensionContextImpl(metadata.name, this.store, this.modelManager, project, task);

        // Call the extension handler
        // Using type assertion to handle dynamic dispatch across different event types
        const result = await (handler as (event: ExtensionEventMap[K], context: ExtensionContext) => Promise<unknown>).call(instance, currentEvent, context);

        // Process result if extension returned modifications
        if (result && typeof result === 'object') {
          // Merge partial event modifications
          const partialEvent = result as Partial<ExtensionEventMap[K]>;
          currentEvent = { ...currentEvent, ...partialEvent };

          // Check for blocking
          if ('blocked' in currentEvent && currentEvent.blocked === true) {
            logger.info(`[Extensions] Event '${String(eventName)}' blocked by extension '${metadata.name}'`);
            break;
          }
        }
      } catch (error) {
        logger.error(`[Extensions] Error in '${String(eventName)}' handler for extension '${metadata.name}':`, error);
        // Continue to next extension - errors don't stop the chain
      }
    }

    return currentEvent;
  }

  /**
   * Sorts extensions for event dispatch: global extensions first, then project-specific
   * @param extensions - All loaded extensions
   * @param projectDir - Current project directory
   * @returns Sorted array of extensions
   */
  private sortExtensionsForDispatch(extensions: LoadedExtension[], projectDir: string): LoadedExtension[] {
    const global = extensions.filter((e) => !e.projectDir);
    const projectSpecific = extensions.filter((e) => e.projectDir === projectDir);
    return [...global, ...projectSpecific];
  }
}
