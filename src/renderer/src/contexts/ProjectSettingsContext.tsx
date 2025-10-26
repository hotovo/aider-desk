import { ProjectSettings } from '@common/types';
import { createContext, useContext, useState, useEffect, ReactNode, useOptimistic, startTransition } from 'react';
import { DEFAULT_AGENT_PROFILE } from '@common/agent';

import { useSettings } from '@/contexts/SettingsContext';
import { useApi } from '@/contexts/ApiContext';

type ProjectSettingsContextType = {
  projectSettings: ProjectSettings | null;
  saveProjectSettings: (settings: Partial<ProjectSettings>) => Promise<void>;
};

const ProjectSettingsContext = createContext<ProjectSettingsContextType | undefined>(undefined);

type ProjectSettingsProviderProps = {
  baseDir: string;
  children: ReactNode;
};

export const ProjectSettingsProvider = ({ baseDir, children }: ProjectSettingsProviderProps) => {
  const { settings } = useSettings();
  const [projectSettings, setProjectSettings] = useState<ProjectSettings | null>(null);
  const [optimisticProjectSettings, setOptimisticProjectSettings] = useOptimistic(projectSettings);
  const api = useApi();

  const saveProjectSettings = async (updated: Partial<ProjectSettings>) => {
    startTransition(async () => {
      try {
        // Optimistically update the state
        setOptimisticProjectSettings((prev) => (prev ? { ...prev, ...updated } : null));
        const updatedSettings = await api.patchProjectSettings(baseDir, updated);
        setProjectSettings(updatedSettings); // Ensure state is in sync with backend
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Failed to save project settings for ${baseDir}:`, error);
      }
    });
  };

  if (projectSettings && settings) {
    // check if active agent profile still exists in settings
    const activeProfile = settings.agentProfiles.find((profile) => profile.id === projectSettings.agentProfileId);

    if (!activeProfile) {
      void saveProjectSettings({
        agentProfileId: DEFAULT_AGENT_PROFILE.id,
      });
    }
  }

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loadedSettings = await api.getProjectSettings(baseDir);
        setProjectSettings(loadedSettings);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Failed to load project settings for ${baseDir}:`, error);
      }
    };
    void loadSettings();
  }, [baseDir, api]);

  return (
    <ProjectSettingsContext.Provider value={{ projectSettings: optimisticProjectSettings, saveProjectSettings }}>{children}</ProjectSettingsContext.Provider>
  );
};

export const useProjectSettings = () => {
  const context = useContext(ProjectSettingsContext);
  if (context === undefined) {
    throw new Error('useProjectSettings must be used within a ProjectSettingsProvider');
  }
  return context;
};
