import { ProjectSettings } from '@common/types';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { DEFAULT_AGENT_PROFILE } from '@common/agent';

import { useSettings } from '@/context/SettingsContext';
import { useApi } from '@/context/ApiContext';

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
  const api = useApi();

  const saveProjectSettings = async (updated: Partial<ProjectSettings>) => {
    try {
      // Optimistically update the state
      setProjectSettings((prev) => (prev ? { ...prev, ...updated } : null));
      const updatedSettings = await api.patchProjectSettings(baseDir, updated);
      setProjectSettings(updatedSettings); // Ensure state is in sync with backend
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Failed to save project settings for ${baseDir}:`, error);
    }
  };

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
  // check if active agent profile still exists in settings

  useEffect(() => {
    if (projectSettings && settings) {
      const activeProfile = settings.agentProfiles.find((profile) => profile.id === projectSettings.agentProfileId);

      if (!activeProfile) {
        void saveProjectSettings({
          agentProfileId: DEFAULT_AGENT_PROFILE.id,
        });
      }
    }
    // eslint-disable-next-line
  }, [settings]);

  return <ProjectSettingsContext.Provider value={{ projectSettings, saveProjectSettings }}>{children}</ProjectSettingsContext.Provider>;
};

export const useProjectSettings = () => {
  const context = useContext(ProjectSettingsContext);
  if (context === undefined) {
    throw new Error('useProjectSettings must be used within a ProjectSettingsProvider');
  }
  return context;
};
