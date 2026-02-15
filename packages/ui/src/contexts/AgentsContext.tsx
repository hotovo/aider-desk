import { createContext, useContext, useEffect, useOptimistic, startTransition, ReactNode, useCallback, useState } from 'react';
import { AgentProfile } from '@aider-desk/common/types';

import { useApi } from '@/contexts/ApiContext';

export interface AgentsContextType {
  profiles: AgentProfile[];
  loading: boolean;
  error: string | null;
  getProfiles: (projectDir: string) => AgentProfile[];
  createProfile: (profile: AgentProfile, projectDir?: string) => Promise<void>;
  updateProfile: (profile: AgentProfile, projectDir?: string) => Promise<void>;
  deleteProfile: (profileId: string, projectDir?: string) => Promise<void>;
  refreshProfiles: (projectDir?: string) => Promise<void>;
  updateProfilesOrder: (agentProfiles: AgentProfile[]) => Promise<void>;
}

const AgentsContext = createContext<AgentsContextType | undefined>(undefined);

interface AgentsProviderProps {
  children: ReactNode;
}

export const AgentsProvider = ({ children }: AgentsProviderProps) => {
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [optimisticProfiles, setOptimisticProfiles] = useOptimistic(profiles);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const api = useApi();

  const refreshProfiles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.getAllAgentProfiles();
      setProfiles(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent profiles');
    } finally {
      setLoading(false);
    }
  }, [api]);

  const getProfiles = useCallback(
    (projectDir: string) => {
      return optimisticProfiles.filter((p) => p.projectDir === projectDir || !p.projectDir);
    },
    [optimisticProfiles],
  );

  const createProfile = async (profile: AgentProfile, projectDir?: string) => {
    try {
      startTransition(async () => {
        setOptimisticProfiles((current) => [...current, profile]);
        await api.createAgentProfile(profile, projectDir);
        await refreshProfiles();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent profile');
      throw err;
    }
  };

  const updateProfile = async (profile: AgentProfile, projectDir?: string) => {
    try {
      startTransition(async () => {
        setOptimisticProfiles((current) => current.map((p) => (p.id === profile.id ? profile : p)));
        await api.updateAgentProfile(profile, projectDir);
        await refreshProfiles();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update agent profile');
      throw err;
    }
  };

  const deleteProfile = async (profileId: string, projectDir?: string) => {
    try {
      startTransition(async () => {
        setOptimisticProfiles((current) => current.filter((p) => p.id !== profileId));
        await api.deleteAgentProfile(profileId, projectDir);
        await refreshProfiles();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete agent profile');
      throw err;
    }
  };

  const updateProfilesOrder = async (agentProfiles: AgentProfile[]): Promise<void> => {
    try {
      startTransition(async () => {
        setOptimisticProfiles(agentProfiles);
        await api.updateAgentProfilesOrder(agentProfiles);
        await refreshProfiles();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update agent profiles order');
      throw err;
    }
  };

  useEffect(() => {
    void refreshProfiles();

    // Register event listener for agent profiles updates
    const unsubscribe = api.addAgentProfilesUpdatedListener((data) => {
      setProfiles(data.profiles);
    });

    return () => {
      unsubscribe();
    };
  }, [api, refreshProfiles]);

  const value: AgentsContextType = {
    profiles: optimisticProfiles,
    loading,
    error,
    createProfile,
    updateProfile,
    deleteProfile,
    refreshProfiles,
    getProfiles,
    updateProfilesOrder,
  };

  return <AgentsContext.Provider value={value}>{children}</AgentsContext.Provider>;
};

export const useAgents = (): AgentsContextType => {
  const context = useContext(AgentsContext);
  if (context === undefined) {
    throw new Error('useAgents must be used within an AgentsProvider');
  }
  return context;
};
