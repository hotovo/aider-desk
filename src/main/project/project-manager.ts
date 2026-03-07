import { normalizeBaseDir } from '@common/utils';
import { AgentProfile, ProjectSettings, SettingsData, ModeDefinition } from '@common/types';

import { TelemetryManager } from '@/telemetry';
import { AgentProfileManager, McpManager } from '@/agent';
import { DataManager } from '@/data-manager';
import logger from '@/logger';
import { Project } from '@/project';
import { Store } from '@/store';
import { EventManager } from '@/events';
import { ModelManager } from '@/models';
import { WorktreeManager } from '@/worktrees';
import { MemoryManager } from '@/memory/memory-manager';
import { HookManager } from '@/hooks/hook-manager';
import { PromptsManager } from '@/prompts';
import { ExtensionManager } from '@/extensions/extension-manager';

export class ProjectManager {
  public readonly worktreeManager: WorktreeManager;
  private projects: Project[] = [];

  constructor(
    private readonly store: Store,
    private readonly mcpManager: McpManager,
    private readonly telemetryManager: TelemetryManager,
    private readonly dataManager: DataManager,
    private readonly eventManager: EventManager,
    private readonly modelManager: ModelManager,
    worktreeManager: WorktreeManager,
    private readonly agentProfileManager: AgentProfileManager,
    private readonly memoryManager: MemoryManager,
    private readonly hookManager: HookManager,
    private readonly promptsManager: PromptsManager,
    private readonly extensionManager: ExtensionManager,
  ) {
    this.worktreeManager = worktreeManager;
  }

  private findProject(baseDir: string): Project | undefined {
    return this.projects.find((project) => normalizeBaseDir(project.baseDir) === normalizeBaseDir(baseDir));
  }

  private createProject(baseDir: string) {
    logger.info('Creating new project', { baseDir });
    const project = new Project(
      baseDir,
      this.store,
      this.mcpManager,
      this.telemetryManager,
      this.dataManager,
      this.eventManager,
      this.modelManager,
      this.worktreeManager,
      this.agentProfileManager,
      this.memoryManager,
      this.hookManager,
      this.promptsManager,
      this.extensionManager,
    );
    this.projects.push(project);
    return project;
  }

  public getProject(baseDir: string) {
    let project = this.findProject(baseDir);

    if (!project) {
      project = this.createProject(baseDir);
    }

    return project;
  }

  public async startProject(baseDir: string) {
    logger.info('Starting project', { baseDir });
    const project = this.getProject(baseDir);

    await project.start();
  }

  public async closeProject(baseDir: string) {
    const project = this.findProject(baseDir);

    if (!project) {
      logger.warn('No project found to close', { baseDir });
      return;
    }
    logger.info('Closing project', { baseDir });
    await project.close();
  }

  public async restartProject(baseDir: string): Promise<void> {
    logger.info('Restarting project', { baseDir });
    await this.closeProject(baseDir);

    const project = this.getProject(baseDir);
    project.forEachTask((task) => task.reset());
  }

  public async close(): Promise<void> {
    logger.info('Closing all projects');
    await Promise.all(this.projects.map((project) => project.close()));
    this.projects = [];
  }

  async settingsChanged(oldSettings: SettingsData, newSettings: SettingsData) {
    this.projects.forEach((project) => {
      void project.settingsChanged(oldSettings, newSettings);
    });
  }

  modelsUpdated() {
    this.projects.forEach((project) => {
      project.forEachTask((task) => task.modelsUpdated());
    });
  }

  projectSettingsChanged(baseDir: string, oldSettings: ProjectSettings, newSettings: ProjectSettings) {
    const project = this.findProject(baseDir);
    if (!project) {
      return;
    }

    void project.projectSettingsChanged(oldSettings, newSettings);
  }

  public getCommands(baseDir: string) {
    return this.getProject(baseDir).getCustomCommandManager().getAllCommands();
  }

  public getCustomModes(baseDir: string): ModeDefinition[] {
    return this.getProject(baseDir).getCustomModes();
  }

  public getProjects(): Project[] {
    return this.projects;
  }

  agentProfileUpdated(oldProfile: AgentProfile, profile: AgentProfile) {
    this.projects.forEach((project) => {
      project.forEachTask((task) => task.agentProfileUpdated(oldProfile, profile));
    });
  }
}
