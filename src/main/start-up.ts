import * as fs from 'fs';

import { PythonDependenciesInstaller } from '@/python-dependencies-installer';
import { AIDER_DESK_DATA_DIR, SETUP_COMPLETE_FILENAME, PYTHON_VENV_DIR } from '@/constants';
import logger from '@/logger';

export type UpdateProgressData = {
  step: string;
  message: string;
  info?: string;
};

export type UpdateProgressFunction = (data: UpdateProgressData) => void;

/**
 * Performs a fast startup check and kicks off background Python dependency installation.
 *
 * This function no longer blocks on pip installs. It returns quickly after checking
 * whether setup has been completed previously. The actual installation happens
 * asynchronously in the PythonDependenciesInstaller singleton.
 *
 * @param pythonInstaller The singleton PythonDependenciesInstaller instance
 * @param updateProgress Optional callback for progress UI (splash screen etc.)
 * @returns true if the app should proceed (always true now — errors are handled async)
 */
export const performStartUp = async (pythonInstaller: PythonDependenciesInstaller, updateProgress?: UpdateProgressFunction): Promise<boolean> => {
  logger.info('Starting AiderDesk setup process (fast path)');

  if (fs.existsSync(SETUP_COMPLETE_FILENAME) && fs.existsSync(PYTHON_VENV_DIR)) {
    logger.info('Setup previously completed, will run update check in background');
    updateProgress?.({
      step: 'Verifying',
      message: 'Verifying dependencies...',
    });
    // Kick off background update check — don't await it
    pythonInstaller.ensureInstalled();
    return true;
  }

  // First-time setup needed — kick off in background
  logger.info('First-time setup needed, starting background installation');
  updateProgress?.({
    step: 'Initial Setup',
    message: 'Initializing environment...',
  });

  // Ensure data dir exists (fast, synchronous)
  if (!fs.existsSync(AIDER_DESK_DATA_DIR)) {
    logger.info(`Creating AiderDesk directory: ${AIDER_DESK_DATA_DIR}`);
    fs.mkdirSync(AIDER_DESK_DATA_DIR, { recursive: true });
  }

  // Kick off full installation — fire and forget
  pythonInstaller.ensureInstalled();

  return true;
};
