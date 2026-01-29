import * as path from 'path';
import { mkdir, access, chmod } from 'fs/promises';

import { glob } from 'glob';

import { getPlatformDir } from './utils/environment';

import logger from '@/logger';
import { withLock } from '@/utils/mutex';

/**
 * Express request interface for renderer middleware
 */
interface RendererRequest {
  method: string;
  path: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Express response interface for renderer middleware
 */
interface RendererResponse {
  set: (key: string, value: string) => unknown;
  setHeader: (key: string, value: string | number) => unknown;
  statusCode: number;
  end: () => unknown;
  send: (data: string) => unknown;
}

// Build directory - set during build via Bun.build() define
// This is a temp directory used during build to work around Bun's CWD bug
const BUILD_DIR = typeof __BUN_BUILD_DIR__ !== 'undefined' ? __BUN_BUILD_DIR__ : process.cwd();

// Mutex resource name for CWD operations
const CWD_MUTEX_RESOURCE = 'bun-cwd';

// Cache for renderer files loaded on-demand
const rendererCache = new Map<string, { content: string; contentType: string; etag: string }>();

/**
 * Discover all resources that need to be extracted for Bun binary.
 * This dynamically scans the resources directory to avoid hardcoded lists.
 *
 * @returns Array of resource paths relative to resources directory
 */
const discoverResourcesForExtraction = async (): Promise<string[]> => {
  const resourcesDir = path.join(BUILD_DIR, 'resources');
  const resources: string[] = [];

  try {
    // Discover text resources (non-binary files)
    const textPatterns = ['connector/**/*', 'prompts/**/*.hbs', 'icon.png'];

    for (const pattern of textPatterns) {
      const files = await glob(pattern, {
        cwd: resourcesDir,
        nodir: true,
        dot: true,
      });
      resources.push(...files);
    }

    // Discover platform-specific binaries
    const platformDir = getPlatformDir();
    const binaryPatterns = [`${platformDir}/uv`, `${platformDir}/probe`];

    for (const pattern of binaryPatterns) {
      const fullPath = path.join(resourcesDir, pattern);
      try {
        await access(fullPath);
        resources.push(pattern);
      } catch {
        // File doesn't exist, skip
      }
    }

    // Add Windows binaries if on Windows
    if (process.platform === 'win32') {
      const winPatterns = ['win/uv.exe', 'win/probe.exe'];
      for (const pattern of winPatterns) {
        const fullPath = path.join(resourcesDir, pattern);
        try {
          await access(fullPath);
          resources.push(pattern);
        } catch {
          // File doesn't exist, skip
        }
      }
    }

    logger.debug('[Bun I/O] Discovered resources', {
      count: resources.length,
      resources,
    });
  } catch (error) {
    logger.warn('[Bun I/O] Failed to discover resources dynamically', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Fallback to minimal required resources if glob fails
    return getFallbackResources();
  }

  return resources;
};

/**
 * Get fallback resource list if dynamic discovery fails.
 * This ensures critical resources are always available.
 */
const getFallbackResources = (): string[] => {
  const platformDir = getPlatformDir();
  const resources = [
    'connector/connector.py',
    'icon.png',
    'prompts/commit-message.hbs',
    'prompts/compact-conversation.hbs',
    'prompts/conflict-resolution-system.hbs',
    'prompts/conflict-resolution.hbs',
    'prompts/init-project.hbs',
    'prompts/task-name.hbs',
    'prompts/update-task-state.hbs',
    'prompts/workflow.hbs',
    'prompts/handoff.hbs',
    'prompts/system-prompt.hbs',
    `${platformDir}/uv`,
    `${platformDir}/probe`,
  ];

  if (process.platform === 'win32') {
    resources.push('win/uv.exe', 'win/probe.exe');
  }

  return resources;
};

/**
 * Check if we're running in Bun runtime
 */
export const isBunRuntime = (): boolean => {
  return typeof Bun !== 'undefined';
};

/**
 * Check if we're running as a compiled Bun binary
 */
export const isBunBinary = (): boolean => {
  return isBunRuntime() && process.execPath.endsWith('bun') === false;
};

/**
 * Execute a function with the CWD workaround and mutex protection.
 * This ensures thread-safe access to Bun's CWD-dependent operations.
 */
const withCwdWorkaround = async <T>(fn: () => Promise<T> | T): Promise<T> => {
  return withLock(CWD_MUTEX_RESOURCE, async () => {
    const originalCwd = process.cwd();
    let needsRestore = false;

    try {
      if (isBunBinary() && originalCwd !== BUILD_DIR) {
        await mkdir(BUILD_DIR, { recursive: true });
        process.chdir(BUILD_DIR);
        needsRestore = true;
        logger.debug('[Bun I/O] Changed CWD to BUILD_DIR', { from: originalCwd, to: BUILD_DIR });
      }

      return await fn();
    } finally {
      if (needsRestore) {
        process.chdir(originalCwd);
        logger.debug('[Bun I/O] Restored CWD', { from: BUILD_DIR, to: originalCwd });
      }
    }
  });
};

/**
 * Read an embedded resource file using Bun's async I/O with mutex protection.
 * This works for both source files and compiled binaries.
 */
export const readResource = async (resourcePath: string): Promise<string | null> => {
  // In compiled Bun binary with extracted resources, read from temp directory
  if (isBunBinary() && process.env.AIDER_DESK_RESOURCES_DIR) {
    const tempPath = path.join(process.env.AIDER_DESK_RESOURCES_DIR, resourcePath);
    try {
      return await Bun.file(tempPath).text();
    } catch (error) {
      logger.debug('[Bun I/O] Failed to read resource from temp dir', { tempPath, error });
      return null;
    }
  }

  // Fallback: read using Bun.file() with CWD workaround and mutex protection
  return withCwdWorkaround(async () => {
    try {
      // resourcePath is like "connector/connector.py", embedded as "resources/connector/connector.py"
      const fullPath = `./resources/${resourcePath}`;
      return await Bun.file(fullPath).text();
    } catch (error) {
      logger.debug('[Bun I/O] Failed to read resource', { resourcePath, error });
      return null;
    }
  });
};

/**
 * Read a binary resource file as Buffer.
 * Uses Bun.file() for async I/O to read embedded binary files.
 */
export const readBinaryResource = async (resourcePath: string): Promise<Buffer | null> => {
  return withCwdWorkaround(async () => {
    try {
      // resourcePath is like "linux-x64/uv", embedded as "resources/linux-x64/uv"
      const fullPath = `./resources/${resourcePath}`;
      const file = Bun.file(fullPath);
      const buffer = await file.arrayBuffer();
      return Buffer.from(buffer);
    } catch (error) {
      logger.debug('[Bun I/O] Failed to read binary resource', { resourcePath, error });
      return null;
    }
  });
};

/**
 * Extract embedded resources from Bun binary to temp directory.
 * This is called during startup when running as a compiled Bun binary.
 * Uses mutex protection to ensure thread-safe extraction.
 */
export const extractEmbeddedResources = async (): Promise<void> => {
  if (!isBunBinary()) {
    return;
  }

  const tempDir = path.join(process.env.TMPDIR || '/tmp', 'aider-desk-resources');
  const markerFile = path.join(tempDir, '.extracted');

  logger.debug('[Bun I/O] Extract resources', { tempDir, BUILD_DIR });

  // Determine platform directory
  const platformDir = getPlatformDir();

  // Check if extraction is complete by checking for both binary and text resources
  const uvPath = path.join(tempDir, platformDir, 'uv');
  const connectorPath = path.join(tempDir, 'connector/connector.py');
  try {
    await access(markerFile);
    await access(uvPath);
    await access(connectorPath);
    logger.debug('[Bun I/O] Resources already extracted');
    return;
  } catch {
    // One or more files don't exist, proceed with extraction
  }

  // Discover resources dynamically using glob
  const resources = await discoverResourcesForExtraction();

  // Note: Renderer files are NOT extracted in Bun mode
  // They are served directly from embedded resources via createRendererMiddleware()

  // Extract each resource with mutex protection
  for (const resourcePath of resources) {
    const targetPath = path.join(tempDir, resourcePath);
    const isBinary = resourcePath.endsWith('uv') || resourcePath.endsWith('probe') || resourcePath.endsWith('.exe');

    try {
      if (isBinary) {
        const buffer = await readBinaryResource(resourcePath);
        if (buffer) {
          await mkdir(path.dirname(targetPath), { recursive: true });
          await Bun.write(targetPath, buffer);
          await chmod(targetPath, 0o755);
          logger.debug('[Bun I/O] Extracted binary resource', { resourcePath });
        }
      } else {
        // Read as text using Bun.file() with CWD workaround and mutex protection
        const content = await readResource(resourcePath);
        if (content) {
          await mkdir(path.dirname(targetPath), { recursive: true });
          await Bun.write(targetPath, content);
          logger.debug('[Bun I/O] Extracted text resource', { resourcePath });
        }
      }
    } catch (error) {
      logger.warn('[Bun I/O] Could not extract resource', { resourcePath, error });
    }
  }

  // Create marker file
  await mkdir(tempDir, { recursive: true });
  await Bun.write(markerFile, Date.now().toString());

  // Set environment variable so getResourceDir knows where to look
  process.env.AIDER_DESK_RESOURCES_DIR = tempDir;
  logger.info('[Bun I/O] Resource extraction complete', { tempDir });
};

/**
 * Generate ETag for content
 */
const generateETag = (content: string): string => {
  const hash = Buffer.from(content).toString('base64');
  return `"${hash.slice(0, 27)}"`;
};

/**
 * Get content type based on file extension
 */
const getContentType = (filePath: string): string => {
  const ext = path.basename(filePath).split('.').pop()?.toLowerCase() || '';
  const contentTypes: Record<string, string> = {
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    eot: 'application/vnd.ms-fontobject',
  };
  return contentTypes[ext] || 'application/octet-stream';
};

/**
 * Serve a specific renderer file from embedded resources with mutex protection.
 */
const serveRendererFile = async (
  req: RendererRequest,
  res: RendererResponse,
  filePath: string,
  options: {
    setHeaders?: (res: RendererResponse, path: string) => void;
  } = {},
): Promise<void> => {
  const { setHeaders } = options;
  const cacheKey = `/out/renderer/${filePath}`;

  logger.debug('[Bun Renderer] Serving file', {
    filePath,
    cacheKey,
    method: req.method,
    url: req.url,
    path: req.path,
  });

  // Check cache first
  if (rendererCache.has(cacheKey)) {
    logger.debug('[Bun Renderer] Cache HIT', { cacheKey });
    const cached = rendererCache.get(cacheKey)!;
    res.set('Content-Type', cached.contentType);
    res.set('ETag', cached.etag);

    if (setHeaders) {
      setHeaders(res, cacheKey);
    }

    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch && ifNoneMatch === cached.etag) {
      logger.debug('[Bun Renderer] 304 Not Modified (ETag match)');
      res.statusCode = 304;
      void res.end();
      return;
    }

    if (req.method === 'HEAD') {
      res.setHeader('Content-Length', Buffer.byteLength(cached.content));
      void res.end();
      return;
    }

    logger.debug('[Bun Renderer] Sending cached content', { cacheKey, size: cached.content.length });
    void res.send(cached.content);
    return;
  }

  logger.debug('[Bun Renderer] Cache MISS', { cacheKey });

  // Load file with CWD workaround and mutex protection
  const result = await withCwdWorkaround(async () => {
    const fullPath = `./out/renderer/${filePath}`;
    logger.debug('[Bun Renderer] Reading embedded file with Bun.file()', { fullPath });
    const content = await Bun.file(fullPath).text();
    logger.debug('[Bun Renderer] Successfully read embedded file', { fullPath, size: content.length });
    return content;
  });

  const contentType = getContentType(`/renderer/${filePath}`);
  const etag = generateETag(result);

  rendererCache.set(cacheKey, { content: result, contentType, etag });
  logger.debug('[Bun Renderer] Cached file', { cacheKey, size: result.length, etag });

  if (setHeaders) {
    setHeaders(res, cacheKey);
  }

  res.set('Content-Type', contentType);
  res.set('ETag', etag);

  const ifNoneMatch = req.headers['if-none-match'];
  if (ifNoneMatch && ifNoneMatch === etag) {
    logger.debug('[Bun Renderer] 304 Not Modified (ETag match)');
    res.statusCode = 304;
    void res.end();
    return;
  }

  if (req.method === 'HEAD') {
    res.setHeader('Content-Length', Buffer.byteLength(result));
    void res.end();
    return;
  }

  logger.debug('[Bun Renderer] Sending loaded content', { cacheKey, size: result.length });
  void res.send(result);
  return;
};

/**
 * Express middleware to serve renderer files with CWD workaround, mutex protection, and caching.
 * Follows the behavior pattern of express.static() with:
 * - Only handles GET and HEAD requests
 * - Supports fallthrough to next middleware
 * - Supports custom headers
 * - Caching for performance
 */
export const createRendererMiddleware = (
  options: {
    fallthrough?: boolean;
    setHeaders?: (res: RendererResponse, path: string) => void;
  } = {},
) => {
  const setHeaders = options.setHeaders;

  return async (req: RendererRequest, res: RendererResponse, next: () => void) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }

    if (req.path.startsWith('/api')) {
      return next();
    }

    if (req.path === '/' || req.path === '') {
      try {
        return await serveRendererFile(req, res, 'index.html', { setHeaders });
      } catch (error) {
        logger.debug('[Bun Renderer] Error serving index.html', { error });
        return next();
      }
    }

    const filePath = req.path.startsWith('/') ? req.path.slice(1) : req.path;

    try {
      return await serveRendererFile(req, res, filePath, { setHeaders });
    } catch (error) {
      logger.debug('[Bun Renderer] Error serving file', { filePath, error });
      return next();
    }
  };
};
