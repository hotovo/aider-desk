import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

import { delay } from '@common/utils';

import logger from '@/logger';
import { getCurrentPythonLibVersion, getLatestPythonLibVersion, getPythonVenvBinPath } from '@/utils';
import {
  AIDER_DESK_DATA_DIR,
  SETUP_COMPLETE_FILENAME,
  PYTHON_VENV_DIR,
  AIDER_DESK_CONNECTOR_DIR,
  RESOURCES_DIR,
  AIDER_DESK_MCP_SERVER_DIR,
  UV_EXECUTABLE,
} from '@/constants';
import { isDev } from '@/app';

const execAsync = promisify(exec);

/**
 * Checks if uv is available and accessible.
 */
const checkUvAvailable = async (): Promise<void> => {
  try {
    const { stdout, stderr } = await execAsync(`"${UV_EXECUTABLE}" --version`, {
      windowsHide: true,
    });

    const output = (stdout || '') + (stderr || '');
    if (!output.includes('uv')) {
      throw new Error('uv version check failed');
    }

    logger.info(`uv is available: ${output.trim()}`);
  } catch (error) {
    logger.error('uv is not available or not working', { error });
    throw new Error(`uv is not available. Please ensure uv is properly installed. Error: ${error}`);
  }
};

const createVirtualEnv = async (): Promise<void> => {
  const command = `"${UV_EXECUTABLE}" venv "${PYTHON_VENV_DIR}" --python 3.12`;
  logger.info(`Creating virtual environment with uv: ${command}`);

  await execAsync(command, {
    windowsHide: true,
  });
};

const setupAiderConnector = async (cleanInstall: boolean, updateProgress?: UpdateProgressFunction): Promise<void> => {
  if (!fs.existsSync(AIDER_DESK_CONNECTOR_DIR)) {
    fs.mkdirSync(AIDER_DESK_CONNECTOR_DIR, { recursive: true });
  }

  // Copy connector.py from resources
  const sourceConnectorPath = path.join(RESOURCES_DIR, 'connector/connector.py');
  const destConnectorPath = path.join(AIDER_DESK_CONNECTOR_DIR, 'connector.py');
  fs.copyFileSync(sourceConnectorPath, destConnectorPath);

  await installAiderConnectorRequirements(cleanInstall, updateProgress);
};

const installAiderConnectorRequirements = async (cleanInstall: boolean, updateProgress?: UpdateProgressFunction): Promise<void> => {
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

  logger.info('Starting Aider connector requirements installation', { packages });

  for (let currentPackage = 0; currentPackage < packages.length; currentPackage++) {
    const pkg = packages[currentPackage];
    if (updateProgress) {
      const baseProgress = 30;
      const packageProgress = (currentPackage / packages.length) * 40;
      updateProgress({
        step: 'Installing Requirements',
        message: `Installing package: ${pkg.split('==')[0]} (${currentPackage + 1}/${packages.length})`,
        info: 'This may take a while...',
        progress: baseProgress + packageProgress,
      });
    }
    try {
      const installCommand = `"${UV_EXECUTABLE}" pip install --upgrade --no-progress --no-cache-dir --link-mode=copy ${pkg}`;

      if (!cleanInstall) {
        const packageName = pkg.split('==')[0];
        const currentVersion = pkg.startsWith('git+') ? null : await getCurrentPythonLibVersion(packageName);

        if (currentVersion) {
          if (pkg.includes('==')) {
            // Version-pinned package - check if matches required version
            const requiredVersion = pkg.split('==')[1];
            if (currentVersion === requiredVersion) {
              logger.info(`Package ${pkg} is already at required version ${requiredVersion}, skipping`);
              continue;
            }
          } else {
            // For non-version-pinned packages, check if newer version is available
            const latestVersion = await getLatestPythonLibVersion(packageName);
            if (latestVersion && currentVersion === latestVersion) {
              logger.info(`Package ${pkg} is already at latest version ${currentVersion}, skipping`);
              continue;
            }
          }
        }
        // If currentVersion is null, the package is not installed, so proceed with installation.
      }

      logger.info(`Installing package: ${pkg}`);
      const { stdout, stderr } = await execAsync(installCommand, {
        windowsHide: true,
        env: {
          ...process.env,
          VIRTUAL_ENV: PYTHON_VENV_DIR,
          PATH: `${pythonBinPath}${path.delimiter}${process.env.PATH}`,
        },
      });

      if (stdout.trim()) {
        logger.debug(`Package ${pkg} installation output`, { stdout: stdout.trim() });
      }
      if (stderr.trim()) {
        logger.warn(`Package ${pkg} installation warnings`, { stderr: stderr.trim() });
      }
    } catch (error) {
      if (error instanceof Error && error.message.trim().endsWith('No module named pip') && !cleanInstall) {
        logger.warn('Failed to install package. pip is not installed. Trying full clean venv reinstallation...');
        fs.rmSync(PYTHON_VENV_DIR, { recursive: true, force: true });
        await createVirtualEnv();
        await installAiderConnectorRequirements(true, updateProgress);
        return;
      }

      logger.error(`Failed to install package: ${pkg}`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new Error(`Failed to install Aider connector requirements. Package: ${pkg}. Error: ${error}`);
    }
  }

  if (updateProgress) {
    updateProgress({
      step: 'Installing Requirements',
      message: 'Completed installing all packages',
    });
  }
  logger.info('Completed Aider connector requirements installation');
};

const setupMcpServer = async () => {
  if (isDev()) {
    logger.info('Skipping AiderDesk MCP server setup in dev mode');
    return;
  }

  if (!fs.existsSync(AIDER_DESK_MCP_SERVER_DIR)) {
    fs.mkdirSync(AIDER_DESK_MCP_SERVER_DIR, { recursive: true });
  }

  // Copy all files from the MCP server directory
  const sourceMcpServerDir = path.join(RESOURCES_DIR, 'mcp-server');

  if (fs.existsSync(sourceMcpServerDir)) {
    const files = fs.readdirSync(sourceMcpServerDir);

    for (const file of files) {
      const sourceFilePath = path.join(sourceMcpServerDir, file);
      const destFilePath = path.join(AIDER_DESK_MCP_SERVER_DIR, file);

      // Skip directories for now, only copy files
      if (fs.statSync(sourceFilePath).isFile()) {
        fs.copyFileSync(sourceFilePath, destFilePath);
      }
    }
  } else {
    logger.error(`MCP server directory not found: ${sourceMcpServerDir}`);
  }
};

const performUpdateCheck = async (updateProgress: UpdateProgressFunction): Promise<void> => {
  updateProgress({
    step: 'Update Check',
    message: 'Checking for updates...',
  });

  await setupAiderConnector(false, updateProgress);

  updateProgress({
    step: 'Update Check',
    message: 'Updating components...',
  });

  await setupMcpServer();
};

export type UpdateProgressData = {
  step: string;
  message: string;
  info?: string;
  progress?: number; // 0-100
};

export type UpdateProgressFunction = (data: UpdateProgressData) => void;

export const performStartUp = async (updateProgress: UpdateProgressFunction): Promise<boolean> => {
  logger.info('Starting AiderDesk setup process');

  if (fs.existsSync(SETUP_COMPLETE_FILENAME) && fs.existsSync(PYTHON_VENV_DIR)) {
    logger.info('Setup previously completed, performing update check');
    await performUpdateCheck(updateProgress);
    return true;
  }

  updateProgress({
    step: 'Initial Setup',
    message: 'Preparing environment...',
    progress: 5,
  });

  await delay(1000);

  if (!fs.existsSync(AIDER_DESK_DATA_DIR)) {
    logger.info(`Creating AiderDesk directory: ${AIDER_DESK_DATA_DIR}`);
    fs.mkdirSync(AIDER_DESK_DATA_DIR, { recursive: true });
  }
  updateProgress({
    step: 'Initial Setup',
    message: 'Environment ready',
    progress: 10,
  });

  try {
    updateProgress({
      step: 'Checking uv Installation',
      message: 'Verifying uv installation...',
      progress: 15,
    });

    logger.info('Checking uv availability');
    await checkUvAvailable();

    updateProgress({
      step: 'Creating Virtual Environment',
      message: 'Setting up Python virtual environment with uv...',
      info: 'This may take a while...',
      progress: 25,
    });

    logger.info(`Creating Python virtual environment with in: ${PYTHON_VENV_DIR}`);
    await createVirtualEnv();

    updateProgress({
      step: 'Setting Up Connector',
      message: 'Installing Aider connector...',
      info: 'This may take a while...',
      progress: 35,
    });

    logger.info('Setting up Aider connector');
    await setupAiderConnector(true, updateProgress);

    updateProgress({
      step: 'Setting Up MCP Server',
      message: 'Installing MCP server...',
      progress: 75,
    });

    logger.info('Setting up MCP server');
    await setupMcpServer();

    updateProgress({
      step: 'Finishing Setup',
      message: 'Completing installation...',
      progress: 90,
    });

    // Create setup complete file
    logger.info(`Creating setup complete file: ${SETUP_COMPLETE_FILENAME}`);
    fs.writeFileSync(SETUP_COMPLETE_FILENAME, new Date().toISOString());
    updateProgress({
      step: 'Finishing Setup',
      message: 'Installation complete',
      progress: 100,
    });

    logger.info('AiderDesk setup completed successfully');
    return true;
  } catch (error) {
    logger.error('AiderDesk setup failed', { error });

    // Clean up if setup fails
    if (fs.existsSync(PYTHON_VENV_DIR)) {
      logger.info(`Removing virtual environment directory: ${PYTHON_VENV_DIR}`);
      fs.rmSync(PYTHON_VENV_DIR, { recursive: true, force: true });
    }
    if (fs.existsSync(SETUP_COMPLETE_FILENAME)) {
      logger.info(`Removing setup complete file: ${SETUP_COMPLETE_FILENAME}`);
      fs.unlinkSync(SETUP_COMPLETE_FILENAME);
    }
    throw error;
  }
};
