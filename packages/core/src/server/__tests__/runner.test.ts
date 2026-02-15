// Mock dependencies
vi.mock('@/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock('@/store');
vi.mock('@/managers');
vi.mock('@/start-up');
vi.mock('@/events');
vi.mock('@/models');
vi.mock('@/agent');
vi.mock('@/utils');
vi.mock('os-name', () => ({
  default: () => 'Test OS',
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Import after mocks are set up
import { addProjectsFromEnv } from '../runner';

// Import mocked modules
import logger from '@/logger';
import { getDefaultProjectSettings } from '@/utils';
import { ModelManager } from '@/models';
import { AgentProfileManager } from '@/agent';
import { Store } from '@/store';

describe('addProjectsFromEnv', () => {
  let mockStore: Partial<Store>;
  let mockModelManager: Partial<ModelManager>;
  let mockAgentProfileManager: Partial<AgentProfileManager>;

  beforeEach(async () => {
    // Reset environment
    delete process.env.AIDER_DESK_PROJECTS;

    // Mock store
    mockStore = {
      getOpenProjects: vi.fn(() => []),
      setOpenProjects: vi.fn(),
    };

    // Mock getDefaultProjectSettings
    vi.mocked(getDefaultProjectSettings).mockReturnValue({
      mainModel: 'default-model',
      weakModel: null,
      architectModel: null,
      agentProfileId: 'default-profile-id',
      modelEditFormats: {},
      currentMode: 'agent' as const,
    });

    // Mock managers
    mockModelManager = {
      getProviderModels: vi.fn(() => Promise.resolve({ models: [] })),
    };

    mockAgentProfileManager = {
      getDefaultAgentProfileId: vi.fn(() => 'default-profile-id'),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.AIDER_DESK_PROJECTS;
  });

  it('should do nothing when AIDER_DESK_PROJECTS is not set', async () => {
    await addProjectsFromEnv(mockStore as Store, mockModelManager as ModelManager, mockAgentProfileManager as AgentProfileManager);

    expect(mockStore.getOpenProjects).not.toHaveBeenCalled();
    expect(mockStore.setOpenProjects).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining('AIDER_DESK_PROJECTS environment variable found'));
  });

  it('should do nothing when AIDER_DESK_PROJECTS is empty string', async () => {
    process.env.AIDER_DESK_PROJECTS = '';

    await addProjectsFromEnv(mockStore as Store, mockModelManager as ModelManager, mockAgentProfileManager as AgentProfileManager);

    expect(mockStore.getOpenProjects).not.toHaveBeenCalled();
    expect(mockStore.setOpenProjects).not.toHaveBeenCalled();
  });

  it('should do nothing when AIDER_DESK_PROJECTS contains only whitespace', async () => {
    process.env.AIDER_DESK_PROJECTS = '  ,  ,   ';

    await addProjectsFromEnv(mockStore as Store, mockModelManager as ModelManager, mockAgentProfileManager as AgentProfileManager);

    expect(mockStore.getOpenProjects).not.toHaveBeenCalled();
    expect(mockStore.setOpenProjects).not.toHaveBeenCalled();
  });

  it('should add a single project when AIDER_DESK_PROJECTS contains one path', async () => {
    process.env.AIDER_DESK_PROJECTS = '/home/user/project1';
    (mockStore.getOpenProjects as ReturnType<typeof vi.fn>).mockReturnValue([]);

    await addProjectsFromEnv(mockStore as Store, mockModelManager as ModelManager, mockAgentProfileManager as AgentProfileManager);

    expect(logger.info).toHaveBeenCalledWith('AIDER_DESK_PROJECTS environment variable found', {
      projectPaths: ['/home/user/project1'],
    });
    expect(mockStore.getOpenProjects).toHaveBeenCalled();
    expect(mockStore.setOpenProjects).toHaveBeenCalled();
    expect(mockModelManager.getProviderModels).toHaveBeenCalled();
    expect(mockAgentProfileManager.getDefaultAgentProfileId).toHaveBeenCalled();

    const updatedProjects = (mockStore.setOpenProjects as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updatedProjects).toHaveLength(1);
    expect(updatedProjects[0].baseDir).toBe('/home/user/project1');
    expect(updatedProjects[0].active).toBe(true); // First project should be active
    expect(getDefaultProjectSettings).toHaveBeenCalledWith(mockStore, [], '/home/user/project1', 'default-profile-id');

    expect(logger.info).toHaveBeenCalledWith('Creating project from AIDER_DESK_PROJECTS', {
      projectPath: '/home/user/project1',
    });
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Overridden open projects with 1 project(s) from AIDER_DESK_PROJECTS'));
  });

  it('should add multiple projects when AIDER_DESK_PROJECTS contains comma-separated paths', async () => {
    process.env.AIDER_DESK_PROJECTS = '/home/user/project1,/home/user/project2,/home/user/project3';
    (mockStore.getOpenProjects as ReturnType<typeof vi.fn>).mockReturnValue([]);

    await addProjectsFromEnv(mockStore as Store, mockModelManager as ModelManager, mockAgentProfileManager as AgentProfileManager);

    const updatedProjects = (mockStore.setOpenProjects as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updatedProjects).toHaveLength(3);
    expect(updatedProjects[0].baseDir).toBe('/home/user/project1');
    expect(updatedProjects[1].baseDir).toBe('/home/user/project2');
    expect(updatedProjects[2].baseDir).toBe('/home/user/project3');
    expect(updatedProjects[0].active).toBe(true); // First project should be active
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Overridden open projects with 3 project(s) from AIDER_DESK_PROJECTS'));
  });

  it('should handle extra whitespace in comma-separated paths', async () => {
    process.env.AIDER_DESK_PROJECTS = '  /home/user/project1  ,  /home/user/project2  , /home/user/project3  ';
    (mockStore.getOpenProjects as ReturnType<typeof vi.fn>).mockReturnValue([]);

    await addProjectsFromEnv(mockStore as Store, mockModelManager as ModelManager, mockAgentProfileManager as AgentProfileManager);

    const updatedProjects = (mockStore.setOpenProjects as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updatedProjects).toHaveLength(3);
    expect(updatedProjects[0].baseDir).toBe('/home/user/project1');
    expect(updatedProjects[1].baseDir).toBe('/home/user/project2');
    expect(updatedProjects[2].baseDir).toBe('/home/user/project3');
  });

  it('should preserve active state from existing projects when overriding', async () => {
    process.env.AIDER_DESK_PROJECTS = '/home/user/project1,/home/user/project2,/home/user/project3';
    (mockStore.getOpenProjects as ReturnType<typeof vi.fn>).mockReturnValue([
      { baseDir: '/home/user/project1', settings: {}, active: false },
      { baseDir: '/home/user/project3', settings: {}, active: true },
    ]);

    await addProjectsFromEnv(mockStore as Store, mockModelManager as ModelManager, mockAgentProfileManager as AgentProfileManager);

    const updatedProjects = (mockStore.setOpenProjects as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updatedProjects).toHaveLength(3);
    expect(updatedProjects[0].baseDir).toBe('/home/user/project1');
    expect(updatedProjects[1].baseDir).toBe('/home/user/project2');
    expect(updatedProjects[2].baseDir).toBe('/home/user/project3');
    // Active state should be preserved
    expect(updatedProjects[0].active).toBe(false);
    expect(updatedProjects[1].active).toBe(false);
    expect(updatedProjects[2].active).toBe(true);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Overridden open projects with 3 project(s) from AIDER_DESK_PROJECTS'));
  });

  it('should preserve active state when overriding existing projects', async () => {
    process.env.AIDER_DESK_PROJECTS = '/home/user/project1,/home/user/project2';
    (mockStore.getOpenProjects as ReturnType<typeof vi.fn>).mockReturnValue([
      { baseDir: '/home/user/project1', settings: { mainModel: 'old-model' }, active: true },
    ]);

    await addProjectsFromEnv(mockStore as Store, mockModelManager as ModelManager, mockAgentProfileManager as AgentProfileManager);

    const updatedProjects = (mockStore.setOpenProjects as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updatedProjects).toHaveLength(2);
    expect(updatedProjects[0].baseDir).toBe('/home/user/project1');
    expect(updatedProjects[1].baseDir).toBe('/home/user/project2');
    // Active state should be preserved for existing project
    expect(updatedProjects[0].active).toBe(true);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Overridden open projects with 2 project(s) from AIDER_DESK_PROJECTS'));
  });

  it('should trim trailing slashes from project paths', async () => {
    process.env.AIDER_DESK_PROJECTS = '/home/user/project1/,/home/user/project2/';
    (mockStore.getOpenProjects as ReturnType<typeof vi.fn>).mockReturnValue([]);

    await addProjectsFromEnv(mockStore as Store, mockModelManager as ModelManager, mockAgentProfileManager as AgentProfileManager);

    const updatedProjects = (mockStore.setOpenProjects as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updatedProjects[0].baseDir).toBe('/home/user/project1');
    expect(updatedProjects[1].baseDir).toBe('/home/user/project2');
  });

  it('should propagate errors when getProviderModels fails', async () => {
    process.env.AIDER_DESK_PROJECTS = '/home/user/project1';
    mockModelManager.getProviderModels = vi.fn(() => Promise.reject(new Error('Failed to get models')));

    await expect(addProjectsFromEnv(mockStore as Store, mockModelManager as ModelManager, mockAgentProfileManager as AgentProfileManager)).rejects.toThrow(
      'Failed to get models',
    );
  });

  it('should override existing projects with ones from env var', async () => {
    process.env.AIDER_DESK_PROJECTS = '/home/user/new-project';
    (mockStore.getOpenProjects as ReturnType<typeof vi.fn>).mockReturnValue([
      { baseDir: '/home/user/old-project1', settings: { mainModel: 'old-model1' }, active: false },
      { baseDir: '/home/user/old-project2', settings: { mainModel: 'old-model2' }, active: true },
    ]);

    await addProjectsFromEnv(mockStore as Store, mockModelManager as ModelManager, mockAgentProfileManager as AgentProfileManager);

    const updatedProjects = (mockStore.setOpenProjects as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // Old projects should be overridden with new one from env
    expect(updatedProjects).toHaveLength(1);
    expect(updatedProjects[0].baseDir).toBe('/home/user/new-project');
    expect(updatedProjects[0].active).toBe(true); // First project should be active
  });

  it('should override existing projects even if they are the same', async () => {
    process.env.AIDER_DESK_PROJECTS = '/home/user/project1,/home/user/project2';
    (mockStore.getOpenProjects as ReturnType<typeof vi.fn>).mockReturnValue([
      { baseDir: '/home/user/project1', settings: { mainModel: 'old-model1' }, active: false },
      { baseDir: '/home/user/project2', settings: { mainModel: 'old-model2' }, active: true },
    ]);

    await addProjectsFromEnv(mockStore as Store, mockModelManager as ModelManager, mockAgentProfileManager as AgentProfileManager);

    // Should still call setOpenProjects to override with new settings
    expect(mockStore.setOpenProjects).toHaveBeenCalled();

    const updatedProjects = (mockStore.setOpenProjects as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updatedProjects).toHaveLength(2);
    expect(updatedProjects[0].baseDir).toBe('/home/user/project1');
    expect(updatedProjects[1].baseDir).toBe('/home/user/project2');
    // Active state should be preserved
    expect(updatedProjects[0].active).toBe(false);
    expect(updatedProjects[1].active).toBe(true);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Overridden open projects with 2 project(s) from AIDER_DESK_PROJECTS'));
  });
});
