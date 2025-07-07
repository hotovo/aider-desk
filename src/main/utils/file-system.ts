import * as fs from 'fs';
import * as path from 'path';
import fsPromises from 'fs/promises';

import ignore from 'ignore';
import { fileExists } from '@common/utils';

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
    return fs.existsSync(path);
  } catch (error) {
    logger.error('Error checking if path exists:', { error });
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
