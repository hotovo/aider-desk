import { normalizeBaseDir } from '@common/utils';
import { SettingsData, StartupMode } from '@common/types';

import { TelemetryManager } from '@/telemetry';
import { Agent } from '@/agent';
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
    private readonly agent: Agent,
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
    const project = new Project(baseDir, this.store, this.agent, this.telemetryManager, this.dataManager, this.eventManager, this.modelManager);
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

  public startProject(baseDir: string, startupMode?: StartupMode) {
    logger.info('Starting project', { baseDir });
    const project = this.getProject(baseDir);

    void project.start(startupMode);
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

  public async restartProject(baseDir: string, startupMode?: StartupMode): Promise<void> {
    logger.info('Restarting project', { baseDir });
    await this.closeProject(baseDir);
    this.startProject(baseDir, startupMode);
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
