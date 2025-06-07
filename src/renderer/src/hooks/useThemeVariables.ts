import { useEffect } from 'react';
import { Theme } from '@common/types';

/**
 * A hook that applies theme CSS variables to the document root element
 * @param theme The theme to apply
 */
export const useThemeVariables = (theme: Theme | null) => {
  useEffect(() => {
    if (!theme) return;
    
    const root = document.documentElement;
    
    // Apply theme variables
    root.style.setProperty('--theme-background-primary', theme.colors.background.primary);
    root.style.setProperty('--theme-background-secondary', theme.colors.background.secondary);
    root.style.setProperty('--theme-background-tertiary', theme.colors.background.tertiary);
    root.style.setProperty('--theme-background-input', theme.colors.background.input);
    
    root.style.setProperty('--theme-foreground-primary', theme.colors.foreground.primary);
    root.style.setProperty('--theme-foreground-secondary', theme.colors.foreground.secondary);
    root.style.setProperty('--theme-foreground-tertiary', theme.colors.foreground.tertiary);
    root.style.setProperty('--theme-foreground-error', theme.colors.foreground.error);
    
    root.style.setProperty('--theme-border-primary', theme.colors.border.primary);
    root.style.setProperty('--theme-border-secondary', theme.colors.border.secondary);
    
    root.style.setProperty('--theme-accent-primary', theme.colors.accent.primary);
    root.style.setProperty('--theme-accent-secondary', theme.colors.accent.secondary);
    root.style.setProperty('--theme-accent-tertiary', theme.colors.accent.tertiary);
    
    root.style.setProperty('--theme-button-primary', theme.colors.button.primary);
    root.style.setProperty('--theme-button-secondary', theme.colors.button.secondary);
    root.style.setProperty('--theme-button-danger', theme.colors.button.danger);
    
    // Component-specific variables
    root.style.setProperty('--input-background', theme.colors.background.input);
    root.style.setProperty('--input-text', theme.colors.foreground.primary);
    root.style.setProperty('--input-border', theme.colors.border.primary);
    root.style.setProperty('--input-placeholder', theme.colors.foreground.tertiary);
    
    root.style.setProperty('--button-primary-background', theme.colors.button.primary);
    root.style.setProperty('--button-primary-text', theme.colors.foreground.primary);
    root.style.setProperty('--button-secondary-background', theme.colors.button.secondary);
    root.style.setProperty('--button-secondary-text', theme.colors.foreground.primary);
    root.style.setProperty('--button-danger-background', theme.colors.button.danger);
    root.style.setProperty('--button-danger-text', theme.colors.foreground.primary);
    
    root.style.setProperty('--card-background', theme.colors.background.secondary);
    root.style.setProperty('--card-border', theme.colors.border.primary);
    
    root.style.setProperty('--scrollbar-track', theme.colors.background.tertiary);
    root.style.setProperty('--scrollbar-thumb', theme.colors.border.secondary);
    root.style.setProperty('--scrollbar-thumb-hover', theme.colors.border.primary);
    
    // Set theme type class
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${theme.type}`);
    
  }, [theme]);
};