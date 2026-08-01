import path from 'path';

import { BrowserBootstrap } from '@common/types';
import { Request, Response, Router } from 'express';
import { z } from 'zod';

import { BaseApi } from '@/server/rest-api/base-api';
import { isReadonlyExtensionUiEnabled } from '@/server/readonly';
import { ProjectManager } from '@/project';
import { EventsHandler } from '@/events-handler';
import { Store } from '@/store';
import { READONLY_MODE } from '@/constants';

const ProjectQuerySchema = z.object({
  projectDir: z.string().min(1),
});

const TaskQuerySchema = ProjectQuerySchema.extend({
  taskId: z.string().min(1).optional(),
});

const ComponentsQuerySchema = TaskQuerySchema.extend({
  placement: z.string().min(1),
});

const ComponentQuerySchema = TaskQuerySchema.extend({
  extensionId: z.string().min(1),
  componentId: z.string().min(1),
});

const LibraryQuerySchema = TaskQuerySchema.extend({
  spec: z.string().min(1),
});

const ActionSchema = ComponentQuerySchema.extend({
  action: z.string().min(1),
  args: z.array(z.unknown()).default([]),
});

export class ReadonlyApi extends BaseApi {
  constructor(
    private readonly projectManager: ProjectManager,
    private readonly eventsHandler: EventsHandler,
    private readonly store: Store,
    private readonly isReady: () => boolean,
  ) {
    super();
  }

  private get isReadonlyMode(): boolean {
    return READONLY_MODE || this.store.getSettings().server.readonly === true;
  }

  private resolveProject(projectDir: string, res: Response) {
    const project = this.projectManager.getOpenProject(projectDir);
    if (!project || project.baseDir !== projectDir) {
      res.status(404).json({ error: 'Project not found' });
      return null;
    }
    return project;
  }

  private validateTask(projectDir: string, taskId: string | undefined, res: Response): boolean {
    if (!taskId) {
      return true;
    }
    const project = this.resolveProject(projectDir, res);
    if (!project) {
      return false;
    }
    if (!project.getTask(taskId)) {
      res.status(404).json({ error: 'Task not found' });
      return false;
    }
    return true;
  }

  private findComponent(projectDir: string, extensionId: string, componentId: string, taskId: string | undefined) {
    return this.eventsHandler
      .getUIComponents(undefined, projectDir, taskId)
      .find((component) => component.extensionId === extensionId && component.componentId === componentId);
  }

  registerRoutes(router: Router): void {
    router.use('/extensions', (_req, res, next) => {
      if (isReadonlyExtensionUiEnabled(this.store)) {
        next();
        return;
      }
      res.status(403).json({
        error: 'Extension UI is disabled in readonly mode.',
        code: 'EXTENSION_UI_DISABLED',
      });
    });

    router.get(
      '/bootstrap',
      this.handleRequest(async (_req: Request, res: Response) => {
        if (!this.isReadonlyMode) {
          const bootstrap: BrowserBootstrap = { mode: 'standard' };
          res.status(200).json(bootstrap);
          return;
        }
        if (!this.isReady()) {
          res.status(503).json({ error: 'Readonly projects are still starting' });
          return;
        }

        const settings = this.store.getSettings();
        const projects = this.store.getOpenProjects().map((project) => ({
          baseDir: project.baseDir,
          name: path.basename(project.baseDir),
          active: project.active,
        }));
        const bootstrap: BrowserBootstrap = {
          mode: 'readonly',
          projects,
          display: {
            language: settings.language,
            theme: settings.theme ?? 'dark',
            font: settings.font ?? 'Sono',
            fontSize: settings.fontSize ?? 16,
            renderMarkdown: settings.renderMarkdown,
            fullMessageRendering: settings.fullMessageRendering,
            messageViewMode: settings.messageViewMode,
            enableExtensionUi: isReadonlyExtensionUiEnabled(this.store),
          },
        };
        res.status(200).json(bootstrap);
      }),
    );

    router.get(
      '/tasks',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(ProjectQuerySchema, req.query, res);
        if (!parsed) {
          return;
        }
        const project = this.resolveProject(parsed.projectDir, res);
        if (!project) {
          return;
        }
        res.status(200).json(await project.getTasks());
      }),
    );

    router.get(
      '/tasks/:taskId',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(ProjectQuerySchema.extend({ taskId: z.string().min(1) }), { ...req.query, taskId: req.params.taskId }, res);
        if (!parsed) {
          return;
        }
        const project = this.resolveProject(parsed.projectDir, res);
        if (!project) {
          return;
        }
        const task = project.getTask(parsed.taskId);
        if (!task) {
          res.status(404).json({ error: 'Task not found' });
          return;
        }
        res.status(200).json(await task.load(READONLY_MODE));
      }),
    );

    router.get(
      '/extensions/ui-components',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(ComponentsQuerySchema, req.query, res);
        if (!parsed || !this.resolveProject(parsed.projectDir, res) || !this.validateTask(parsed.projectDir, parsed.taskId, res)) {
          return;
        }
        res.status(200).json(this.eventsHandler.getUIComponents(parsed.placement, parsed.projectDir, parsed.taskId));
      }),
    );

    router.get(
      '/extensions/ui-data',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(ComponentQuerySchema, req.query, res);
        if (!parsed || !this.resolveProject(parsed.projectDir, res) || !this.validateTask(parsed.projectDir, parsed.taskId, res)) {
          return;
        }
        if (!this.findComponent(parsed.projectDir, parsed.extensionId, parsed.componentId, parsed.taskId)) {
          res.status(404).json({ error: 'Extension component not found' });
          return;
        }
        res.status(200).json(await this.eventsHandler.getUIExtensionData(parsed.extensionId, parsed.componentId, parsed.projectDir, parsed.taskId));
      }),
    );

    router.get(
      '/extensions/library',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(LibraryQuerySchema, req.query, res);
        if (!parsed || !this.resolveProject(parsed.projectDir, res) || !this.validateTask(parsed.projectDir, parsed.taskId, res)) {
          return;
        }
        const declared = this.eventsHandler
          .getUIComponents(undefined, parsed.projectDir, parsed.taskId)
          .some((component) => Object.values(component.libraries ?? {}).includes(parsed.spec));
        if (!declared) {
          res.status(404).json({ error: 'Extension library not found' });
          return;
        }
        res
          .status(200)
          .type('application/javascript')
          .send(await this.eventsHandler.loadExtensionLibrary(parsed.spec));
      }),
    );

    router.post(
      '/extensions/ui-action',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(ActionSchema, req.body, res);
        if (!parsed || !this.resolveProject(parsed.projectDir, res) || !this.validateTask(parsed.projectDir, parsed.taskId, res)) {
          return;
        }
        if (!this.findComponent(parsed.projectDir, parsed.extensionId, parsed.componentId, parsed.taskId)) {
          res.status(404).json({ error: 'Extension component not found' });
          return;
        }
        const result = await this.eventsHandler.executeUIExtensionAction(
          parsed.extensionId,
          parsed.componentId,
          parsed.action,
          parsed.args,
          parsed.projectDir,
          parsed.taskId,
        );
        res.status(200).json(result);
      }),
    );
  }
}
