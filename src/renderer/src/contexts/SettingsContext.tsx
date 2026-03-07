import { Font, SettingsData, Theme } from '@common/types';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

import { useApi } from '@/contexts/ApiContext';

type SettingsContextType = {
  settings: SettingsData | null;
  saveSettings: (settings: SettingsData) => Promise<void>;
  theme: Theme | null;
  setTheme: (theme: Theme) => void;
  font: Font | null;
  setFont: (font: Font) => void;
  fontSize: number | null;
  setFontSize: (fontSize: number) => void;
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [theme, setTheme] = useState<Theme | null>(null);
  const [font, setFont] = useState<Font | null>(null);
  const [fontSize, setFontSize] = useState<number | null>(null);
  const api = useApi();

  useEffect(() => {
    const loadSettings = async () => {
      const loadedSettings = await api.loadSettings();
      setSettings(loadedSettings);
      setTheme(loadedSettings.theme || null);
      setFont(loadedSettings.font || null);
      setFontSize(loadedSettings.fontSize || null);
    };
    void loadSettings();
  }, [api]);

  useEffect(() => {
    return api.addSettingsUpdatedListener((data) => {
      setSettings(data);
      setTheme(data.theme || null);
      setFont(data.font || null);
      setFontSize(data.fontSize || null);
    });
  }, [api]);

  const saveSettings = async (updated: SettingsData) => {
    try {
      setSettings(updated);
      const updatedSettings = await api.saveSettings(updated);
      setSettings(updatedSettings);
      setTheme(updatedSettings.theme || null);
      setFont(updatedSettings.font || null);
      setFontSize(updatedSettings.fontSize || null);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to save settings:', error);
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, saveSettings, theme, setTheme, font, setFont, fontSize, setFontSize }}>{children}</SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
