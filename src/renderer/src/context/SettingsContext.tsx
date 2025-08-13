import { SettingsData, ThemeName } from '@common/types';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type SettingsContextType = {
  settings: SettingsData | null;
  saveSettings: (settings: SettingsData) => Promise<void>;
  theme: ThemeName | null;
  saveTheme: (theme: ThemeName) => void;
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [theme, setTheme] = useState<ThemeName | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      const loadedSettings = await window.api.loadSettings();
      setSettings(loadedSettings);
    };
    void loadSettings();
  }, []);

  const saveSettings = async (updated: SettingsData) => {
    try {
      setSettings(updated);
      const updatedSettings = await window.api.saveSettings(updated);
      setSettings(updatedSettings);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to save settings:', error);
    }
  };

  const saveTheme = async (theme: ThemeName) => {
    try {
      setTheme(theme);
      const updatedTheme = await window.api.saveTheme(theme);
      setTheme(updatedTheme);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to save theme:', error);
    }
  };

  return <SettingsContext.Provider value={{ settings, saveSettings, theme, saveTheme }}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
