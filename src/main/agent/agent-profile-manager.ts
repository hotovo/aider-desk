import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';

import { FSWatcher, watch } from 'chokidar';
import { debounce } from 'lodash';
import { DEFAULT_AGENT_PROFILE, DEFAULT_AGENT_PROFILES } from '@common/agent';
import { fileExists } from '@common/utils';
import { v4 as uuidv4 } from 'uuid';

import type { AgentProfile } from '@common/types';

import { ExtensionManager, ExtensionsChangeListener } from '@/extensions/extension-manager';
import { AIDER_DESK_AGENTS_DIR, AIDER_DESK_RULES_DIR } from '@/constants';
import logger from '@/logger';
import { EventManager } from '@/events';
import { deriveDirName } from '@/utils';

// Helper methods for directory management
const getGlobalAgentsDir = (): string => path.join(homedir(), AIDER_DESK_AGENTS_DIR);
const getProjectAgentsDir = (projectDir: string): string => path.join(projectDir, AIDER_DESK_AGENTS_DIR);
const getAgentsDirForProfile = (profile: AgentProfile): string => (profile.projectDir ? getProjectAgentsDir(profile.projectDir) : getGlobalAgentsDir());

// Helper methods for rule file discovery
const getAgentRulesDir = (agentsDir: string, agentDirName: string): string => path.join(agentsDir, agentDirName, AIDER_DESK_RULES_DIR);

const getRuleFilesForAgent = async (agentDirName: string, agentsDir: string): Promise<string[]> => {
  const rulesDir = getAgentRulesDir(agentsDir, agentDirName);
  const ruleFiles: string[] = [];

  try {
    await fs.access(rulesDir);
    const entries = await fs.readdir(rulesDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        ruleFiles.push(path.join(rulesDir, entry.name));
      }
    }
  } catch {
    // Rules directory doesn't exist or can't be read
  }

  return ruleFiles;
};

const getAllRuleFilesForProfile = async (profile: AgentProfile, dirName: string): Promise<string[]> => {
  const ruleFiles: string[] = [];

  // Get rule files from the profile's own directory
  const agentsDir = getAgentsDirForProfile(profile);
  const profileRuleFiles = await getRuleFilesForAgent(dirName, agentsDir);
  ruleFiles.push(...profileRuleFiles);

  // If this is a project-level profile, also check for global profile with same ID
  if (profile.projectDir) {
    const globalAgentsDir = getGlobalAgentsDir();
    const globalRuleFiles = await getRuleFilesForAgent(dirName, globalAgentsDir);
    ruleFiles.push(...globalRuleFiles);
  }

  return ruleFiles;
};

interface AgentProfileContext {
  dirName: string;
  order: number;
  agentProfile: AgentProfile;
}

export class AgentProfileManager {
  // Single profiles map - the core simplification
  private profiles: Map<string, AgentProfileContext> = new Map();

  // Directory watching (one watcher per directory)
  private directoryWatchers: Map<string, FSWatcher> = new Map(); // agentsDir → watcher

  // Listener for extension changes
  private extensionsChangeListener: ExtensionsChangeListener;

  constructor(
    private readonly eventManager: EventManager,
    private readonly extensionManager: ExtensionManager,
  ) {
    this.extensionsChangeListener = () => {
      this.sendAgentProfilesUpdated();
    };
  }

  public async init(): Promise<void> {
    await this.initializeProfiles();
    await this.setupGlobalFileWatcher();
    this.extensionManager.addListener(this.extensionsChangeListener);
  }

  public async initializeForProject(projectDir: string): Promise<void> {
    logger.info(`Initializing agent profiles for project: ${projectDir}`);

    const projectAgentsDir = getProjectAgentsDir(projectDir);

    // Load project-specific profiles
    await this.loadProfilesFromDirectory(projectAgentsDir);

    // Setup file watcher for project directory
    await this.setupWatcherForDirectory(projectAgentsDir);

    this.sendAgentProfilesUpdated();
  }

  public removeProject(projectDir: string): void {
    logger.info(`Removing agent profiles for project: ${projectDir}`);

    const projectAgentsDir = getProjectAgentsDir(projectDir);

    // Remove project profiles from the main profiles map
    const profilesToRemove: string[] = [];
    for (const [profileId, context] of this.profiles.entries()) {
      if (context.agentProfile.projectDir === projectDir) {
        profilesToRemove.push(profileId);
      }
    }

    profilesToRemove.forEach((profileId) => this.profiles.delete(profileId));

    // Clean up directory watcher
    const watcher = this.directoryWatchers.get(projectAgentsDir);
    if (watcher) {
      void watcher.close();
      this.directoryWatchers.delete(projectAgentsDir);
    }
  }

  public sendAgentProfilesUpdated(): void {
    const allProfiles = this.getAllProfiles();
    this.eventManager.sendAgentProfilesUpdated(allProfiles);
  }

  private async initializeProfiles(ensureDefaults = true): Promise<void> {
    logger.info('Initializing agent profiles...');
    this.profiles.clear();

    const globalAgentsDir = getGlobalAgentsDir();
    if (ensureDefaults) {
      // Ensure default profiles exist in global directory
      await this.ensureDefaultProfiles(globalAgentsDir);
    }

    // Load global profiles
    await this.loadProfilesFromDirectory(globalAgentsDir);

    this.sendAgentProfilesUpdated();
  }

  private async ensureDefaultProfiles(globalAgentsDir: string): Promise<void> {
    try {
      await fs.mkdir(globalAgentsDir, { recursive: true });
    } catch (err) {
      logger.error(`Failed to create global agents directory ${globalAgentsDir}: ${err}`);
      return;
    }

    // Only create default profiles if the directory is empty
    const isDirectoryEmpty = await this.isAgentsDirectoryEmpty(globalAgentsDir);
    if (!isDirectoryEmpty) {
      logger.info('Agents directory is not empty, skipping default profile creation');
      return;
    }

    for (const defaultProfile of DEFAULT_AGENT_PROFILES) {
      if (this.profiles.has(defaultProfile.id)) {
        continue;
      }

      const dirName = deriveDirName(defaultProfile.name, new Set());
      const profileDir = path.join(globalAgentsDir, dirName);
      const configPath = path.join(profileDir, 'config.json');

      try {
        await fs.access(configPath);
      } catch {
        // Config file doesn't exist, create it
        await fs.mkdir(profileDir, { recursive: true });
        await this.saveProfileToFile(defaultProfile, configPath);
        logger.info(`Created default agent profile: ${defaultProfile.id} in directory: ${dirName}`);
      }
    }

    await this.saveOrderFile(globalAgentsDir, new Map(DEFAULT_AGENT_PROFILES.map((p, index) => [p.id, index])));
  }

  private async setupGlobalFileWatcher(): Promise<void> {
    // Clean up existing global watcher
    const globalAgentsDir = getGlobalAgentsDir();
    const existingWatcher = this.directoryWatchers.get(globalAgentsDir);
    if (existingWatcher) {
      await existingWatcher.close();
    }
    const existingRulesWatcher = this.directoryWatchers.get(`${globalAgentsDir}-rules`);
    if (existingRulesWatcher) {
      await existingRulesWatcher.close();
    }

    // Watch global agents directory
    await this.setupWatcherForDirectory(globalAgentsDir);
  }

  private async setupWatcherForDirectory(agentsDir: string): Promise<void> {
    // Create directory if it doesn't exist
    const dirExists = await fs
      .access(agentsDir)
      .then(() => true)
      .catch(() => false);
    if (!dirExists) {
      try {
        await fs.mkdir(agentsDir, { recursive: true });
      } catch (err) {
        logger.error(`Failed to create agents directory ${agentsDir}: ${err}`);
        return;
      }
    }

    // Close existing watcher for this directory if any
    const existingWatcher = this.directoryWatchers.get(agentsDir);
    if (existingWatcher) {
      await existingWatcher.close();
    }
    const existingRulesWatcher = this.directoryWatchers.get(`${agentsDir}-rules`);
    if (existingRulesWatcher) {
      await existingRulesWatcher.close();
    }

    const watcher = watch(agentsDir, {
      persistent: true,
      usePolling: true,
      ignoreInitial: true,
    });

    // Also watch rules subdirectories within each agent directory
    const rulesWatcher = watch(path.join(agentsDir, '*', AIDER_DESK_RULES_DIR), {
      persistent: true,
      usePolling: true,
      ignoreInitial: true,
    });

    const reloadFunction = () => this.debounceReloadProfiles(agentsDir);

    watcher
      .on('add', async () => {
        await reloadFunction();
      })
      .on('change', async () => {
        await reloadFunction();
      })
      .on('unlink', async () => {
        await reloadFunction();
      })
      .on('error', (error) => {
        logger.error(`Watcher error for ${agentsDir}: ${error}`);
      });

    // Set up rules watcher event handlers
    rulesWatcher
      .on('add', async () => {
        await reloadFunction();
      })
      .on('change', async () => {
        await reloadFunction();
      })
      .on('unlink', async () => {
        await reloadFunction();
      })
      .on('error', (error) => {
        logger.error(`Rules watcher error for ${agentsDir}: ${error}`);
      });

    this.directoryWatchers.set(agentsDir, watcher);
    this.directoryWatchers.set(`${agentsDir}-rules`, rulesWatcher);
  }

  private debounceReloadProfiles = debounce(async (agentsDir: string) => {
    await this.reloadProfiles(agentsDir);
  }, 1000);

  private async reloadProfiles(agentsDir: string): Promise<void> {
    logger.info(`Reloading agent profiles from ${agentsDir}`);

    // Clear existing profiles from this directory
    const profilesToRemove: string[] = [];
    for (const [profileId, context] of this.profiles.entries()) {
      if (getAgentsDirForProfile(context.agentProfile) === agentsDir) {
        profilesToRemove.push(profileId);
      }
    }

    profilesToRemove.forEach((profileId) => this.profiles.delete(profileId));

    // Reload profiles from directory
    await this.loadProfilesFromDirectory(agentsDir);

    // Notify listeners
    this.sendAgentProfilesUpdated();
  }

  private async getExistingDirNames(agentsDir: string): Promise<Set<string>> {
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
  }

  private async isAgentsDirectoryEmpty(agentsDir: string): Promise<boolean> {
    try {
      const entries = await fs.readdir(agentsDir, { withFileTypes: true });

      // Check if there are any directories (profiles)
      for (const entry of entries) {
        if (entry.isDirectory()) {
          return false; // Found at least one profile directory
        }
      }

      return true; // No profile directories found
    } catch {
      // Directory doesn't exist or can't be read, treat as empty
      return true;
    }
  }

  private async loadProfilesFromDirectory(agentsDir: string): Promise<void> {
    const dirExists = await fs
      .access(agentsDir)
      .then(() => true)
      .catch(() => false);
    if (!dirExists) {
      logger.info(`Agents directory does not exist, skipping: ${agentsDir}`);
      return;
    }

    logger.info(`Loading agent profiles from ${agentsDir}`);

    // Load order first
    const order = await this.loadOrderFile(agentsDir);
    const profilesMap = new Map<string, AgentProfileContext>();

    try {
      const entries = await fs.readdir(agentsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const configPath = path.join(agentsDir, entry.name, 'config.json');
          const profile = await this.loadProfileFile(configPath, entry.name);

          if (profile) {
            const profileContext: AgentProfileContext = {
              dirName: entry.name,
              order: 0, // Will be set by order file
              agentProfile: profile,
            };
            profilesMap.set(profile.id, profileContext);
          } else {
            // If no config.json exists, check if this is a project-level directory
            // and if there's a corresponding global profile, merge project-level rule files
            if (agentsDir.includes('.aider-desk/agents')) {
              await this.mergeProjectRuleFilesIntoGlobalProfile(entry.name, agentsDir);
            }
          }
        }
      }

      // Apply order to profiles
      const orderedProfiles = this.applyOrderToProfiles(profilesMap, order);

      // If no order file exists, create one based on current order
      if (order.size === 0 && profilesMap.size > 0) {
        await this.createDefaultOrderFromProfiles(orderedProfiles, agentsDir);
      }

      // Add profiles to the main profiles map
      for (const [profileId, context] of orderedProfiles.entries()) {
        this.profiles.set(profileId, context);
      }
    } catch (err) {
      logger.error(`Failed to read agents directory ${agentsDir}: ${err}`);
    }
  }

  private sanitizeAgentProfile(loadedProfile: AgentProfile, agentDirName: string): AgentProfile {
    return {
      ...loadedProfile,
      id: loadedProfile.id || uuidv4(),
      name: loadedProfile.name || agentDirName,
      provider: loadedProfile.provider || DEFAULT_AGENT_PROFILE.provider,
      model: loadedProfile.model || DEFAULT_AGENT_PROFILE.model,
      maxIterations: loadedProfile.maxIterations ?? DEFAULT_AGENT_PROFILE.maxIterations,
      minTimeBetweenToolCalls: loadedProfile.minTimeBetweenToolCalls ?? DEFAULT_AGENT_PROFILE.minTimeBetweenToolCalls,
      enabledServers: loadedProfile.enabledServers ?? [],
      customInstructions: loadedProfile.customInstructions ?? '',
      toolApprovals: {
        ...loadedProfile.toolApprovals,
      },
      toolSettings: {
        ...loadedProfile.toolSettings,
      },
      subagent: {
        ...DEFAULT_AGENT_PROFILE.subagent,
        ...loadedProfile.subagent,
      },
    };
  }

  private async loadProfileFile(filePath: string, dirName: string): Promise<AgentProfile | null> {
    try {
      if (!(await fileExists(filePath))) {
        return null;
      }

      logger.debug(`Loading agent profile from ${filePath}`);

      const content = await fs.readFile(filePath, 'utf-8');
      const loadedProfile: AgentProfile = JSON.parse(content);

      // Sanitize profile with defaults
      const profile = this.sanitizeAgentProfile(loadedProfile, dirName);
      if (JSON.stringify(profile) !== JSON.stringify(loadedProfile)) {
        logger.info(`Saving sanitized agent profile to ${filePath}`);
        await this.saveProfileToFile(profile, filePath);
      }

      // Discover and load rule files for this profile
      profile.ruleFiles = await getAllRuleFilesForProfile(profile, dirName);

      logger.info(`Loaded agent profile: ${profile.name} with ${profile.ruleFiles.length} rule files`);
      return profile;
    } catch (err) {
      logger.error(`Failed to parse agent profile file ${filePath}: ${err}`);
      return null;
    }
  }

  private async saveProfileToFile(profile: AgentProfile, filePath: string): Promise<void> {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      // Create a copy of the profile without ruleFiles since they are dynamically discovered
      const { ruleFiles: _ruleFiles, ...profileToSave } = profile;
      await fs.writeFile(filePath, JSON.stringify(profileToSave, null, 2), 'utf-8');
    } catch (err) {
      logger.error(`Failed to save agent profile to ${filePath}: ${err}`);
      throw err;
    }
  }

  private async loadOrderFile(agentsDir: string): Promise<Map<string, number>> {
    const orderPath = path.join(agentsDir, 'order.json');
    const order = new Map<string, number>();

    try {
      await fs.access(orderPath);
      const content = await fs.readFile(orderPath, 'utf-8');
      const orderData = JSON.parse(content);

      for (const [profileId, orderIndex] of Object.entries(orderData)) {
        if (typeof orderIndex === 'number') {
          order.set(profileId, orderIndex);
        }
      }

      logger.info(`Loaded order for ${order.size} profiles from ${orderPath}`);
    } catch {
      logger.info(`No order file found at ${orderPath}, will create default order`);
    }

    return order;
  }

  private async saveOrderFile(agentsDir: string, order: Map<string, number>): Promise<void> {
    const orderPath = path.join(agentsDir, 'order.json');
    const orderData: Record<string, number> = {};

    for (const [profileId, orderIndex] of Array.from(order.entries())) {
      orderData[profileId] = orderIndex;
    }

    try {
      await fs.mkdir(path.dirname(orderPath), { recursive: true });
      await fs.writeFile(orderPath, JSON.stringify(orderData, null, 2), 'utf-8');
      logger.info(`Saved order for ${order.size} profiles to ${orderPath}`);
    } catch (err) {
      logger.error(`Failed to save order file to ${orderPath}: ${err}`);
      throw err;
    }
  }

  private applyOrderToProfiles(profilesMap: Map<string, AgentProfileContext>, order: Map<string, number>): Map<string, AgentProfileContext> {
    const sortedEntries = Array.from(profilesMap.entries()).sort(([, a], [, b]) => {
      const orderA = order.get(a.agentProfile.id);
      const orderB = order.get(b.agentProfile.id);

      // If both have order, use it
      if (orderA !== undefined && orderB !== undefined) {
        return orderA - orderB;
      }

      // If only one has order, the one with order comes first
      if (orderA !== undefined) {
        return -1;
      }
      if (orderB !== undefined) {
        return 1;
      }

      // If neither has order, maintain original order (by name as fallback)
      return a.agentProfile.name.localeCompare(b.agentProfile.name);
    });

    return new Map(sortedEntries);
  }

  private async createDefaultOrderFromProfiles(profilesMap: Map<string, AgentProfileContext>, agentsDir: string): Promise<void> {
    const order = new Map<string, number>();
    let index = 0;
    for (const [profileId, context] of profilesMap.entries()) {
      order.set(profileId, index);
      context.order = index;
      index++;
    }
    await this.saveOrderFile(agentsDir, order);
  }

  public async createProfile(profile: AgentProfile, projectDir?: string): Promise<void> {
    if (!profile.id) {
      throw new Error('Agent profile must have an id');
    }

    const agentsDir = projectDir ? getProjectAgentsDir(projectDir) : getGlobalAgentsDir();

    // Get existing directory names for collision handling
    const existingDirNames = await this.getExistingDirNames(agentsDir);

    // Derive unique directory name
    const dirName = deriveDirName(profile.name, existingDirNames);

    // Create directory and save config.json
    const profileDir = path.join(agentsDir, dirName);
    const configPath = path.join(profileDir, 'config.json');

    await fs.mkdir(profileDir, { recursive: true });
    await this.saveProfileToFile(profile, configPath);

    // Reload profiles to update the cache
    await this.reloadProfiles(agentsDir);
  }

  public async updateProfile(profile: AgentProfile): Promise<void> {
    if (!profile.id) {
      throw new Error('Agent profile must have an id');
    }

    const existingContext = this.profiles.get(profile.id);

    if (!existingContext) {
      throw new Error(`Agent profile with id ${profile.id} not found`);
    }

    const agentsDir = getAgentsDirForProfile(existingContext.agentProfile);
    const configPath = path.join(agentsDir, existingContext.dirName, 'config.json');

    existingContext.agentProfile = profile;
    await this.saveProfileToFile(profile, configPath);

    this.sendAgentProfilesUpdated();
  }

  public async deleteProfile(profileId: string): Promise<void> {
    const existingContext = this.profiles.get(profileId);

    if (!existingContext) {
      throw new Error(`Agent profile with id ${profileId} not found`);
    }

    const agentsDir = getAgentsDirForProfile(existingContext.agentProfile);
    const profileDir = path.join(agentsDir, existingContext.dirName);

    try {
      await fs.rm(profileDir, { recursive: true, force: true });
      this.profiles.delete(profileId);
    } catch (err) {
      logger.error(`Failed to delete agent profile directory ${profileDir}: ${err}`);
      throw err;
    }

    // Reload profiles to update the cache
    await this.debounceReloadProfiles(agentsDir);
  }

  public getProfile(profileId: string): AgentProfile | undefined {
    // Check extension agents first (they can override file-based profiles)
    const extensionAgent = this.extensionManager.getAgentById(profileId);
    if (extensionAgent) {
      return extensionAgent.agent;
    }
    // Fall back to file-based profiles
    return this.profiles.get(profileId)?.agentProfile;
  }

  private getOrderedProfiles(profileContexts: AgentProfileContext[]): AgentProfile[] {
    return profileContexts
      .sort((a, b) => {
        // First, prioritize project profiles over global profiles
        const aIsProject = !!a.agentProfile.projectDir;
        const bIsProject = !!b.agentProfile.projectDir;

        if (aIsProject && !bIsProject) {
          return -1;
        }
        if (!aIsProject && bIsProject) {
          return 1;
        }

        // Then sort by order within the same scope
        return a.order - b.order;
      })
      .map((ctx) => ctx.agentProfile);
  }

  private getGlobalProfiles(): AgentProfile[] {
    return this.getOrderedProfiles(Array.from(this.profiles.values()).filter((ctx) => !ctx.agentProfile.projectDir));
  }

  public getAllProfiles(): AgentProfile[] {
    // Get extension agents first (they can override file-based profiles)
    const extensionAgents = this.extensionManager.getAgents(undefined).map((registered) => registered.agent);
    // Then get file-based profiles
    const fileBasedProfiles = this.getOrderedProfiles(Array.from(this.profiles.values()));
    // Extension agents come first for override capability
    return [...extensionAgents, ...fileBasedProfiles.filter((profile) => !extensionAgents.some((extAgent) => extAgent.id === profile.id))];
  }

  public getProjectProfiles(projectDir: string, includeGlobal = true, includeExtension = true): AgentProfile[] {
    const projectProfiles = Array.from(this.profiles.values()).filter((ctx) => ctx.agentProfile.projectDir === projectDir);
    const profiles = this.getOrderedProfiles(projectProfiles);

    if (includeGlobal) {
      profiles.push(...this.getGlobalProfiles());
    }

    if (includeExtension) {
      const extensionAgents = this.extensionManager.getAgents(projectDir).map((registered) => registered.agent);
      // Extension agents come first for override capability
      return [...extensionAgents, ...profiles.filter((profile) => !extensionAgents.some((extAgent) => extAgent.id === profile.id))];
    }

    return profiles;
  }

  public async updateAgentProfilesOrder(agentProfiles: AgentProfile[]): Promise<void> {
    // Group profiles by their projectDir (undefined/null = global)
    const profilesByProjectDir = new Map<string | undefined, AgentProfile[]>();

    agentProfiles.forEach((profile) => {
      const projectDir = profile.projectDir;
      if (!profilesByProjectDir.has(projectDir)) {
        profilesByProjectDir.set(projectDir, []);
      }
      profilesByProjectDir.get(projectDir)!.push(profile);
    });

    // Process each group separately
    for (const [projectDir, profiles] of profilesByProjectDir.entries()) {
      // Create order map for this group
      const order = new Map<string, number>();
      profiles.forEach((profile, index) => {
        order.set(profile.id, index);
      });

      // Determine the agents directory for this group
      const agentsDir = projectDir ? getProjectAgentsDir(projectDir) : getGlobalAgentsDir();

      // Save the order file for this group
      await this.saveOrderFile(agentsDir, order);

      // Update the in-memory profiles for this group
      for (const [profileId, profileContext] of this.profiles.entries()) {
        const profileAgentsDir = getAgentsDirForProfile(profileContext.agentProfile);
        if (profileAgentsDir === agentsDir) {
          const newOrder = order.get(profileId);
          if (newOrder !== undefined) {
            profileContext.order = newOrder;
          }
        }
      }
    }

    // Notify listeners
    this.sendAgentProfilesUpdated();
  }

  private async mergeProjectRuleFilesIntoGlobalProfile(agentDirName: string, projectAgentsDir: string): Promise<void> {
    // Check if there are project-level rule files
    const projectRuleFiles = await getRuleFilesForAgent(agentDirName, projectAgentsDir);

    if (projectRuleFiles.length === 0) {
      return; // No project-level rule files to merge
    }

    // Find the corresponding global profile by directory name
    let globalProfileEntry: [string, AgentProfileContext] | null = null;
    for (const [profileId, context] of this.profiles.entries()) {
      if (context.dirName === agentDirName && !context.agentProfile.projectDir) {
        globalProfileEntry = [profileId, context];
        break;
      }
    }

    if (!globalProfileEntry) {
      return; // No global profile found with matching directory name
    }

    const [profileId, globalProfileContext] = globalProfileEntry;

    // Create a new profile object with merged rule files
    const updatedProfile = {
      ...globalProfileContext.agentProfile,
      ruleFiles: [...(globalProfileContext.agentProfile.ruleFiles || []), ...projectRuleFiles],
    };

    // Update the profile context
    const updatedContext: AgentProfileContext = {
      ...globalProfileContext,
      agentProfile: updatedProfile,
    };

    this.profiles.set(profileId, updatedContext);
    logger.info(`Merged ${projectRuleFiles.length} project-level rule files into global profile: ${agentDirName}`);
  }

  async dispose(): Promise<void> {
    // Remove extension change listener
    this.extensionManager.removeListener(this.extensionsChangeListener);

    // Clean up all directory watchers
    for (const watcher of this.directoryWatchers.values()) {
      await watcher.close();
    }
    this.directoryWatchers.clear();

    // Clear profiles
    this.profiles.clear();
  }

  getDefaultAgentProfileId() {
    for (const defaultProfile of DEFAULT_AGENT_PROFILES) {
      if (this.profiles.has(defaultProfile.id)) {
        return defaultProfile.id;
      }
    }

    return this.profiles.values().next().value?.agentProfile.id || DEFAULT_AGENT_PROFILE.id;
  }
}
