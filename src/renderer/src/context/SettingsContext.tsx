import { Font, SettingsData, Theme } from '@common/types';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

import { useApi } from '@/context/ApiContext';

type SettingsContextType = {
  settings: SettingsData | null;
  saveSettings: (settings: SettingsData) => Promise<void>;
  theme: Theme | null;
  saveTheme: (theme: Theme) => void;
  font: Font | null;
  saveFont: (font: Font) => void;
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [theme, setTheme] = useState<Theme | null>(null);
  const [font, setFont] = useState<Font | null>(null);
  const api = useApi();

  useEffect(() => {
    const loadSettings = async () => {
      const loadedSettings = await api.loadSettings();
      setSettings(loadedSettings);
      setTheme(loadedSettings.theme || null);
      setFont(loadedSettings.font || null);
    };
    void loadSettings();
  }, [api]);

  const saveSettings = async (updated: SettingsData) => {
    try {
      setSettings(updated);
      const updatedSettings = await api.saveSettings(updated);
      setSettings(updatedSettings);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to save settings:', error);
    }
  };

  const saveTheme = async (theme: Theme) => {
    try {
      setTheme(theme);
      const updatedTheme = await api.saveTheme(theme);
      setTheme(updatedTheme);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to save theme:', error);
    }
  };

  const saveFont = async (font: Font) => {
    try {
      setFont(font);
      const updatedFont = await api.saveFont(font);
      setFont(updatedFont);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to save font:', error);
    }
  };

  return <SettingsContext.Provider value={{ settings, saveSettings, theme, saveTheme, font, saveFont }}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
