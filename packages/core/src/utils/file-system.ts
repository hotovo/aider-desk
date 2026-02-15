import * as fs from 'fs';
import * as path from 'path';

import { simpleGit } from 'simple-git';
import filenamifyImport from 'filenamify';
import slugify from 'slugify';
import { glob } from 'glob';

import logger from '@/logger';
// @ts-expect-error filenamify is not typed properly
const filenamify = filenamifyImport.default;

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

const isGitRepository = async (baseDir: string): Promise<boolean> => {
  try {
    const git = simpleGit(baseDir);
    await git.revparse(['--git-dir']);
    return true;
  } catch {
    return false;
  }
};

const getAllFilesFromFS = async (baseDir: string, ignore: string[] = []): Promise<string[]> => {
  try {
    const pattern = path.join(baseDir, '**/*').replace(/\\/g, '/');
    const files = await glob(pattern, {
      nodir: true,
      absolute: false,
      dot: true,
      ignore,
    });

    // Convert to relative paths
    const relativeFiles = files.map((file) => path.relative(baseDir, file).replace(/\\/g, '/'));

    logger.info('Retrieved files from filesystem', { count: relativeFiles.length, baseDir, ignore });
    return relativeFiles;
  } catch (error) {
    logger.error('Failed to get files from filesystem', { error, baseDir });
    return [];
  }
};

const getIgnoreGlobPatterns = async (gitignorePath: string): Promise<string[]> => {
  const ignore: string[] = [];

  if (fs.existsSync(gitignorePath)) {
    try {
      const gitignoreContent = await fs.promises.readFile(gitignorePath, 'utf8');
      const rawPatterns = gitignoreContent
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => Boolean(line) && !line.startsWith('#'))
        .map((line) => line.replace(/\\/g, '/'));

      const baseDir = path.dirname(gitignorePath);

      for (const pattern of rawPatterns) {
        if (pattern.endsWith('/')) {
          ignore.push(`${pattern}**`);
          continue;
        }

        const absCandidate = path.resolve(baseDir, pattern);

        try {
          const stats = await fs.promises.stat(absCandidate);
          if (stats.isDirectory()) {
            ignore.push(`${pattern}/**`);
            continue;
          }
        } catch {
          // ignore
        }

        ignore.push(pattern);
      }
    } catch (error) {
      logger.warn('Failed to read .gitignore, continuing without it', { error, gitignorePath });
    }
  }

  return ignore;
};

export const getAllFiles = async (baseDir: string, useGit = true): Promise<string[]> => {
  try {
    if (useGit) {
      // Try to use git first
      try {
        const git = simpleGit(baseDir);
        const result = await git.raw(['ls-files', '-z']);
        const files = result.split('\0').filter(Boolean);
        logger.debug('Retrieved tracked files from Git', { count: files.length, baseDir });
        return files;
      } catch (gitError) {
        logger.warn('Failed to get tracked files from Git, falling back to filesystem', { error: gitError, baseDir });
      }
    }

    // use filesystem when useGit is false or git fails
    const gitignorePath = path.join(baseDir, '.gitignore');
    const files = await getAllFilesFromFS(baseDir, [...(await getIgnoreGlobPatterns(gitignorePath)), '.git/**']);

    // If it's a git repo, filter out ignored files
    if (await isGitRepository(baseDir)) {
      const filteredFiles = await filterIgnoredFiles(baseDir, files);
      logger.debug('Filtered gitignored files from filesystem results', {
        original: files.length,
        filtered: filteredFiles.length,
        baseDir,
      });
      return filteredFiles;
    }

    return files;
  } catch (error) {
    logger.error('Failed to get files', { error, baseDir, useGit });
    return [];
  }
};

export const deriveDirName = (name: string, existingDirNames: Set<string>): string => {
  // First slugify the name to create a clean URL-friendly slug
  const slug = slugify(name, {
    lower: true,
    strict: true, // remove special characters except for hyphens and underscores
    trim: true, // trim leading and trailing whitespace
  });

  // Then filenamify to ensure it's safe as a directory name across all platforms
  const baseDirName = filenamify(slug, {
    replacement: '-', // use hyphens as replacement for invalid characters
    maxLength: 100, // reasonable length limit
  });

  let dirName = baseDirName;
  let suffix = 1;

  while (existingDirNames.has(dirName)) {
    suffix++;
    dirName = `${baseDirName}-${suffix}`;
  }

  return dirName;
};

/**
 * Validate if a file path is potentially valid for the current project
 *
 * @param filePath - File path to validate
 * @param taskDir - Task directory to check against
 * @returns True if file path could be valid for project
 */
export const isValidProjectFile = (filePath: string, taskDir: string): boolean => {
  // Convert to absolute path for validation
  const absolutePath = path.resolve(taskDir, filePath);

  // Check if resolved path is still within task directory
  const normalizedTaskDir = path.resolve(taskDir);
  const normalizedAbsolutePath = path.resolve(absolutePath);

  return normalizedAbsolutePath.startsWith(normalizedTaskDir);
};
