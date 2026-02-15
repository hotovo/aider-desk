import { ProjectSettings } from '@aider-desk/common/types';
import { createContext, ReactNode, startTransition, useContext, useEffect, useOptimistic, useState } from 'react';

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

  useEffect(() => {
    return api.addProjectSettingsUpdatedListener(baseDir, (data) => {
      setProjectSettings(data.settings);
    });
  }, [baseDir, api]);

  return (
    <ProjectSettingsContext.Provider
      value={{
        projectSettings: optimisticProjectSettings,
        saveProjectSettings,
      }}
    >
      {children}
    </ProjectSettingsContext.Provider>
  );
};

export const useProjectSettings = () => {
  const context = useContext(ProjectSettingsContext);
  if (context === undefined) {
    throw new Error('useProjectSettings must be used within a ProjectSettingsProvider');
  }
  return context;
};
