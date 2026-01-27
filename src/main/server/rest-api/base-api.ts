import { Request, Response, Router } from 'express';
import { z } from 'zod';

import { Project } from '@/project';

export abstract class BaseApi {
  protected constructor() {}

  /**
   * Finds a project by directory path and validates it exists and is started
   * Returns null if project not found or not started, and sends appropriate error response
   */
  protected findProject(project: Project | undefined, projectDir: string, res: Response): Project | null {
    if (!project) {
      res.status(404).json({
        error: 'Project not found',
        message: `Project directory '${projectDir}' does not exist`,
      });
      return null;
    }

    return project;
  }

  /**
   * Generic request handler wrapper with consistent error handling
   */
  protected handleRequest<T>(handler: (req: Request, res: Response) => Promise<T>) {
    return async (req: Request, res: Response) => {
      try {
        await handler(req, res);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('REST API: Error processing request', {
          error,
          path: req.path,
          method: req.method,
        });
        if (!res.writableEnded) {
          res.status(500).json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    };
  }

  /**
   * Validates request data using a Zod schema and handles invalid requests
   */
  protected validateRequest<T>(schema: z.ZodSchema<T>, data: unknown, res: Response): T | null {
    const result = schema.safeParse(data);
    if (!result.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: result.error.issues,
      });
      return null;
    }
    return result.data;
  }

  /**
   * Abstract method for registering routes - each API module must implement this
   */
  abstract registerRoutes(router: Router): void;
}
