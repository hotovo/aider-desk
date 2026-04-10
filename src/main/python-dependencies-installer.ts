import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

import logger from '@/logger';
import { EventManager } from '@/events';
import { getCurrentPythonLibVersion, getLatestPythonLibVersion, getPythonVenvBinPath, getResolvedUvPath } from '@/utils';
import { AIDER_DESK_CONNECTOR_DIR, AIDER_DESK_DATA_DIR, PYTHON_VENV_DIR, RESOURCES_DIR, SETUP_COMPLETE_FILENAME } from '@/constants';

const execAsync = promisify(exec);

export type PythonInstallStatus =
  | { state: 'idle' }
  | { state: 'checking-uv' }
  | { state: 'downloading-uv' }
  | { state: 'creating-venv' }
  | {
      state: 'installing-packages';
      package: string;
      current: number;
      total: number;
    }
  | { state: 'setting-up-connector' }
  | { state: 'starting-connector' }
  | { state: 'ready' }
  | { state: 'failed'; error: string };

type StatusListener = (status: PythonInstallStatus) => void;

/**
 * Manages Python dependency installation in the background.
 *
 * Handles:
 * - Creating the Python virtual environment
 * - Installing aider-chat and connector dependencies
 * - Exposing installation status to the UI via EventManager
 *
 * The installation runs asynchronously (fire-and-forget). Consumers call
 * `waitForReady()` to gate on completion before spawning Python processes.
 */
export class PythonDependenciesInstaller {
  private currentStatus: PythonInstallStatus = { state: 'idle' };
  private readyResolve: (() => void) | null = null;
  private readyReject: ((error: Error) => void) | null = null;
  private readyPromise: Promise<void> | null = null;
  private statusListeners: Set<StatusListener> = new Set();
  private installing: boolean = false;

  constructor(private readonly eventManager: EventManager) {}

  /**
   * Start the installation process in the background (fire-and-forget).
   * Safe to call multiple times — only one install runs at a time.
   */
  ensureInstalled(): void {
    if (this.currentStatus.state === 'ready') {
      return;
    }
    if (this.installing) {
      return;
    }

    this.installing = true;
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });

    void this.runInstallation().catch((error) => {
      logger.error('Python dependencies installation failed', { error });
      this.setStatus({
        state: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
      this.readyReject?.(error instanceof Error ? error : new Error(String(error)));
      this.installing = false;
    });
  }

  /**
   * Wait until the installation is complete and the environment is ready.
   * Resolves immediately if already ready. Rejects if installation failed.
   */
  async waitForReady(): Promise<void> {
    if (this.currentStatus.state === 'ready') {
      return;
    }
    if (this.currentStatus.state === 'failed') {
      throw new Error(`Python dependencies not available: ${(this.currentStatus as { error: string }).error}`);
    }
    if (this.readyPromise) {
      return this.readyPromise;
    }

    // Not started yet — kick off and wait
    this.ensureInstalled();
    if (this.readyPromise) {
      return this.readyPromise;
    }
  }

  /** Check if the environment is ready to use. */
  isReady(): boolean {
    return this.currentStatus.state === 'ready';
  }

  /** Get the current installation status. */
  getStatus(): PythonInstallStatus {
    return this.currentStatus;
  }

  /**
   * Subscribe to status changes. Returns an unsubscribe function.
   */
  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  // --- Private implementation ---

  private setStatus(status: PythonInstallStatus): void {
    this.currentStatus = status;
    this.eventManager.sendAiderConnectorStatus(status);
    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch {
        // Ignore listener errors
      }
    }
  }

  private async runInstallation(): Promise<void> {
    // If setup was previously completed and venv exists, do an update check
    if (fs.existsSync(SETUP_COMPLETE_FILENAME) && fs.existsSync(PYTHON_VENV_DIR)) {
      logger.info('Setup previously completed, performing update check in background');
      await this.performUpdateCheck();
      return;
    }

    // Full first-time setup
    logger.info('Starting full Python dependencies setup');

    // Create data dir if needed
    if (!fs.existsSync(AIDER_DESK_DATA_DIR)) {
      logger.info(`Creating AiderDesk directory: ${AIDER_DESK_DATA_DIR}`);
      fs.mkdirSync(AIDER_DESK_DATA_DIR, { recursive: true });
    }

    await this.checkUvAvailableInternal();

    await this.createVirtualEnvInternal();

    await this.setupAiderConnectorInternal(true);

    // Mark setup as complete
    logger.info(`Creating setup complete file: ${SETUP_COMPLETE_FILENAME}`);
    fs.writeFileSync(SETUP_COMPLETE_FILENAME, new Date().toISOString());

    this.setStatus({ state: 'ready' });
    this.readyResolve?.();
    this.installing = false;
    logger.info('Python dependencies installation completed successfully');
  }

  private async performUpdateCheck(): Promise<void> {
    if (process.env.AIDER_DESK_NO_UPDATES === 'true') {
      logger.info('Skipping update checks (AIDER_DESK_NO_UPDATES is set)');
      this.setStatus({ state: 'ready' });
      this.readyResolve?.();
      this.installing = false;
      return;
    }

    if (!(await this.checkNetworkConnectivity())) {
      logger.info('No network connection, skipping updates — marking ready');
      this.setStatus({ state: 'ready' });
      this.readyResolve?.();
      this.installing = false;
      return;
    }

    // Run update check (install/upgrade packages)
    await this.setupAiderConnectorInternal(false);

    this.setStatus({ state: 'ready' });
    this.readyResolve?.();
    this.installing = false;
    logger.info('Python dependencies update check completed');
  }

  private async checkUvAvailableInternal(): Promise<void> {
    this.setStatus({ state: 'checking-uv' });

    await getResolvedUvPath({
      onDownloadStarted: () => this.setStatus({ state: 'downloading-uv' }),
    });
  }

  private async createVirtualEnvInternal(): Promise<void> {
    this.setStatus({ state: 'creating-venv' });
    const command = `"${await getResolvedUvPath()}" venv "${PYTHON_VENV_DIR}" --python 3.12`;
    logger.info(`Creating virtual environment with uv: ${command}`, {
      virtualEnv: PYTHON_VENV_DIR,
    });

    await execAsync(command, {
      windowsHide: true,
    });
  }

  private async setupAiderConnectorInternal(cleanInstall: boolean): Promise<void> {
    this.setStatus({ state: 'setting-up-connector' });

    if (!fs.existsSync(AIDER_DESK_CONNECTOR_DIR)) {
      fs.mkdirSync(AIDER_DESK_CONNECTOR_DIR, { recursive: true });
    }

    // Copy connector.py from resources
    const sourceConnectorPath = path.join(RESOURCES_DIR, 'connector/connector.py');
    const destConnectorPath = path.join(AIDER_DESK_CONNECTOR_DIR, 'connector.py');
    fs.copyFileSync(sourceConnectorPath, destConnectorPath);

    await this.installAiderConnectorRequirements(cleanInstall);
  }

  private async installAiderConnectorRequirements(cleanInstall: boolean): Promise<void> {
    const pythonBinPath = getPythonVenvBinPath();
    let aiderVersionSpecifier = 'aider-chat';
    if (process.env.AIDER_DESK_AIDER_VERSION) {
      if (process.env.AIDER_DESK_AIDER_VERSION.startsWith('git+') || path.isAbsolute(process.env.AIDER_DESK_AIDER_VERSION)) {
        aiderVersionSpecifier = process.env.AIDER_DESK_AIDER_VERSION;
      } else {
        aiderVersionSpecifier = `aider-chat==${process.env.AIDER_DESK_AIDER_VERSION}`;
      }
    }
    const extraPackages = (process.env.AIDER_DESK_EXTRA_PYTHON_PACKAGES || '').split(',').filter(Boolean);
    if (extraPackages.length > 0) {
      logger.info(`Extra Python packages specified: ${extraPackages.join(', ')}`);
    }

    const packages = [
      'pip',
      aiderVersionSpecifier,
      'python-socketio==5.12.1',
      'websocket-client==1.8.0',
      'nest-asyncio==1.6.0',
      'boto3==1.38.25',
      'opentelemetry-api==1.35.0',
      'opentelemetry-sdk==1.35.0',
      'portalocker==3.2.0',
      ...extraPackages,
    ];

    logger.info('Starting Aider connector requirements installation', {
      packages,
    });

    for (let currentPackage = 0; currentPackage < packages.length; currentPackage++) {
      const pkg = packages[currentPackage];
      this.setStatus({
        state: 'installing-packages',
        package: pkg.split('==')[0],
        current: currentPackage + 1,
        total: packages.length,
      });

      try {
        const installCommand = `"${await getResolvedUvPath()}" pip install --upgrade --no-progress --no-cache-dir --link-mode=copy ${pkg}`;

        if (!cleanInstall) {
          const packageName = pkg.split('==')[0];
          const currentVersion = pkg.startsWith('git+') ? null : await getCurrentPythonLibVersion(packageName);

          if (currentVersion) {
            if (pkg.includes('==')) {
              const requiredVersion = pkg.split('==')[1];
              if (currentVersion === requiredVersion) {
                logger.debug(`Package ${pkg} is already at required version ${requiredVersion}, skipping`);
                continue;
              }
            } else {
              const latestVersion = await getLatestPythonLibVersion(packageName);
              if (latestVersion && currentVersion === latestVersion) {
                logger.debug(`Package ${pkg} is already at latest version ${currentVersion}, skipping`);
                continue;
              }
            }
          }
        }

        logger.info(`Installing package: ${pkg}`, {
          virtualEnv: PYTHON_VENV_DIR,
        });
        const { stdout, stderr } = await execAsync(installCommand, {
          windowsHide: true,
          env: {
            ...process.env,
            VIRTUAL_ENV: PYTHON_VENV_DIR,
            PATH: `${pythonBinPath}${path.delimiter}${process.env.PATH}`,
          },
        });

        if (stdout.trim()) {
          logger.debug(`Package ${pkg} installation output`, {
            stdout: stdout.trim(),
          });
        }
        if (stderr.trim()) {
          logger.warn(`Package ${pkg} installation warnings`, {
            stderr: stderr.trim(),
          });
        }
      } catch (error) {
        if (error instanceof Error && error.message.trim().endsWith('No module named pip') && !cleanInstall) {
          logger.warn('Failed to install package. pip is not installed. Trying full clean venv reinstallation...');
          fs.rmSync(PYTHON_VENV_DIR, { recursive: true, force: true });
          await this.createVirtualEnvInternal();
          await this.installAiderConnectorRequirements(true);
          return;
        }

        logger.warn(`Failed to install package: ${pkg} (possibly offline or network issue), continuing with existing version`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info('Completed Aider connector requirements installation');
  }

  private async checkNetworkConnectivity(): Promise<boolean> {
    try {
      await fetch('https://pypi.org/', { signal: AbortSignal.timeout(5000) });
      return true;
    } catch {
      logger.warn('Network connectivity check failed, skipping update checks');
      return false;
    }
  }
}
