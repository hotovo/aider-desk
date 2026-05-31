import path from 'path';
import fs from 'fs/promises';

import { AIDER_DESK_CACHE_DIR } from '@/constants';
import logger from '@/logger';
import { fetchWithTimeout } from '@/utils';

const ESM_SH_BASE_URL = 'https://esm.sh';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const sanitizeLibraryName = (name: string): string => {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
};

export class ExtensionLibraryLoader {
  private readonly cacheDir: string;

  constructor() {
    this.cacheDir = path.join(AIDER_DESK_CACHE_DIR, 'extension-libraries');
  }

  private getCachePath(librarySpec: string): string {
    const sanitized = sanitizeLibraryName(librarySpec);
    return path.join(this.cacheDir, `${sanitized}.js`);
  }

  private getMetaPath(librarySpec: string): string {
    const sanitized = sanitizeLibraryName(librarySpec);
    return path.join(this.cacheDir, `${sanitized}.meta.json`);
  }

  async loadLibrary(librarySpec: string): Promise<string> {
    const cachePath = this.getCachePath(librarySpec);
    const metaPath = this.getMetaPath(librarySpec);

    try {
      await fs.access(cachePath);
      await fs.access(metaPath);
      try {
        const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
        const age = Date.now() - new Date(meta.fetchedAt).getTime();
        if (age < CACHE_TTL_MS) {
          logger.debug(`[ExtensionLibraryLoader] Cache hit for ${librarySpec}`);
          return await fs.readFile(cachePath, 'utf-8');
        }
        logger.info(`[ExtensionLibraryLoader] Cache stale for ${librarySpec} (age: ${Math.round(age / 1000 / 60)}min), re-fetching`);
      } catch {
        logger.warn(`[ExtensionLibraryLoader] Failed to read meta for ${librarySpec}, re-fetching`);
      }
    } catch {
      // cache miss - fetch below
    }

    logger.info(`[ExtensionLibraryLoader] Fetching ${librarySpec} from esm.sh`);

    const url = `${ESM_SH_BASE_URL}/${librarySpec}?external=react,react-dom,react/jsx-runtime,react/jsx-dev-runtime&bundle-deps&bundle`;

    let response = await fetchWithTimeout(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch library ${librarySpec} from esm.sh: ${response.status} ${response.statusText}`);
    }

    let source = await response.text();

    const redirectMatch = source.match(/export\s+\*\s+from\s+["']([^"']+)["']/);
    if (redirectMatch) {
      const bundleUrl = `${ESM_SH_BASE_URL}${redirectMatch[1]}`;
      logger.debug(`[ExtensionLibraryLoader] Following redirect to ${bundleUrl}`);

      response = await fetchWithTimeout(bundleUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch bundle for ${librarySpec} from esm.sh: ${response.status} ${response.statusText}`);
      }
      source = await response.text();
    }

    await fs.mkdir(this.cacheDir, { recursive: true });
    await fs.writeFile(cachePath, source, 'utf-8');
    await fs.writeFile(metaPath, JSON.stringify({ librarySpec, fetchedAt: new Date().toISOString() }), 'utf-8');

    logger.info(`[ExtensionLibraryLoader] Cached ${librarySpec}`);
    return source;
  }
}
