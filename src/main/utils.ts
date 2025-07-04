import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import fsPromises from 'fs/promises';

import ignore from 'ignore';
import { fileExists } from '@common/utils';

import { PYTHON_COMMAND, PYTHON_VENV_DIR, UV_EXECUTABLE } from './constants';
import logger from './logger';

const execAsync = promisify(exec);

export const getPythonVenvBinPath = (): string => {
  return process.platform === 'win32' ? path.join(PYTHON_VENV_DIR, 'Scripts') : path.join(PYTHON_VENV_DIR, 'bin');
};

/**
 * Gets the currently installed version of a Python library within the virtual environment.
 * @param library The name of the Python library.
 * @returns The version string or null if not found or an error occurs.
 */
export const getCurrentPythonLibVersion = async (library: string): Promise<string | null> => {
  try {
    const pythonBinPath = getPythonVenvBinPath();
    const command = `"${UV_EXECUTABLE}" pip show ${library}`;
    const { stdout } = await execAsync(command, {
      env: {
        ...process.env,
        VIRTUAL_ENV: PYTHON_VENV_DIR,
        PATH: `${pythonBinPath}${path.delimiter}${process.env.PATH}`,
      },
      windowsHide: true,
    });

    const versionMatch = stdout.match(/Version:\s*(\S+)/);
    if (versionMatch) {
      return versionMatch[1];
    }
    logger.warn(`Could not find version for library '${library}' in pip show output.`);
    return null;
  } catch (error) {
    // Log error but return null as expected for 'not found' or other issues
    logger.error(`Failed to get current version for library '${library}'`, {
      error,
    });
    return null;
  }
};

/**
 * Gets the latest available version of a Python library from the pip index.
 * @param library The name of the Python library.
 * @returns The latest version string or null if not found or an error occurs.
 */
export const getLatestPythonLibVersion = async (library: string): Promise<string | null> => {
  try {
    const pythonBinPath = getPythonVenvBinPath();
    const command = `"${PYTHON_COMMAND}" -m pip index versions ${library}`;
    const { stdout } = await execAsync(command, {
      env: {
        ...process.env,
        VIRTUAL_ENV: PYTHON_VENV_DIR,
        PATH: `${pythonBinPath}${path.delimiter}${process.env.PATH}`,
      },
      windowsHide: true,
    });

    const latestMatch = stdout.match(/LATEST:\s+(\S+)/);
    if (latestMatch) {
      return latestMatch[1];
    }
    logger.warn(`Could not find latest version for library '${library}' in pip index output.`);
    return null;
  } catch (error) {
    logger.error(`Failed to get latest available version for library '${library}'`, { error });
    return null;
  }
};

export const isFileIgnored = async (projectBaseDir: string, filePath: string): Promise<boolean> => {
  const gitignorePath = path.join(projectBaseDir, '.gitignore');

  if (!(await fileExists(gitignorePath))) {
    logger.debug('No .gitignore file found, not checking for ignored files');
    return false;
  }

  try {
    const gitignoreContent = await fsPromises.readFile(gitignorePath, 'utf8');
    const ig = ignore().add(gitignoreContent);

    // Make the path relative to the base directory
    const absolutePath = path.resolve(projectBaseDir, filePath);
    const relativePath = path.relative(projectBaseDir, absolutePath);

    logger.debug(`Checking if file is ignored: ${relativePath}, ${absolutePath}`);

    return ig.ignores(relativePath);
  } catch (error) {
    logger.debug(`Failed to check if file is ignored: ${filePath}`, { error });
    return false;
  }
};
