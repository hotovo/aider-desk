import path from 'node:path';

import compression from 'compression';
import express from 'express';

export const serveRendererAssets = (directory: string) => {
  const router = express.Router();
  router.use(compression());
  router.use(
    express.static(directory, {
      setHeaders: (response, file) => {
        const relative = path.relative(directory, file).split(path.sep).join('/');
        response.setHeader('Cache-Control', /^assets\/.+-[\w-]{8,}\.[\w]+$/.test(relative) ? 'private, max-age=31536000, immutable' : 'no-cache');
      },
    }),
  );
  return router;
};
