import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

import { delay } from '@common/utils';
import { is } from '@electron-toolkit/utils';

import logger from './logger';
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

const getOSPythonExecutable = (): string => {
  const envPython = process.env.AIDER_DESK_PYTHON;
  if (envPython) {
    return envPython;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
};

const checkPythonVersion = async (): Promise<void> => {
  const pythonExecutable = getOSPythonExecutable();
  try {
    const command = `${pythonExecutable} --version`;
    const { stdout } = await execAsync(command, {
      windowsHide: true,
    });

    // Extract version number from output like "Python 3.10.12"
    const versionMatch = stdout.match(/Python (\d+)\.(\d+)\.\d+/);
    if (!versionMatch) {
      throw new Error(
        `Could not determine Python version (output: '${stdout}'). You can specify a specific Python executable by setting the AIDER_DESK_PYTHON environment variable.`,
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
  const command = getOSPythonExecutable();
  await execAsync(`${command} -m venv "${PYTHON_VENV_DIR}"`, {
    windowsHide: true,
  });
};

const getPythonVenvBinPath = (): string => {
  return process.platform === 'win32' ? path.join(PYTHON_VENV_DIR, 'Scripts') : path.join(PYTHON_VENV_DIR, 'bin');
};

const setupAiderConnector = async () => {
  if (!fs.existsSync(AIDER_DESK_CONNECTOR_DIR)) {
    fs.mkdirSync(AIDER_DESK_CONNECTOR_DIR, { recursive: true });
  }

  // Copy connector.py from resources
  const sourceConnectorPath = path.join(RESOURCES_DIR, 'connector/connector.py');
  const destConnectorPath = path.join(AIDER_DESK_CONNECTOR_DIR, 'connector.py');
  fs.copyFileSync(sourceConnectorPath, destConnectorPath);

  await installAiderConnectorRequirements();
};

const installAiderConnectorRequirements = async (): Promise<void> => {
  const pythonBinPath = getPythonVenvBinPath();
  const packages = ['pip', 'aider-chat', 'python-socketio', 'websocket-client', 'nest-asyncio'];

  logger.info('Starting Aider connector requirements installation', { packages });

  // 检查Python命令路径是否存在
  const pythonCommand = fs.existsSync(PYTHON_COMMAND) ? PYTHON_COMMAND : 
    (process.platform === 'win32' ? 'python' : 'python3');
  
  logger.info(`Using Python command: ${pythonCommand}`);

  for (const pkg of packages) {
    try {
      logger.info(`Installing package: ${pkg}`);
      const { stdout, stderr } = await execAsync(`"${pythonCommand}" -m pip install --upgrade --no-cache-dir ${pkg}`, {
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

  logger.info('Completed Aider connector requirements installation');
};

const setupMcpServer = async () => {
  if (is.dev) {
    logger.info('Skipping MCP server setup in dev mode');
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
    console.error(`MCP server directory not found: ${sourceMcpServerDir}`);
  }
};

const performUpdateCheck = async (updateProgress: UpdateProgressFunction): Promise<void> => {
  updateProgress({
    step: 'Update Check',
    message: 'Updating Aider connector...',
  });

  await setupAiderConnector();

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
    await setupAiderConnector();

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
