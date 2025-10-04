import * as fs from 'fs';
import * as path from 'path';

import { simpleGit } from 'simple-git';

import logger from '@/logger';

export const getFilePathSuggestions = async (currentPath: string, directoriesOnly = false): Promise<string[]> => {
  try {
    let dirPath = currentPath;
    let searchPattern = '';

    // Extract directory and search pattern
    if (currentPath && !currentPath.endsWith(path.sep)) {
      dirPath = path.dirname(currentPath);
      searchPattern = path.basename(currentPath).toLowerCase();
    }

    // Fallback to parent directory if current doesn't exist
    if (!fs.existsSync(dirPath)) {
      dirPath = path.dirname(dirPath);
    }

    // Ensure dirPath is a directory
    const stats = await fs.promises.stat(dirPath);
    if (!stats.isDirectory()) {
      logger.error('Provided path is not a directory:', { path: dirPath });
      return [];
    }

    // Get directory contents
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    // Filter entries based on type and search pattern
    return entries
      .filter((entry) => (!directoriesOnly || entry.isDirectory()) && (!searchPattern || entry.name.toLowerCase().startsWith(searchPattern)))
      .map((entry) => path.join(dirPath, entry.name))
      .filter((entryPath) => entryPath !== currentPath)
      .sort();
  } catch (error) {
    logger.error('Error getting path autocompletion:', { error });
    return [];
  }
};

export const isProjectPath = async (path: string): Promise<boolean> => {
  try {
    const st = await fs.promises.stat(path);
    if (!st.isDirectory()) {
      logger.error('Provided path is not a directory:', { path: path });
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

export const isValidPath = async (baseDir: string, filePath: string): Promise<boolean> => {
  try {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(baseDir, filePath);
    const stats = await fs.promises.stat(fullPath);

    return stats.isDirectory() || stats.isFile();
  } catch {
    return false;
  }
};

export const isDirectory = async (path: string): Promise<boolean> => {
  try {
    const stats = await fs.promises.stat(path);
    return stats.isDirectory();
  } catch {
    return false;
  }
};

export const isFileIgnored = async (projectBaseDir: string, filePath: string): Promise<boolean> => {
  try {
    const git = simpleGit(projectBaseDir);

    // Make the path relative to the base directory for git check-ignore
    const absolutePath = path.resolve(projectBaseDir, filePath);
    const relativePath = path.relative(projectBaseDir, absolutePath);

    logger.debug(`Checking if file is ignored: ${relativePath}`);

    const ignored = await git.checkIgnore(relativePath);
    return ignored.length > 0;
  } catch (error) {
    logger.error(`Failed to check if file is ignored: ${filePath}`, { error });
    return false;
  }
};

export const filterIgnoredFiles = async (projectBaseDir: string, filePaths: string[]): Promise<string[]> => {
  try {
    const git = simpleGit(projectBaseDir);

    // Convert all file paths to relative paths for git check-ignore
    const relativePaths = filePaths.map((filePath) => {
      const absolutePath = path.resolve(projectBaseDir, filePath);
      return path.relative(projectBaseDir, absolutePath);
    });

    logger.debug(`Checking if ${relativePaths.length} files are ignored`);

    const CHUNK_SIZE = 100;
    const ignoredSet = new Set<string>();

    // Process files in chunks of max 100
    for (let i = 0; i < relativePaths.length; i += CHUNK_SIZE) {
      const chunk = relativePaths.slice(i, i + CHUNK_SIZE);
      const ignored = await git.checkIgnore(chunk);
      ignored.forEach((file) => ignoredSet.add(file));
    }

    // Return only files that are not ignored
    return filePaths.filter((_, index) => {
      const relativePath = relativePaths[index];
      const isIgnored = ignoredSet.has(relativePath);
      if (isIgnored) {
        logger.debug(`File is ignored: ${relativePath}`);
      }
      return !isIgnored;
    });
  } catch (error) {
    logger.error('Failed to filter ignored files', { error });
    // Return all files if git check fails (safer default)
    return filePaths;
  }
};

export const getAllFiles = async (baseDir: string): Promise<string[]> => {
  try {
    const git = simpleGit(baseDir);
    const result = await git.raw(['ls-files']);
    const files = result.trim().split('\n').filter(Boolean);
    logger.debug('Retrieved tracked files from Git', { count: files.length, baseDir });
    return files;
  } catch (error) {
    logger.warn('Failed to get tracked files from Git', { error, baseDir });
    return []; // Return empty array if Git command fails
  }
};
