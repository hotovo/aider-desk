import fs from 'fs/promises';
import path from 'path';

import { v4 as uuidv4 } from 'uuid';
import { ContextFile, ContextMessage, TaskContext, TaskData } from '@common/types';
import { fileExists } from '@common/utils';

import { AIDER_DESK_DIR, AIDER_DESK_TASKS_DIR } from '@/constants';
import logger from '@/logger';
import { Project } from '@/project';

const SESSIONS_DIR = path.join(AIDER_DESK_DIR, 'sessions');
const TASKS_DIR = AIDER_DESK_TASKS_DIR;

interface SessionData {
  version: number;
  contextMessages: ContextMessage[];
  contextFiles: ContextFile[];
}

/**
 * @deprecated this will be removed in 0.40.0
 *
 * Migrates legacy sessions to the new task system.
 *
 * This function:
 * 1. Checks if sessions directory exists
 * 2. Reads all session JSON files
 * 3. Creates tasks for each session
 * 4. Deletes the sessions directory after successful migration
 */
export const migrateSessionsToTasks = async (project: Project): Promise<void> => {
  const sessionsDirPath = path.join(project.baseDir, SESSIONS_DIR);
  const tasksDirPath = path.join(project.baseDir, TASKS_DIR);

  try {
    // Check if sessions directory exists
    if (!(await fileExists(sessionsDirPath))) {
      logger.debug('No sessions directory found, skipping migration', {
        baseDir: project.baseDir,
        sessionsDir: sessionsDirPath,
      });
      return;
    }

    logger.info('Starting sessions to tasks migration', {
      baseDir: project.baseDir,
      sessionsDir: sessionsDirPath,
    });

    // Ensure tasks directory exists
    await fs.mkdir(tasksDirPath, { recursive: true });

    // Read all files in sessions directory
    const sessionFiles = await fs.readdir(sessionsDirPath);
    const jsonFiles = sessionFiles.filter((file) => file.endsWith('.json'));

    if (jsonFiles.length === 0) {
      logger.info('No JSON session files found, cleaning up empty sessions directory');
      await fs.rm(sessionsDirPath, { recursive: true, force: true });
      return;
    }

    logger.info(`Found ${jsonFiles.length} session files to migrate`, {
      files: jsonFiles,
    });

    // Process each session file
    for (const sessionFile of jsonFiles) {
      try {
        await migrateSessionFile(project, sessionsDirPath, tasksDirPath, sessionFile);
      } catch (error) {
        logger.error('Failed to migrate session file', {
          baseDir: project.baseDir,
          sessionFile,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Delete the entire sessions directory after successful migration
    await fs.rm(sessionsDirPath, { recursive: true, force: true });

    logger.info('Sessions to tasks migration completed successfully', {
      baseDir: project.baseDir,
      migratedFiles: jsonFiles.length,
    });
  } catch (error) {
    logger.error('Failed to migrate sessions to tasks', {
      baseDir: project.baseDir,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

/**
 * Migrates a single session file to a task.
 */
const migrateSessionFile = async (project: Project, sessionsDirPath: string, tasksDirPath: string, sessionFile: string): Promise<void> => {
  const sessionFilePath = path.join(sessionsDirPath, sessionFile);
  const isAutosaved = sessionFile === '.autosaved.json';

  try {
    // Read session data
    const sessionContent = await fs.readFile(sessionFilePath, 'utf8');
    const sessionData: SessionData = JSON.parse(sessionContent);

    // Determine taskId and task folder name
    let taskId: string;
    if (isAutosaved) {
      taskId = 'autosaved';
    } else {
      taskId = uuidv4();
    }

    // Create task directory
    const taskDirPath = path.join(tasksDirPath, taskId);
    await fs.mkdir(taskDirPath, { recursive: true });

    // Extract name from session file (without .json extension)
    const name = isAutosaved ? 'autosaved' : sessionFile.replace(/\.json$/, '');

    const settings: TaskData = {
      id: taskId,
      baseDir: project.baseDir,
      name,
      createdAt: (await fs.stat(sessionFilePath)).mtime.toISOString(),
      updatedAt: (await fs.stat(sessionFilePath)).mtime.toISOString(),
      agentTotalCost: 0,
      aiderTotalCost: 0,
    };

    // Write settings.json file
    const settingsFilePath = path.join(taskDirPath, 'settings.json');
    await fs.writeFile(settingsFilePath, JSON.stringify(settings, null, 2), 'utf8');

    // Create TaskContext by merging session data with required properties
    const taskContext: TaskContext = {
      // Merge any other properties from session data, but don't override required ones
      ...sessionData,
    };

    // Write context.json file
    const contextFilePath = path.join(taskDirPath, 'context.json');
    await fs.writeFile(contextFilePath, JSON.stringify(taskContext, null, 2), 'utf8');

    logger.info('Migrated session to task', {
      baseDir: project.baseDir,
      sessionFile,
      taskId,
      taskDir: taskDirPath,
      name,
    });
  } catch (error) {
    logger.error('Failed to migrate session file', {
      baseDir: project.baseDir,
      sessionFile,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};
