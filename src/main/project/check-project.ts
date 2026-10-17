import fs from 'fs/promises';
import path from 'path';

import { ProjectCheckResult } from '@common/types';

import { AIDER_DESK_AGENTS_DIR, AIDER_DESK_DIR, AIDER_DESK_EXTENSIONS_DIR, AIDER_DESK_MCP_SERVERS_FILE } from '@/constants';

const isMissing = (error: unknown): boolean => error instanceof Error && 'code' in error && error.code === 'ENOENT';

const readDirectory = async (directory: string): Promise<string[]> => {
  try {
    return (await fs.readdir(directory)).sort();
  } catch (error) {
    if (isMissing(error)) {
      return [];
    }
    throw error;
  }
};

const exists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.stat(filePath);
    return true;
  } catch (error) {
    if (isMissing(error)) {
      return false;
    }
    throw error;
  }
};

export const checkProject = async (baseDir: string): Promise<ProjectCheckResult> => {
  const result: ProjectCheckResult = { agents: [], mcpServers: [], extensions: [] };
  const agentsDir = path.join(baseDir, AIDER_DESK_AGENTS_DIR);
  for (const name of await readDirectory(agentsDir)) {
    const agentPath = path.join(agentsDir, name);
    if ((await fs.stat(agentPath)).isDirectory()) {
      result.agents.push({ name, path: path.relative(baseDir, agentPath) });
    }
  }

  const mcpPath = path.join(baseDir, AIDER_DESK_DIR, AIDER_DESK_MCP_SERVERS_FILE);
  if (await exists(mcpPath)) {
    const config: unknown = JSON.parse(await fs.readFile(mcpPath, 'utf-8'));
    if (typeof config !== 'object' || config === null || Array.isArray(config)) {
      throw new Error(`Invalid MCP configuration: ${mcpPath}`);
    }
    const servers = 'mcpServers' in config ? config.mcpServers : {};
    if (typeof servers !== 'object' || servers === null || Array.isArray(servers)) {
      throw new Error(`Invalid MCP servers: ${mcpPath}`);
    }
    result.mcpServers = Object.keys(servers)
      .sort()
      .map((name) => ({ name, path: path.relative(baseDir, mcpPath) }));
  }

  const extensionsDir = path.join(baseDir, AIDER_DESK_EXTENSIONS_DIR);
  for (const name of await readDirectory(extensionsDir)) {
    const extensionPath = path.join(extensionsDir, name);
    const stat = await fs.stat(extensionPath);
    if (stat.isDirectory()) {
      for (const entry of ['index.ts', 'index.js']) {
        const entryPath = path.join(extensionPath, entry);
        if (await exists(entryPath)) {
          result.extensions.push({ name, path: path.relative(baseDir, entryPath) });
          break;
        }
      }
    } else if (stat.isFile() && /\.(ts|js)$/.test(name)) {
      result.extensions.push({ name, path: path.relative(baseDir, extensionPath) });
    }
  }
  return result;
};
