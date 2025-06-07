import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsData, Theme } from '@common/types';
import { useTheme } from '@/context/ThemeContext';

import { Section } from '../common/Section';
import { Select, Option } from '../common/Select';
import { Button } from '../common/Button';
import { ThemeEditor } from './ThemeEditor';
import { ThemePreview } from '../common/ThemePreview';
import { ConfirmDialog } from '@/components/ConfirmDialog';

type Props = {
  settings: SettingsData;
  setSettings: (settings: SettingsData) => void;
};

export const ThemeSettings = ({ settings, setSettings }: Props) => {
  const { t } = useTranslation();
  const { themes, setCurrentThemeById, saveThemes } = useTheme();
  const [showThemeEditor, setShowThemeEditor] = useState(false);
  
  const themeOptions: Option[] = themes.map((theme) => ({
    label: theme.name,
    value: theme.id,
  }));
  
  const handleThemeChange = (themeId: string) => {
    const selectedTheme = themes.find((t) => t.id === themeId);
    if (selectedTheme) {
      // Update settings (this will be saved when user clicks Save)
      setSettings({
        ...settings,
        themeId,
        theme: selectedTheme.type,
      });
      
      // Apply theme immediately for preview (this is temporary)
      setCurrentThemeById(themeId);
    }
  };
  
  const handleResetToDefaults = async () => {
    try {
      // Import default themes
      const defaultThemes = await import('@common/themes/themes.json');
      await saveThemes(defaultThemes.themes as Theme[]);
      
      // Reset current theme to dark default
      const defaultThemeId = 'dark-default';
      setSettings({
        ...settings,
        themeId: defaultThemeId,
        theme: 'dark',
      });
      setCurrentThemeById(defaultThemeId);
    } catch (error) {
      console.error('Failed to reset themes to defaults:', error);
    }
  };
  
  const currentThemeId = settings.themeId || (settings.theme === 'light' ? 'light-default' : 'dark-default');
  
  return (
    <div>
      <Section title={t('settings.themeSettings.title')}>
        <div className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
            <div className="flex-1">
              <Select
                label={t('settings.themeSettings.selectTheme')}
                options={themeOptions}
                value={currentThemeId}
                onChange={handleThemeChange}
                className="w-full sm:w-64"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                color="secondary"
                onClick={handleResetToDefaults}
                className="w-full sm:w-auto"
              >
                {t('settings.themeSettings.resetToDefaults')}
              </Button>
              <Button
                variant="outline"
                color="primary"
                onClick={() => setShowThemeEditor(true)}
                className="w-full sm:w-auto"
              >
                {t('settings.themeSettings.customizeThemes')}
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {themes.map(theme => (
              <ThemePreview 
                key={theme.id}
                theme={theme}
                isSelected={theme.id === currentThemeId}
                onClick={() => handleThemeChange(theme.id)}
              />
            ))}
          </div>
        </div>
      </Section>
      
      {showThemeEditor && (
        <ConfirmDialog
          title={t('settings.themeSettings.themeEditor')}
          onCancel={() => setShowThemeEditor(false)}
          onConfirm={() => setShowThemeEditor(false)}
          width={800}
        >
          <ThemeEditor onClose={() => setShowThemeEditor(false)} />
        </ConfirmDialog>
      )}
    </div>
  );
};