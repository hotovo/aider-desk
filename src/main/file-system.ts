import * as fs from 'fs';
import * as path from 'path';

import logger from './logger';

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
    return fs.existsSync(path);
  } catch (error) {
    logger.error('Error checking if path exists:', { error });
    return false;
  }
};

export const isPathWithinBase = async (baseDir: string, filePath: string): Promise<boolean> => {
  try {
    const normalizedBaseDir = path.resolve(baseDir) + path.sep;
    const normalizedFilePath = path.resolve(filePath);
    return normalizedFilePath.startsWith(normalizedBaseDir);
  } catch (error) {
    logger.error('Error checking if path is within base directory:', { error });
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
