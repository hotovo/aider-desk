import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { GenericContainer, Wait } from 'testcontainers';

import type { StartedTestContainer } from 'testcontainers';
import type { ExtensionContext } from '@aiderdesk/extensions';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const DBX_IMAGE = 't8y2/dbx:latest';
export const DBX_INTERNAL_PORT = 4224;
export const DBX_HOST_PORT = 4224;
export const CONTAINER_STARTUP_TIMEOUT_MS = 120_000;

// Persistent server-side storage lives OUTSIDE the extension folder so it
// survives extension updates/reinstalls and lives next to the dbx db.
export const getDataDir = (): string => join(homedir(), '.aider-desk', 'extension-state', 'dbx', 'dbx-data');

export enum ContainerState {
  Idle = 'idle',
  Starting = 'starting',
  Started = 'started',
  Error = 'error',
}

export interface DbxStatus {
  containerState: ContainerState;
  url: string;
  error: string;
}

let container: StartedTestContainer | null = null;
let startPromise: Promise<StartedTestContainer> | null = null;
let lastError: string | null = null;

export const getDbxStatus = (): DbxStatus => {
  if (startPromise) {
    return { containerState: ContainerState.Starting, url: '', error: '' };
  }
  if (container) {
    return { containerState: ContainerState.Started, url: getContainerUrl(), error: '' };
  }
  return { containerState: ContainerState.Idle, url: '', error: lastError ?? '' };
};

// Fixed host port keeps the origin stable across container recreation, so any
// client-side storage used by the DBX web app (localStorage, cookies) persists.
const getContainerUrl = (): string => `http://localhost:${DBX_HOST_PORT}`;

export interface DbxMount {
  source: string;
}

export const ensureDbxRunning = async (context: ExtensionContext, mounts: DbxMount[] = []): Promise<boolean> => {
  if (container) {
    return true;
  }
  if (startPromise) {
    return false;
  }

  startPromise = (async () => {
    const dataDir = getDataDir();
    mkdirSync(dataDir, { recursive: true });

    context.log('[dbx] starting DBX container...', 'info');
    const started = await new GenericContainer(DBX_IMAGE)
      .withEnvironment({
        DBX_DISABLE_PASSWORD: '1',
        DBX_IN_CONTAINER: '1',
      })
      .withExposedPorts({ container: DBX_INTERNAL_PORT, host: DBX_HOST_PORT })
      .withBindMounts([
        { source: dataDir, target: '/app/data' },
        ...mounts.map((mount) => ({ source: mount.source, target: `/dbx-mounts/${basename(mount.source)}` })),
      ])
      .withWaitStrategy(Wait.forHttp('/', DBX_INTERNAL_PORT).forStatusCodeMatching((code) => code >= 200 && code < 500))
      .withStartupTimeout(CONTAINER_STARTUP_TIMEOUT_MS)
      .start();

    container = started;
    lastError = null;
    context.log(`[dbx] DBX container started at ${getContainerUrl()}`, 'info');
    return started;
  })();

  try {
    await startPromise;
    return true;
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
    context.log(`[dbx] failed to start DBX container: ${lastError}`, 'error');
    return false;
  } finally {
    startPromise = null;
  }
};

export const stopDbxContainer = async (): Promise<void> => {
  if (!container) {
    return;
  }
  const current = container;
  container = null;
  try {
    await current.stop();
    // eslint-disable-next-line no-console
    console.info('[dbx] DBX container stopped');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[dbx] failed to stop DBX container: ${error instanceof Error ? error.message : String(error)}`);
  }
};
