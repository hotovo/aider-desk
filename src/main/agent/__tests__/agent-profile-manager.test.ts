// Mock all dependencies BEFORE importing the test file
vi.mock('@/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));
vi.mock('@/events');
vi.mock('@/constants');
vi.mock('@/utils', () => ({
  deriveDirName: vi.fn((name: string) => name.toLowerCase().replace(/\s+/g, '-')),
}));
vi.mock('fs/promises');

import * as fs from 'fs/promises';
import path from 'path';
import { homedir } from 'os';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentProfile } from '@common/types';

import { AgentProfileManager } from '../agent-profile-manager';

import type { ExtensionManager } from '@/extensions/extension-manager';

import { AIDER_DESK_AGENTS_DIR } from '@/constants';
import { createMockAgentProfile } from '@/__tests__/mocks';

describe('AgentProfileManager', () => {
  let agentProfileManager: AgentProfileManager;
  let mockEventManager: any;
  let mockExtensionManager: ExtensionManager;

  const globalAgentsDir = path.join(homedir(), AIDER_DESK_AGENTS_DIR);

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock EventManager
    mockEventManager = {
      sendAgentProfilesUpdated: vi.fn(),
    };

    // Mock ExtensionManager
    mockExtensionManager = {
      getAgents: vi.fn().mockReturnValue([]),
      getAgentById: vi.fn().mockReturnValue(undefined),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    } as unknown as ExtensionManager;

    // Mock fs methods
    (fs.writeFile as any).mockResolvedValue(undefined);
    (fs.mkdir as any).mockResolvedValue(undefined);
    (fs.rm as any).mockResolvedValue(undefined);
    (fs.access as any).mockResolvedValue(undefined);
    (fs.readdir as any).mockResolvedValue([]);
    (fs.readFile as any).mockResolvedValue('{}');

    // Create manager instance
    agentProfileManager = new AgentProfileManager(mockEventManager, mockExtensionManager);
  });

  describe('Core Bug - updateProfile does not call notifyListeners', () => {
    beforeEach(async () => {
      // Setup initial profile in memory directly
      const mockProfile = createMockAgentProfile({
        id: 'profile-1',
        name: 'Test Profile',
      });

      const mockContext = {
        dirName: 'test-profile',
        order: 0,
        agentProfile: mockProfile,
      };

      (agentProfileManager as any).profiles.set('profile-1', mockContext);
    });

    it('should update profile without duplicating', async () => {
      const updatedProfile = createMockAgentProfile({
        id: 'profile-1',
        name: 'Updated Profile',
      });

      (fs.readFile as any).mockResolvedValue(JSON.stringify(updatedProfile));

      await agentProfileManager.updateProfile(updatedProfile);

      const profiles = agentProfileManager.getAllProfiles();

      // Should still have exactly one profile
      expect(profiles).toHaveLength(1);
      expect(profiles[0].id).toBe('profile-1');
      expect(profiles[0].name).toBe('Updated Profile');

      // Verify file was saved
      expect(fs.writeFile as any).toHaveBeenCalled();
    });

    it('should call notifyListeners after update', async () => {
      const updatedProfile = createMockAgentProfile({
        id: 'profile-1',
        name: 'Updated Profile',
      });

      (fs.readFile as any).mockResolvedValue(JSON.stringify(updatedProfile));

      await agentProfileManager.updateProfile(updatedProfile);

      // FIXED: updateProfile now calls notifyListeners to prevent profile duplication (Issue #644)
      expect(mockEventManager.sendAgentProfilesUpdated).toHaveBeenCalled();
    });

    it('should not trigger file watcher reload on update', async () => {
      const updatedProfile = createMockAgentProfile({
        id: 'profile-1',
        name: 'Updated Profile',
      });

      (fs.readFile as any).mockResolvedValue(JSON.stringify(updatedProfile));

      // Spy on debounceReloadProfiles
      const debounceSpy = vi.spyOn(agentProfileManager as any, 'debounceReloadProfiles');

      await agentProfileManager.updateProfile(updatedProfile);

      // Update should NOT trigger debounceReloadProfiles
      // (create and delete DO trigger it, but update doesn't - which is correct)
      expect(debounceSpy).not.toHaveBeenCalled();
    });
  });

  describe('Comparison - createProfile and deleteProfile operations', () => {
    it('createProfile saves profile to file system', async () => {
      const mockProfile = createMockAgentProfile({
        id: 'profile-2',
        name: 'New Profile',
      });

      (fs.readdir as any).mockResolvedValue([]);
      (fs.readFile as any).mockResolvedValue(JSON.stringify(mockProfile));

      await agentProfileManager.createProfile(mockProfile);

      // Verify file operations
      expect(fs.mkdir as any).toHaveBeenCalled();
      expect(fs.writeFile as any).toHaveBeenCalled();
    });

    it('deleteProfile removes profile from file system', async () => {
      // Setup profile in memory
      const mockProfile = createMockAgentProfile({
        id: 'profile-1',
        name: 'Test Profile',
      });

      const mockContext = {
        dirName: 'test-profile',
        order: 0,
        agentProfile: mockProfile,
      };

      (agentProfileManager as any).profiles.set('profile-1', mockContext);

      (fs.rm as any).mockResolvedValue(undefined);
      (fs.readdir as any).mockResolvedValue([]);

      await agentProfileManager.deleteProfile('profile-1');

      // Verify file operations
      expect(fs.rm as any).toHaveBeenCalled();
    });
  });

  describe('Profile Deduplication - Issue #644 Symptom', () => {
    beforeEach(async () => {
      // Setup initial profile in memory
      const mockProfile = createMockAgentProfile({
        id: 'profile-1',
        name: 'Test Profile',
      });

      const mockContext = {
        dirName: 'test-profile',
        order: 0,
        agentProfile: mockProfile,
      };

      (agentProfileManager as any).profiles.set('profile-1', mockContext);
    });

    it('should not duplicate profiles when updated multiple times', async () => {
      // Update profile multiple times
      for (let i = 1; i <= 5; i++) {
        const updatedProfile = createMockAgentProfile({
          id: 'profile-1',
          name: `Profile Update ${i}`,
        });

        (fs.readFile as any).mockResolvedValue(JSON.stringify(updatedProfile));
        await agentProfileManager.updateProfile(updatedProfile);
      }

      const profiles = agentProfileManager.getAllProfiles();

      // Should still have exactly one profile, not duplicated
      expect(profiles).toHaveLength(1);
      expect(profiles[0].id).toBe('profile-1');
      expect(profiles[0].name).toBe('Profile Update 5');
    });
  });

  describe('Profile Map Ensures Uniqueness by ID', () => {
    it('should not allow duplicate profile IDs in internal Map', async () => {
      const profilesMap = (agentProfileManager as any).profiles;

      // Add a profile with ID 'profile-1'
      const profile1 = createMockAgentProfile({
        id: 'profile-1',
        name: 'Profile 1',
      });

      profilesMap.set('profile-1', {
        dirName: 'profile-1',
        order: 0,
        agentProfile: profile1,
      });

      // Try to add another profile with same ID
      const profile2 = createMockAgentProfile({
        id: 'profile-1',
        name: 'Profile 2',
      });

      profilesMap.set('profile-1', {
        dirName: 'profile-1-dup',
        order: 1,
        agentProfile: profile2,
      });

      // Map should still have only one entry for 'profile-1'
      expect(profilesMap.size).toBe(1);
      expect(profilesMap.get('profile-1').agentProfile.name).toBe('Profile 2');
    });

    it('getAllProfiles returns unique profiles from Map', async () => {
      const profilesMap = (agentProfileManager as any).profiles;

      // Add multiple profiles with different IDs
      const profile1 = createMockAgentProfile({ id: 'profile-1', name: 'Profile 1' });
      const profile2 = createMockAgentProfile({ id: 'profile-2', name: 'Profile 2' });
      const profile3 = createMockAgentProfile({ id: 'profile-3', name: 'Profile 3' });

      profilesMap.set('profile-1', { dirName: 'p1', order: 0, agentProfile: profile1 });
      profilesMap.set('profile-2', { dirName: 'p2', order: 1, agentProfile: profile2 });
      profilesMap.set('profile-3', { dirName: 'p3', order: 2, agentProfile: profile3 });

      const profiles = agentProfileManager.getAllProfiles();

      // Should have exactly 3 profiles, all unique
      expect(profiles).toHaveLength(3);
      expect(profiles.map((p: AgentProfile) => p.id)).toEqual(['profile-1', 'profile-2', 'profile-3']);
    });
  });

  describe('Event Listener Notification Behavior', () => {
    it('getAllProfiles should return all profiles without triggering events', async () => {
      // Add a profile
      const profile1 = createMockAgentProfile({ id: 'profile-1', name: 'Profile 1' });
      (agentProfileManager as any).profiles.set('profile-1', {
        dirName: 'p1',
        order: 0,
        agentProfile: profile1,
      });

      const profiles = agentProfileManager.getAllProfiles();

      // getAllProfiles should not trigger events
      expect(mockEventManager.sendAgentProfilesUpdated).not.toHaveBeenCalled();
      expect(profiles).toHaveLength(1);
    });

    it('notifyListeners should be callable and send event with all profiles', async () => {
      // Add multiple profiles
      const profile1 = createMockAgentProfile({ id: 'profile-1', name: 'Profile 1' });
      const profile2 = createMockAgentProfile({ id: 'profile-2', name: 'Profile 2' });

      (agentProfileManager as any).profiles.set('profile-1', { dirName: 'p1', order: 0, agentProfile: profile1 });
      (agentProfileManager as any).profiles.set('profile-2', { dirName: 'p2', order: 1, agentProfile: profile2 });

      (agentProfileManager as any).sendAgentProfilesUpdated();

      expect(mockEventManager.sendAgentProfilesUpdated).toHaveBeenCalledTimes(1);
      const calledWith = mockEventManager.sendAgentProfilesUpdated.mock.calls[0][0];
      expect(calledWith).toHaveLength(2);
      expect(calledWith[0].id).toBe('profile-1');
      expect(calledWith[1].id).toBe('profile-2');
    });
  });

  describe('Reload Profiles Behavior', () => {
    it('should clear old profiles from directory when reloading', async () => {
      // Add a profile
      const profile1 = createMockAgentProfile({ id: 'profile-1', name: 'Profile 1' });
      (agentProfileManager as any).profiles.set('profile-1', {
        dirName: 'p1',
        order: 0,
        agentProfile: profile1,
      });

      const profilesBefore = agentProfileManager.getAllProfiles();
      expect(profilesBefore.length).toBeGreaterThan(0);

      // Simulate reload with empty directory
      (fs.readdir as any).mockResolvedValue([]);
      (fs.access as any).mockResolvedValue(undefined);

      await (agentProfileManager as any).reloadProfiles(globalAgentsDir);

      const profilesAfter = agentProfileManager.getAllProfiles();
      expect(profilesAfter).toHaveLength(0);
    });

    it('should notify listeners after reloading', async () => {
      (fs.readdir as any).mockResolvedValue([]);
      (fs.access as any).mockResolvedValue(undefined);

      await (agentProfileManager as any).reloadProfiles(globalAgentsDir);

      // reloadProfiles should call notifyListeners
      expect(mockEventManager.sendAgentProfilesUpdated).toHaveBeenCalled();
    });
  });
});
