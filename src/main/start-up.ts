import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

import { delay } from '@common/utils';
import { is } from '@electron-toolkit/utils';

import logger from './logger';
import { getCurrentPythonLibVersion, getLatestPythonLibVersion, getPythonVenvBinPath } from './utils';
import {
  AIDER_DESK_DIR,
  SETUP_COMPLETE_FILENAME,
  PYTHON_VENV_DIR,
  AIDER_DESK_CONNECTOR_DIR,
  RESOURCES_DIR,
  PYTHON_COMMAND,
  AIDER_DESK_MCP_SERVER_DIR,
} from './constants';

const execAsync = promisify(exec);

const SUPPORTED_PYTHON_VERSIONS = ['3.12', '3.11', '3.10', '3.9'];

/**
 * Smartly finds the best Python executable on the system, preferring the newest supported version.
 * Respects the AIDER_DESK_PYTHON environment variable if set.
 * Returns the name of the executable/command to use.
 */
export const getOSPythonExecutable = async (): Promise<string> => {
  const envPython = process.env.AIDER_DESK_PYTHON;
  if (envPython) {
    return envPython;
  }

  for (const version of SUPPORTED_PYTHON_VERSIONS) {
    const candidates = [
      `python${version}`,
      `python${version[0]}`, // python3
    ];
    if (process.platform === 'win32') {
      candidates.push(`py -${version}`);
    }
    candidates.push('python3', 'python'); // Fallbacks

    for (const candidate of candidates) {
      try {
        // For "py -3.12", use shell:true, otherwise append --version
        let command: string;
        let useShell = false;
        if (process.platform === 'win32' && candidate.startsWith('py ')) {
          command = `${candidate} --version`;
          useShell = true;
        } else {
          command = `${candidate} --version`;
        }
        const { stdout, stderr } = await execAsync(command, {
          windowsHide: true,
          shell: useShell,
        });
        const output = (stdout || '') + (stderr || '');
        const match = output.match(/Python (\d+)\.(\d+)/);
        if (match) {
          const [major, minor] = [parseInt(match[1]), parseInt(match[2])];
          if (major === 3 && SUPPORTED_PYTHON_VERSIONS.includes(`3.${minor}`)) {
            return candidate;
          }
        }
      } catch {
        // Try next candidate
      }
    }
  }

  throw new Error(
    'No supported Python 3.9-3.12 executable found. Please install Python or set the AIDER_DESK_PYTHON environment variable.'
  );
};

const checkPythonVersion = async (): Promise<void> => {
  const pythonExecutable = await getOSPythonExecutable();
  try {
    const command = `${pythonExecutable} --version`;
    const { stdout, stderr } = await execAsync(command, {
      windowsHide: true,
      shell: process.platform === 'win32' && pythonExecutable.startsWith('py '),
    });

    // Extract version number from output like "Python 3.10.12"
    const output = (stdout || '') + (stderr || '');
    const versionMatch = output.match(/Python (\d+)\.(\d+)\.\d+/);
    if (!versionMatch) {
      throw new Error(
        `Could not determine Python version (output: '${output}'). You can specify a specific Python executable by setting the AIDER_DESK_PYTHON environment variable.`,
      );
    }

    const major = parseInt(versionMatch[1], 10);
    const minor = parseInt(versionMatch[2], 10);

    // Check if version is between 3.9 and 3.12
    if (major !== 3 || minor < 9 || minor > 12) {
      throw new Error(
        `Python version ${major}.${minor} is not supported. Please install Python 3.9-3.12. You can specify a specific Python executable by setting the AIDER_DESK_PYTHON environment variable.`,
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('version')) {
      throw error;
    }
    throw new Error(
      `Python is not installed or an error occurred. Please install Python 3.9-3.12 or set the AIDER_DESK_PYTHON environment variable. Original error: ${error}`,
    );
  }
};

const createVirtualEnv = async (): Promise<void> => {
  const command = await getOSPythonExecutable();
  await execAsync(`${command} -m venv "${PYTHON_VENV_DIR}"`, {
    windowsHide: true,
    shell: process.platform === 'win32' && command.startsWith('py '),
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
  const packages = ['pip', 'aider-chat', 'python-socketio==5.12.1', 'websocket-client==1.8.0', 'nest-asyncio==1.6.0'];

  logger.info('Starting Aider connector requirements installation', { packages });

  for (let currentPackage = 0; currentPackage < packages.length; currentPackage++) {
    const pkg = packages[currentPackage];
    if (updateProgress) {
      updateProgress({
        step: 'Installing Requirements',
        message: `Installing package: ${pkg} (${currentPackage + 1}/${packages.length})`,
      });
    }
    try {
      const installCommand = `"${PYTHON_COMMAND}" -m pip install --upgrade --no-cache-dir ${pkg}`;

      if (!cleanInstall) {
        const packageName = pkg.split('==')[0];
        const currentVersion = await getCurrentPythonLibVersion(packageName);

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
  if (is.dev) {
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
    message: 'Updating Aider connector...',
  });

  await setupAiderConnector(false, updateProgress);

  updateProgress({
    step: 'Update Check',
    message: 'Updating MCP server...',
  });

  await setupMcpServer();
};

export type UpdateProgressData = {
  step: string;
  message: string;
};

export type UpdateProgressFunction = (data: UpdateProgressData) => void;

export const performStartUp = async (updateProgress: UpdateProgressFunction): Promise<boolean> => {
  logger.info('Starting AiderDesk setup process');

  if (fs.existsSync(SETUP_COMPLETE_FILENAME)) {
    logger.info('Setup previously completed, performing update check');
    await performUpdateCheck(updateProgress);
    return true;
  }

  updateProgress({
    step: 'AiderDesk Setup',
    message: 'Performing initial setup...',
  });

  await delay(2000);

  if (!fs.existsSync(AIDER_DESK_DIR)) {
    logger.info(`Creating AiderDesk directory: ${AIDER_DESK_DIR}`);
    fs.mkdirSync(AIDER_DESK_DIR, { recursive: true });
  }

  try {
    updateProgress({
      step: 'Checking Python Installation',
      message: 'Verifying Python installation...',
    });

    logger.info('Checking Python version compatibility');
    await checkPythonVersion();

    updateProgress({
      step: 'Creating Virtual Environment',
      message: 'Setting up Python virtual environment...',
    });

    logger.info(`Creating Python virtual environment in: ${PYTHON_VENV_DIR}`);
    await createVirtualEnv();

    updateProgress({
      step: 'Setting Up Connector',
      message: 'Installing Aider connector (this may take a while)...',
    });

    logger.info('Setting up Aider connector');
    await setupAiderConnector(true);

    updateProgress({
      step: 'Setting Up MCP Server',
      message: 'Installing MCP server...',
    });

    logger.info('Setting up MCP server');
    await setupMcpServer();

    updateProgress({
      step: 'Finishing Setup',
      message: 'Completing installation...',
    });

    // Create setup complete file
    logger.info(`Creating setup complete file: ${SETUP_COMPLETE_FILENAME}`);
    fs.writeFileSync(SETUP_COMPLETE_FILENAME, new Date().toISOString());

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
