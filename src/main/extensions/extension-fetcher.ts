import fs from 'fs/promises';
import path from 'path';
import os from 'os';

import * as ts from 'typescript';
import { AvailableExtension } from '@common/types';
import { ExtensionMetadata } from '@common/extensions';

import logger from '@/logger';
import { execWithShellPath } from '@/utils/shell';

interface CacheEntry {
  timestamp: number;
  extensions: AvailableExtension[];
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class ExtensionFetcher {
  private cache = new Map<string, CacheEntry>();

  async getAvailableExtensions(repositories: string[], forceRefresh = false): Promise<AvailableExtension[]> {
    const allExtensions: AvailableExtension[] = [];

    for (const repoUrl of repositories) {
      try {
        const extensions = await this.fetchExtensionsFromRepo(repoUrl, forceRefresh);
        allExtensions.push(...extensions);
      } catch (error) {
        logger.error(`[ExtensionFetcher] Failed to fetch extensions from ${repoUrl}:`, error);
      }
    }

    return allExtensions;
  }

  private async fetchExtensionsFromRepo(repoUrl: string, forceRefresh: boolean): Promise<AvailableExtension[]> {
    const cached = this.cache.get(repoUrl);
    const now = Date.now();

    if (!forceRefresh && cached && now - cached.timestamp < CACHE_TTL_MS) {
      logger.debug(`[ExtensionFetcher] Using cached extensions for ${repoUrl}`);
      return cached.extensions;
    }

    try {
      const extensions = await this.fetchExtensionsViaGitClone(repoUrl);

      this.cache.set(repoUrl, {
        timestamp: now,
        extensions,
      });

      logger.info(`[ExtensionFetcher] Fetched ${extensions.length} extension(s) from ${repoUrl}`);
      return extensions;
    } catch (error) {
      if (cached) {
        logger.warn(`[ExtensionFetcher] Fetch failed, returning stale cache for ${repoUrl}`);
        return cached.extensions;
      }
      throw error;
    }
  }

  private async fetchExtensionsViaGitClone(repoUrl: string): Promise<AvailableExtension[]> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ext-repo-'));

    try {
      const cloneUrl = this.getCloneUrl(repoUrl);
      if (!cloneUrl) {
        throw new Error(`Invalid repository URL: ${repoUrl}`);
      }

      logger.debug(`[ExtensionFetcher] Cloning repository to ${tempDir}`);
      await execWithShellPath(`git clone --depth 1 "${cloneUrl}" "${tempDir}"`, {
        cwd: os.tmpdir(),
      });

      const extensionsPath = this.getExtensionsPath(repoUrl, tempDir);
      const extensions = await this.scanForExtensions(extensionsPath, repoUrl);

      return extensions;
    } finally {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        logger.warn(`[ExtensionFetcher] Failed to cleanup temp directory ${tempDir}:`, cleanupError);
      }
    }
  }

  private getCloneUrl(webUrl: string): string | null {
    try {
      const url = new URL(webUrl);
      if (url.hostname !== 'github.com') {
        return null;
      }

      const pathParts = url.pathname.split('/').filter(Boolean);
      if (pathParts.length < 2) {
        return null;
      }

      const owner = pathParts[0];
      const repo = pathParts[1];
      return `https://github.com/${owner}/${repo}.git`;
    } catch {
      return null;
    }
  }

  private getExtensionsPath(repoUrl: string, clonedRepoPath: string): string {
    try {
      const url = new URL(repoUrl);
      const pathParts = url.pathname.split('/').filter(Boolean);

      if (pathParts.length > 4 && pathParts[2] === 'tree') {
        const extensionPath = pathParts.slice(4).join('/');
        return path.join(clonedRepoPath, extensionPath);
      }

      return clonedRepoPath;
    } catch {
      return clonedRepoPath;
    }
  }

  private async scanForExtensions(extensionsPath: string, repoUrl: string): Promise<AvailableExtension[]> {
    const extensions: AvailableExtension[] = [];

    try {
      const entries = await fs.readdir(extensionsPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const indexPathTs = path.join(extensionsPath, entry.name, 'index.ts');
          const indexPathJs = path.join(extensionsPath, entry.name, 'index.js');

          let indexFile: string | null = null;
          if (await this.fileExists(indexPathTs)) {
            indexFile = indexPathTs;
          } else if (await this.fileExists(indexPathJs)) {
            indexFile = indexPathJs;
          }

          if (indexFile) {
            const metadata = await this.extractMetadataFromLocalFile(indexFile);
            const hasDeps = await this.fileExists(path.join(extensionsPath, entry.name, 'package.json'));

            if (metadata) {
              extensions.push({
                ...metadata,
                id: entry.name,
                type: 'folder',
                folder: entry.name,
                repositoryUrl: repoUrl,
                hasDependencies: hasDeps,
              });
            }
          }
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
          const filePath = path.join(extensionsPath, entry.name);
          const metadata = await this.extractMetadataFromLocalFile(filePath);

          if (metadata) {
            extensions.push({
              ...metadata,
              id: entry.name.replace(/\.(ts|js)$/, ''),
              type: 'single',
              file: entry.name,
              repositoryUrl: repoUrl,
            });
          }
        }
      }
    } catch (error) {
      logger.error(`[ExtensionFetcher] Failed to scan directory ${extensionsPath}:`, error);
    }

    return extensions;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async extractMetadataFromLocalFile(filePath: string): Promise<Omit<AvailableExtension, 'id' | 'type' | 'repositoryUrl'> | null> {
    try {
      const metadata = this.getStaticMetadata(filePath);

      if (!metadata) {
        logger.error(`[ExtensionFetcher] No metadata found in ${filePath}`);
        return null;
      }

      return {
        name: metadata.name,
        version: metadata.version,
        description: metadata.description,
        author: metadata.author,
      };
    } catch (error) {
      logger.error(`[ExtensionFetcher] Failed to extract metadata from ${filePath}:`, error);
      return null;
    }
  }

  private getStaticMetadata(filePath: string): ExtensionMetadata | null {
    const program = ts.createProgram([filePath], {
      allowJs: true,
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
    });

    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) {
      return null;
    }

    let metadata: ExtensionMetadata | null = null;

    const visitor = (node: ts.Node) => {
      if (
        ts.isPropertyDeclaration(node) &&
        node.modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword) &&
        ts.isIdentifier(node.name) &&
        node.name.text === 'metadata'
      ) {
        if (node.initializer) {
          let objectLiteral: ts.ObjectLiteralExpression | null = null;

          if (ts.isObjectLiteralExpression(node.initializer)) {
            objectLiteral = node.initializer;
          } else if (ts.isIdentifier(node.initializer)) {
            const variableName = node.initializer.text;
            objectLiteral = this.findVariableDeclaration(sourceFile, variableName);
          }

          if (objectLiteral) {
            const parsed = this.parseObjectLiteral(objectLiteral);
            if (parsed && typeof parsed.name === 'string' && typeof parsed.version === 'string') {
              metadata = parsed as unknown as ExtensionMetadata;
            }
          }
        }
      }
      ts.forEachChild(node, visitor);
    };

    visitor(sourceFile);
    return metadata;
  }

  private findVariableDeclaration(sourceFile: ts.SourceFile, variableName: string): ts.ObjectLiteralExpression | null {
    let objectLiteral: ts.ObjectLiteralExpression | null = null;

    const visitor = (node: ts.Node) => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === variableName &&
        node.initializer &&
        ts.isObjectLiteralExpression(node.initializer)
      ) {
        objectLiteral = node.initializer;
      }
      ts.forEachChild(node, visitor);
    };

    visitor(sourceFile);
    return objectLiteral;
  }

  private parseObjectLiteral(node: ts.ObjectLiteralExpression): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const property of node.properties) {
      if (ts.isPropertyAssignment(property)) {
        const name = ts.isIdentifier(property.name) ? property.name.text : ts.isStringLiteral(property.name) ? property.name.text : null;

        if (name) {
          result[name] = this.parsePropertyValue(property.initializer);
        }
      }
    }

    return result;
  }

  private parsePropertyValue(node: ts.Node): unknown {
    if (ts.isStringLiteral(node)) {
      return node.text;
    } else if (ts.isNumericLiteral(node)) {
      return Number(node.text);
    } else if (node.kind === ts.SyntaxKind.TrueKeyword) {
      return true;
    } else if (node.kind === ts.SyntaxKind.FalseKeyword) {
      return false;
    } else if (node.kind === ts.SyntaxKind.NullKeyword) {
      return null;
    } else if (ts.isArrayLiteralExpression(node)) {
      return node.elements.map((elem) => this.parsePropertyValue(elem));
    } else if (ts.isObjectLiteralExpression(node)) {
      return this.parseObjectLiteral(node);
    }

    return undefined;
  }

  private convertToGitHubRawUrl(webUrl: string): string | null {
    try {
      // Match URL with specific path: github.com/{owner}/{repo}/tree/{branch}/{path}
      const matchWithPath = webUrl.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)/);
      if (matchWithPath) {
        const [, owner, repo, branch, path] = matchWithPath;
        return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
      }

      // Match repository root URL: github.com/{owner}/{repo}
      const matchRoot = webUrl.match(/github\.com\/([^/]+)\/([^/]+)\/?$/);
      if (matchRoot) {
        const [, owner, repo] = matchRoot;
        return `https://raw.githubusercontent.com/${owner}/${repo}/main`;
      }

      return null;
    } catch {
      return null;
    }
  }

  getRawUrl(webUrl: string): string | null {
    return this.convertToGitHubRawUrl(webUrl);
  }
}
