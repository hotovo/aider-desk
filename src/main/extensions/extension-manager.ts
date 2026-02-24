import fs from 'fs/promises';
import path from 'path';

import { FSWatcher, watch } from 'chokidar';
import debounce from 'lodash/debounce';
import { z } from 'zod';
import { ToolApprovalState } from '@common/types';

import { ExtensionLoader } from './extension-loader';
import { ExtensionRegistry, LoadedExtension, RegisteredTool, RegisteredCommand } from './extension-registry';
import { ExtensionContextImpl } from './extension-context';

import type { AgentProfile } from '@common/types';
import type { Store } from '@/store';
import type { AgentProfileManager } from '@/agent';
import type { ModelManager } from '@/models';
import type {
  AgentFinishedEvent,
  AgentStartedEvent,
  AgentStepFinishedEvent,
  AiderPromptFinishedEvent,
  AiderPromptStartedEvent,
  CommandExecutedEvent,
  CustomCommandExecutedEvent,
  Extension,
  ExtensionContext,
  FilesAddedEvent,
  FilesDroppedEvent,
  HandleApprovalEvent,
  PromptFinishedEvent,
  PromptStartedEvent,
  QuestionAnsweredEvent,
  QuestionAskedEvent,
  ResponseChunkEvent,
  ResponseCompletedEvent,
  SubagentFinishedEvent,
  SubagentStartedEvent,
  TaskClosedEvent,
  TaskCreatedEvent,
  TaskInitializedEvent,
  TaskPreparedEvent,
  ToolApprovalEvent,
  ToolCalledEvent,
  ToolDefinition,
  ToolFinishedEvent,
  CommandDefinition,
} from '@common/extensions';
import type { ToolCallOptions, ToolSet } from 'ai';
import type { ProjectManager } from '@/project/project-manager';

import logger from '@/logger';
import { AIDER_DESK_EXTENSIONS_DIR, AIDER_DESK_GLOBAL_EXTENSIONS_DIR } from '@/constants';
import { Project } from '@/project';
import { Task } from '@/task';

export interface ExtensionManagerDeps {
  store: Store;
  agentProfileManager: AgentProfileManager;
  modelManager: ModelManager;
  projectManager: ProjectManager;
}

/**
 * Mapping of extension event names to their event payload types
 */
export type ExtensionEventMap = {
  onTaskCreated: TaskCreatedEvent;
  onTaskPrepared: TaskPreparedEvent;
  onTaskInitialized: TaskInitializedEvent;
  onTaskClosed: TaskClosedEvent;
  onPromptStarted: PromptStartedEvent;
  onPromptFinished: PromptFinishedEvent;
  onAgentStarted: AgentStartedEvent;
  onAgentFinished: AgentFinishedEvent;
  onAgentStepFinished: AgentStepFinishedEvent;
  onAiderPromptStarted: AiderPromptStartedEvent;
  onAiderPromptFinished: AiderPromptFinishedEvent;
  onToolApproval: ToolApprovalEvent;
  onToolCalled: ToolCalledEvent;
  onToolFinished: ToolFinishedEvent;
  onFilesAdded: FilesAddedEvent;
  onFilesDropped: FilesDroppedEvent;
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
  private registry: ExtensionRegistry;
  private globalWatcher: FSWatcher | null = null;
  private projectWatchers: Map<string, FSWatcher> = new Map();
  private initialized = false;

  constructor(
    private readonly store: Store,
    private readonly agentProfileManager: AgentProfileManager,
    private readonly modelManager: ModelManager,
    private readonly projectManager: ProjectManager,
  ) {
    this.loader = new ExtensionLoader();
    this.registry = new ExtensionRegistry();
    this.store = store;
    this.agentProfileManager = agentProfileManager;
    this.modelManager = modelManager;
    this.projectManager = projectManager;
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
      const context = new ExtensionContextImpl(metadata.name, this.store, this.agentProfileManager, this.modelManager, project);
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

    this.registry.clearTools();
    this.registry.clearCommands();
    this.collectTools();
    this.collectCommands();

    if (project) {
      project.sendCommandsUpdated();
    } else {
      // Global extensions loaded - notify all projects
      this.sendCommandsUpdatedToAllProjects();
    }

    if (loadedCount > 0) {
      logger.info(`[Extensions] Loaded ${initializedCount}/${loadedCount} extension(s) from ${dir}`);
    } else {
      logger.debug(`[Extensions] No extensions found in ${dir}`);
    }
  }

  getExtensions(): LoadedExtension[] {
    return this.registry.getExtensions();
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

  async reloadExtension(filePath: string, project?: Project): Promise<boolean> {
    const extensionName = this.getExtensionNameFromPath(filePath);
    logger.info(`[Extensions] Hot reloading: ${extensionName}`);

    try {
      await this.unloadExtension(filePath);

      const success = await this.loadAndInitializeExtension(filePath, project);
      if (!success) {
        return false;
      }

      this.registry.clearTools();
      this.registry.clearCommands();
      this.collectTools();
      this.collectCommands();

      // Notify frontend about updated commands
      if (project) {
        project.sendCommandsUpdated();
      } else {
        // Global extension reloaded - notify all projects
        this.sendCommandsUpdatedToAllProjects();
      }

      logger.info(`[Extensions] Hot reload complete: ${extensionName}`);
      return true;
    } catch (error) {
      logger.error(`[Extensions] Hot reload failed for ${extensionName}:`, error);
      return false;
    }
  }

  private findExtensionByPath(filePath: string): LoadedExtension | undefined {
    const extensions = this.registry.getExtensions();
    return extensions.find((ext) => ext.filePath === filePath);
  }

  private getExtensionNameFromPath(filePath: string): string {
    const filename = path.basename(filePath, '.ts');
    return filename;
  }

  private async discoverExtensionsFromDir(extensionsDir: string): Promise<string[]> {
    const extensionPaths = await this.scanDirectory(extensionsDir);

    const extensionMap = new Map<string, string>();

    for (const extPath of extensionPaths) {
      const filename = path.basename(extPath);
      extensionMap.set(filename, extPath);
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

      const debouncedOnChange = debounce(onChange, 1000);

      const watcher = watch(dir, {
        persistent: true,
        usePolling: true,
        ignoreInitial: true,
      });

      watcher
        .on('add', debouncedOnChange)
        .on('change', debouncedOnChange)
        .on('unlink', debouncedOnChange)
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
        project.sendCommandsUpdated();
      });

      if (watcher) {
        this.projectWatchers.set(projectDir, watcher);
        logger.info(`[Extensions] Started watching project extensions: ${projectDir}`);
      }
    }

    project.sendCommandsUpdated();

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

  private static readonly KEBAB_CASE_REGEX = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

  validateToolDefinition(tool: ToolDefinition): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      if (!tool.name) {
        errors.push('Tool name must be a non-empty string');
      } else if (!ExtensionManager.KEBAB_CASE_REGEX.test(tool.name)) {
        errors.push(`Tool name '${tool.name}' must be kebab-case (e.g., 'run-linter', 'my-custom-tool')`);
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

  collectTools(): RegisteredTool[] {
    const collectedTools: RegisteredTool[] = [];
    const extensions = this.registry.getExtensions();

    logger.info(`[Extensions] Collecting tools from ${extensions.length} extension(s)`);
    for (const loaded of extensions) {
      const { instance, metadata } = loaded;

      if (!instance.getTools) {
        logger.debug(`[Extensions] Extension '${metadata.name}' has no getTools method`);
        continue;
      }

      try {
        const context = new ExtensionContextImpl(metadata.name, this.store, this.agentProfileManager, this.modelManager);
        const tools = instance.getTools(context);

        if (!Array.isArray(tools)) {
          logger.error(`[Extensions] Extension '${metadata.name}' getTools() did not return an array`);
          continue;
        }

        if (tools.length === 0) {
          logger.debug(`[Extensions] Extension '${metadata.name}' returned empty tools array`);
          continue;
        }

        for (const tool of tools) {
          const validation = this.validateToolDefinition(tool);

          if (!validation.isValid) {
            logger.error(`[Extensions] Invalid tool '${tool.name}' from extension '${metadata.name}': ${validation.errors.join(', ')}`);
            continue;
          }

          this.registry.registerTool(metadata.name, tool);
          collectedTools.push({ extensionName: metadata.name, tool });
          logger.debug(`[Extensions] Collected tool '${tool.name}' from extension '${metadata.name}'`);
        }
      } catch (error) {
        logger.error(`[Extensions] Failed to collect tools from extension '${metadata.name}':`, error);
      }
    }

    const toolCount = collectedTools.length;
    if (toolCount > 0) {
      logger.info(`[Extensions] Collected ${toolCount} tool(s) from extensions`);
    }

    return collectedTools;
  }

  getTools(): RegisteredTool[] {
    return this.registry.getTools();
  }

  getToolsByExtension(extensionName: string): RegisteredTool[] {
    return this.registry.getToolsByExtension(extensionName);
  }

  /**
   * Creates a Vercel AI SDK compatible ToolSet from registered extension tools.
   * Each tool is wrapped with validation, error handling, and ExtensionContext creation.
   *
   * @param task - The current Task instance
   * @param profile - The agent profile with tool approval settings
   * @param abortSignal - Optional AbortSignal for cancellation support
   * @returns A ToolSet containing all approved extension tools
   */
  createExtensionToolset(task: Task, profile: AgentProfile, abortSignal?: AbortSignal): ToolSet {
    const toolSet: ToolSet = {};
    const registeredTools = this.registry.getTools();

    for (const { extensionName, tool } of registeredTools) {
      const toolId = `${extensionName}-${tool.name}`;
      const context = new ExtensionContextImpl(extensionName, this.store, this.agentProfileManager, this.modelManager, task.project, task);

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

  validateCommandDefinition(command: CommandDefinition): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      if (!command.name) {
        errors.push('Command name must be a non-empty string');
      } else if (!ExtensionManager.KEBAB_CASE_REGEX.test(command.name)) {
        errors.push(`Command name '${command.name}' must be kebab-case (e.g., 'generate-tests', 'my-command')`);
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

  collectCommands(): RegisteredCommand[] {
    const collectedCommands: RegisteredCommand[] = [];
    const extensions = this.registry.getExtensions();

    logger.info(`[Extensions] Collecting commands from ${extensions.length} extension(s)`);
    for (const loaded of extensions) {
      const { instance, metadata } = loaded;

      if (!instance.getCommands) {
        logger.info(`[Extensions] Extension '${metadata.name}' has no getCommands method`);
        continue;
      }

      try {
        const context = new ExtensionContextImpl(metadata.name, this.store, this.agentProfileManager, this.modelManager);
        const commands = instance.getCommands(context);

        if (!Array.isArray(commands)) {
          logger.error(`[Extensions] Extension '${metadata.name}' getCommands() did not return an array`);
          continue;
        }

        if (commands.length === 0) {
          logger.debug(`[Extensions] Extension '${metadata.name}' returned empty commands array`);
          continue;
        }

        for (const command of commands) {
          const validation = this.validateCommandDefinition(command);

          if (!validation.isValid) {
            logger.error(`[Extensions] Invalid command '${command.name}' from extension '${metadata.name}': ${validation.errors.join(', ')}`);
            continue;
          }

          this.registry.registerCommand(metadata.name, command);
          collectedCommands.push({ extensionName: metadata.name, command });
          logger.debug(`[Extensions] Collected command '${command.name}' from extension '${metadata.name}'`);
        }
      } catch (error) {
        logger.error(`[Extensions] Failed to collect commands from extension '${metadata.name}':`, error);
      }
    }

    const commandCount = collectedCommands.length;
    if (commandCount > 0) {
      logger.info(`[Extensions] Collected ${commandCount} command(s) from extensions`);
    }

    return collectedCommands;
  }

  getCommands(): RegisteredCommand[] {
    return this.registry.getCommands();
  }

  getCommandsByExtension(extensionName: string): RegisteredCommand[] {
    return this.registry.getCommandsByExtension(extensionName);
  }

  async executeCommand(commandName: string, args: string[], project: Project, task?: Task): Promise<void> {
    const registered = this.registry.getCommandByName(commandName);

    if (!registered) {
      throw new Error(`Extension command '${commandName}' not found`);
    }

    const { extensionName, command } = registered;

    try {
      const context = new ExtensionContextImpl(extensionName, this.store, this.agentProfileManager, this.modelManager, project, task);

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

    // Early exit if no extensions
    if (allExtensions.length === 0) {
      return event;
    }

    // Sort extensions: global first, then project-specific
    const sortedExtensions = this.sortExtensionsForDispatch(allExtensions, project.baseDir);

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
        const context = new ExtensionContextImpl(metadata.name, this.store, this.agentProfileManager, this.modelManager, project, task);

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

  /**
   * Sends commands updated notification to all projects.
   * Used when global extensions are loaded/reloaded without a specific project context.
   */
  private sendCommandsUpdatedToAllProjects(): void {
    const projects = this.projectManager.getProjects();

    if (projects.length === 0) {
      logger.debug('[Extensions] No active projects to notify about command updates');
      return;
    }

    logger.debug(`[Extensions] Notifying ${projects.length} project(s) about command updates`);

    for (const project of projects) {
      try {
        project.sendCommandsUpdated();
      } catch (error) {
        logger.error(`[Extensions] Failed to send commands updated to project ${project.baseDir}:`, error);
      }
    }
  }
}
