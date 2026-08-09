import fs from 'fs/promises';
import path from 'path';

import { McpServerConfig, SettingsData } from '@common/types';
import { fileExists } from '@common/utils';

import { AIDER_DESK_HOME_DIR, AIDER_DESK_MCP_SERVERS_FILE } from '@/constants';
import logger from '@/logger';

export const migrateSettingsV21toV22 = async (settings: SettingsData): Promise<SettingsData> => {
  logger.info('Migrating MCP servers from settings to file-based system');

  const globalMcpServersPath = path.join(AIDER_DESK_HOME_DIR, AIDER_DESK_MCP_SERVERS_FILE);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mcpServers = (settings as any).mcpServers as Record<string, McpServerConfig> | undefined;

  if (!mcpServers || Object.keys(mcpServers).length === 0) {
    logger.info('No MCP servers found in settings, skipping migration');
    return settings;
  }

  if (await fileExists(globalMcpServersPath)) {
    logger.info('Global MCP servers file already exists, skipping migration');
    return settings;
  }

  try {
    await fs.mkdir(AIDER_DESK_HOME_DIR, { recursive: true });
    await fs.writeFile(globalMcpServersPath, JSON.stringify({ mcpServers }, null, 2), 'utf-8');
    logger.info(`Migrated ${Object.keys(mcpServers).length} MCP server(s) to ${globalMcpServersPath}`);
  } catch (err) {
    logger.error(`Failed to migrate MCP servers to file: ${err}`);
  }

  // keeping mcpServers in settings for now, just in case user needs to revert the version
  return settings;
};
