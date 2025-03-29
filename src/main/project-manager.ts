import { normalizeBaseDir } from '@common/utils';
import { BrowserWindow } from 'electron';
import { McpAgent } from 'src/main/mcp-agent';

import logger from './logger';
import { Project } from './project';
import { Store } from './store';

export class ProjectManager {
  private projects: Project[] = [];

  constructor(
    private readonly mainWindow: BrowserWindow,
    private readonly store: Store,
    private readonly mcpAgent: McpAgent,
  ) {
    this.mainWindow = mainWindow;
    this.store = store;
    this.mcpAgent = mcpAgent;
  }

  private findProject(baseDir: string): Project | undefined {
    baseDir = normalizeBaseDir(baseDir);
    return this.projects.find((project) => normalizeBaseDir(project.baseDir) === baseDir);
  }

  public getProject(baseDir: string): Project {
    let project = this.findProject(baseDir);

    if (!project) {
      logger.info('Creating new project', { baseDir });
      project = new Project(this.mainWindow, baseDir, this.store, this.mcpAgent!);
      this.projects.push(project);
    }

    return project;
  }

  public startProject(baseDir: string): void {
    logger.info('Starting project', { baseDir });
    const project = this.getProject(baseDir);

    project.start();
  }

  public async stopProject(baseDir: string) {
    const project = this.findProject(baseDir);

    if (!project) {
      logger.warn('No project found to stop', { baseDir });
      return;
    }
    logger.info('Stopping project', { baseDir });
    await project.stop();
  }

  public async restartProject(baseDir: string): Promise<void> {
    await this.stopProject(baseDir);
    this.startProject(baseDir);
  }

  public async close(): Promise<void> {
    logger.info('Stopping all projects');
    await Promise.all(this.projects.map((project) => project.stop()));
    this.projects = [];
  }
}
