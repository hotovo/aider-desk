import { normalizeBaseDir } from '@common/utils';
import { SettingsData, ProjectStartMode } from '@common/types';

import { TelemetryManager } from '@/telemetry';
import { McpManager } from '@/agent';
import { DataManager } from '@/data-manager';
import logger from '@/logger';
import { Project } from '@/project';
import { Store } from '@/store';
import { EventManager } from '@/events';
import { ModelManager } from '@/models';

export class ProjectManager {
  private projects: Project[] = [];

  constructor(
    private readonly store: Store,
    private readonly mcpManager: McpManager,
    private readonly telemetryManager: TelemetryManager,
    private readonly dataManager: DataManager,
    private readonly eventManager: EventManager,
    private readonly modelManager: ModelManager,
  ) {}

  private findProject(baseDir: string): Project | undefined {
    return this.projects.find((project) => normalizeBaseDir(project.baseDir) === normalizeBaseDir(baseDir));
  }

  private createProject(baseDir: string) {
    logger.info('Creating new project', { baseDir });
    const project = new Project(baseDir, this.store, this.mcpManager, this.telemetryManager, this.dataManager, this.eventManager, this.modelManager);
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

  public async startProject(baseDir: string, startupMode?: ProjectStartMode) {
    logger.info('Starting project', { baseDir });
    const project = this.getProject(baseDir);

    await project.start(startupMode);
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
    project.forEachTask((task) => task.restart());
  }

  public async close(): Promise<void> {
    logger.info('Closing all projects');
    await Promise.all(this.projects.map((project) => project.close()));
    this.projects = [];
  }

  settingsChanged(oldSettings: SettingsData, newSettings: SettingsData) {
    this.projects.forEach((project) => {
      project.settingsChanged(oldSettings, newSettings);
    });
  }

  public getCustomCommands(baseDir: string) {
    return this.getProject(baseDir).getCustomCommands();
  }
}
