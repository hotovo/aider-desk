import { NextFunction, Request, Response } from 'express';

const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;

export const LONG_RUNNING_API_PATHS = new Set([
  '/api/run-prompt',
  '/api/project/custom-commands',
  '/api/project/init-rules',
  '/api/project/compact-conversation',
  '/api/project/smart-compact-conversation',
  '/api/project/handoff-conversation',
  '/api/project/run-code-change-requests',
  '/api/project/git/resolve-conflicts-with-agent',
  '/api/project/worktree/resolve-conflicts-with-agent',
  '/api/project/git/resolve-error-with-agent',
]);

export const requestTimeoutMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const routePath = req.path.toLowerCase().replace(/\/$/, '');
  if (req.method === 'POST' && LONG_RUNNING_API_PATHS.has(routePath)) {
    res.setTimeout(0);
  } else {
    res.setTimeout(REQUEST_TIMEOUT_MS, () => {
      if (!res.headersSent && !res.writableEnded && !res.destroyed) {
        res.status(504).json({ error: 'Response timeout' });
      }
    });
  }
  next();
};
