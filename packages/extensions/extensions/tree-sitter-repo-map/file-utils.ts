import * as path from 'path';

import { glob } from 'glob';
import { simpleGit } from 'simple-git';

import logger from './logger.js';

const DEFAULT_IGNORE_PATTERNS = [
  'node_modules/**',
  '.git/**',
  'dist/**',
  'build/**',
  '.next/**',
  'out/**',
  'coverage/**',
  '*.min.js',
  '*.min.css',
  '.DS_Store',
  'Thumbs.db',
  '*.log',
  '*.lock',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
];

const isGitRepository = async (baseDir: string): Promise<boolean> => {
  try {
    const git = simpleGit(baseDir);
    await git.revparse(['--git-dir']);
    return true;
  } catch {
    return false;
  }
};

const getAllFilesFromGit = async (baseDir: string): Promise<string[]> => {
  try {
    const git = simpleGit(baseDir);
    const result = await git.raw(['ls-files', '-z']);
    const files = result.split('\0').filter(Boolean);
    logger.debug(`Retrieved ${files.length} tracked files from Git`);
    // Return absolute paths
    return files.map((file) => path.resolve(baseDir, file));
  } catch (gitError) {
    logger.warn('Failed to get tracked files from Git, falling back to filesystem', gitError);
    return [];
  }
};

const getAllFilesFromFS = async (baseDir: string, ignore: string[]): Promise<string[]> => {
  try {
    const pattern = path.join(baseDir, '**/*').replace(/\\/g, '/');
    const files = await glob(pattern, {
      nodir: true,
      absolute: true,
      dot: false,
      ignore,
    });

    logger.debug(`Retrieved ${files.length} files from filesystem`);
    return files;
  } catch (error) {
    logger.error('Failed to get files from filesystem:', error);
    return [];
  }
};

const matchesPattern = (filePath: string, pattern: string): boolean => {
  // Convert glob pattern to regex for simple matching
  const regexPattern = pattern
    .replace(/\*\*/g, '<<DOUBLE_STAR>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<DOUBLE_STAR>>/g, '.*')
    .replace(/\?/g, '[^/]');
  const regex = new RegExp(regexPattern);
  return regex.test(filePath);
};

const filterByExcludePatterns = (files: string[], excludePatterns: string[], baseDir: string): string[] => {
  return files.filter((file) => {
    const relative = path.relative(baseDir, file).replace(/\\/g, '/');
    return !excludePatterns.some((pattern) => matchesPattern(relative, pattern));
  });
};

export const getAllFiles = async (baseDir: string, excludePatterns: string[] = []): Promise<string[]> => {
  const allIgnorePatterns = [...DEFAULT_IGNORE_PATTERNS, ...excludePatterns];

  try {
    // Try git first if it's a git repository
    if (await isGitRepository(baseDir)) {
      const gitFiles = await getAllFilesFromGit(baseDir);
      if (gitFiles.length > 0) {
        // Filter by exclude patterns
        return filterByExcludePatterns(gitFiles, excludePatterns, baseDir);
      }
    }

    // Fallback to filesystem scanning
    const fsFiles = await getAllFilesFromFS(baseDir, allIgnorePatterns);

    // Filter by exclude patterns
    return filterByExcludePatterns(fsFiles, excludePatterns, baseDir);
  } catch (error) {
    logger.error('Failed to get files:', error);
    return [];
  }
};
