import { vi } from 'vitest';
import { AgentProfile } from '@aider-desk/common/types';

import { TaskContextType } from '@/contexts/TaskContext';
import { ModelProviderContextType } from '@/contexts/ModelProviderContext';
import { AgentsContextType } from '@/contexts/AgentsContext';

/**
 * Creates a comprehensive mock for useTask hook context
 * Provides default implementations for all TaskContextType methods and allows overrides
 */
export const createMockTaskContext = (overrides: Partial<TaskContextType> = {}) => {
  const defaultMock = {
    loadTask: vi.fn(),
    clearSession: vi.fn(),
    resetTask: vi.fn(),
    setMessages: vi.fn(),
    setTodoItems: vi.fn(),
    setAiderModelsData: vi.fn(),
    answerQuestion: vi.fn(),
    interruptResponse: vi.fn(),
    updateTaskAgentProfile: vi.fn(),
    refreshAllFiles: vi.fn(),
  };

  return { ...defaultMock, ...overrides };
};

/**
 * Creates a comprehensive mock for useModelProviders hook context
 * Provides default implementations for all ModelProviderContextType properties and allows overrides
 */
export const createMockModelProviderContext = (overrides: Partial<ModelProviderContextType> = {}) => {
  const defaultMock = {
    refresh: vi.fn(),
    models: [],
    providers: [],
    saveProvider: vi.fn(),
    deleteProvider: vi.fn(),
    upsertModel: vi.fn(),
    deleteModel: vi.fn(),
    updateModels: vi.fn(),
    modelsLoading: false,
    providersLoading: false,
    errors: {},
  };

  return { ...defaultMock, ...overrides };
};

/**
 * Creates a comprehensive mock for useAgents hook context
 * Provides default implementations for all AgentsContextType properties and allows overrides
 */
export const createMockAgentsContext = (overrides: Partial<AgentsContextType> = {}) => {
  const defaultMock = {
    profiles: [] as AgentProfile[],
    loading: false,
    error: null,
    getProfiles: vi.fn(() => [] as AgentProfile[]),
    createProfile: vi.fn(),
    updateProfile: vi.fn(),
    deleteProfile: vi.fn(),
    refreshProfiles: vi.fn(),
    updateProfilesOrder: vi.fn(),
  };

  return { ...defaultMock, ...overrides };
};

/**
 * Creates a mock for useResponsive hook
 * Provides default implementations for all useResponsive return properties and allows overrides
 */
export const createMockResponsive = (overrides: Partial<ReturnType<typeof import('@/hooks/useResponsive').useResponsive>> = {}) => {
  const defaultMock = {
    isMobile: false,
    isTablet: false,
    isDesktop: true,
  };

  return { ...defaultMock, ...overrides };
};
