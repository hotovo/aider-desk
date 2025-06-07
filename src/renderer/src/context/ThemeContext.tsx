import { Theme } from '@common/types';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import defaultThemes from '@common/themes/themes.json';
import { useThemeVariables } from '@/hooks/useThemeVariables';

type ThemeContextType = {
  themes: Theme[];
  currentTheme: Theme | null;
  setCurrentThemeById: (themeId: string) => void;
  saveThemes: (themes: Theme[]) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [themes, setThemes] = useState<Theme[]>(defaultThemes.themes as Theme[]);
  const [currentTheme, setCurrentTheme] = useState<Theme | null>(null);
  
  // Apply theme CSS variables
  useThemeVariables(currentTheme);

  useEffect(() => {
    const loadThemes = async () => {
      try {
        const customThemes = await window.api.loadThemes();
        if (customThemes && customThemes.themes && customThemes.themes.length > 0) {
          setThemes(customThemes.themes);
        }
      } catch (error) {
        console.error('Failed to load custom themes:', error);
      }
    };
    
    void loadThemes();
  }, []);
  
  // Set default theme if none is set
  useEffect(() => {
    if (!currentTheme && themes.length > 0) {
      // Set dark-default as the fallback theme immediately
      const defaultTheme = themes.find(t => t.id === 'dark-default') || themes[0];
      setCurrentTheme(defaultTheme);
    }
  }, [currentTheme, themes]);

  const setCurrentThemeById = (themeId: string) => {
    const theme = themes.find((t) => t.id === themeId);
    if (theme) {
      setCurrentTheme(theme);
    }
  };

  const saveThemes = async (updatedThemes: Theme[]) => {
    try {
      setThemes(updatedThemes);
      await window.api.saveThemes(updatedThemes);
      
      // If current theme was updated, reapply it
      if (currentTheme) {
        const updatedCurrentTheme = updatedThemes.find(t => t.id === currentTheme.id);
        if (updatedCurrentTheme) {
          setCurrentTheme(updatedCurrentTheme);
        }
      }
    } catch (error) {
      console.error('Failed to save themes:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ themes, currentTheme, setCurrentThemeById, saveThemes }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};