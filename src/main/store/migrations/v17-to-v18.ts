import fs from 'fs/promises';
import path from 'path';
import { homedir } from 'os';

import { SettingsData } from '@common/types';
import { DEFAULT_AGENT_PROFILE } from '@common/agent';

import { AIDER_DESK_AGENTS_DIR } from '@/constants';
import logger from '@/logger';

const getAgentsDirs = async (): Promise<string[]> => {
  const dirs: string[] = [];
  const globalAgentsDir = path.join(homedir(), AIDER_DESK_AGENTS_DIR);

  try {
    await fs.access(globalAgentsDir);
    const entries = await fs.readdir(globalAgentsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        dirs.push(path.join(globalAgentsDir, entry.name));
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return dirs;
};

export const migrateSettingsV17toV18 = async (settings: SettingsData): Promise<SettingsData> => {
  logger.info('Migrating agent profiles to ensure toolApprovals and toolSettings are properly set');

  const agentDirs = await getAgentsDirs();

  if (agentDirs.length === 0) {
    logger.info('No agent profile directories found, skipping migration');
    return settings;
  }

  let fixedCount = 0;

  for (const agentDir of agentDirs) {
    const configPath = path.join(agentDir, 'config.json');

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const profile = JSON.parse(content);

      let needsSave = false;

      // Ensure toolApprovals is properly set
      if (!profile.toolApprovals || Object.keys(profile.toolApprovals).length === 0) {
        profile.toolApprovals = { ...DEFAULT_AGENT_PROFILE.toolApprovals };
        needsSave = true;
        logger.info(`Added missing toolApprovals to profile: ${profile.id}`);
      }

      // Ensure toolSettings is properly set
      if (!profile.toolSettings || Object.keys(profile.toolSettings).length === 0) {
        profile.toolSettings = { ...DEFAULT_AGENT_PROFILE.toolSettings };
        needsSave = true;
        logger.info(`Added missing toolSettings to profile: ${profile.id}`);
      }

      if (needsSave) {
        await fs.writeFile(configPath, JSON.stringify(profile, null, 2), 'utf-8');
        fixedCount++;
        logger.info(`Fixed agent profile: ${profile.id}`);
      }
    } catch (err) {
      // Profile doesn't exist or can't be read
      logger.debug(`Could not process agent directory ${agentDir}: ${err}`);
    }
  }

  logger.info(`Migration complete. Fixed ${fixedCount} agent profiles`);

  return settings;
};
