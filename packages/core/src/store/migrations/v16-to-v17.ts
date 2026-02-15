/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs/promises';
import path from 'path';
import { homedir } from 'os';

import { SettingsData, AgentProfile } from '@aider-desk/common/types';

import { AIDER_DESK_AGENTS_DIR } from '@/constants';
import logger from '@/logger';
import { deriveDirName } from '@/utils';

const getExistingDirNames = async (agentsDir: string): Promise<Set<string>> => {
  const dirNames = new Set<string>();

  try {
    const entries = await fs.readdir(agentsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        dirNames.add(entry.name);
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return dirNames;
};

const saveProfileToFile = async (profile: any, filePath: string): Promise<void> => {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(profile, null, 2), 'utf-8');
  } catch (err) {
    logger.error(`Failed to save agent profile to ${filePath}: ${err}`);
    throw err;
  }
};

export const migrateSettingsV16toV17 = async (settings: SettingsData): Promise<SettingsData> => {
  logger.info('Migrating agent profiles from settings to file-based system');

  // Create global agents directory
  const globalAgentsDir = path.join(homedir(), AIDER_DESK_AGENTS_DIR);

  try {
    await fs.mkdir(globalAgentsDir, { recursive: true });
  } catch (err) {
    logger.error(`Failed to create global agents directory ${globalAgentsDir}: ${err}`);
    return settings;
  }

  // Migrate existing agent profiles from settings to directory structure
  const agentProfiles = (settings as any).agentProfiles as AgentProfile[] | undefined;
  if (agentProfiles && agentProfiles.length > 0) {
    logger.info(`Migrating ${agentProfiles.length} agent profiles to directory structure`);

    // Get existing directory names for collision handling
    const existingDirNames = await getExistingDirNames(globalAgentsDir);

    for (const profile of agentProfiles) {
      // Derive unique directory name from profile name
      const dirName = deriveDirName(profile.name, existingDirNames);
      const profileDir = path.join(globalAgentsDir, dirName);
      const configPath = path.join(profileDir, 'config.json');

      // Check if directory already exists (don't overwrite existing directories)
      try {
        await fs.access(configPath);
        logger.info(`Agent profile directory already exists, skipping migration for: ${profile.id}`);
      } catch {
        // Directory doesn't exist, create it
        await fs.mkdir(profileDir, { recursive: true });
        await saveProfileToFile(profile, configPath);
        existingDirNames.add(dirName); // Add to set to avoid collisions in same loop
        logger.info(`Migrated agent profile to directory: ${profile.id} -> ${dirName}`);
      }
    }

    // Create order.json file using profile IDs
    try {
      const orderMap: Record<string, number> = {};

      agentProfiles.forEach((profile, index) => {
        orderMap[profile.id] = index;
      });

      await fs.writeFile(path.join(globalAgentsDir, 'order.json'), JSON.stringify(orderMap, null, 2), 'utf-8');
    } catch (err) {
      logger.error(`Failed to create order.json file: ${err}`);
    }
  }

  logger.info('Agent profiles migration completed');
  // keeping the agentProfiles in settings for now, just in case user needs to revert the version
  return settings;
};
