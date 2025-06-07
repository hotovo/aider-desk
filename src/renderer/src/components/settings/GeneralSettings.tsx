import { useTranslation } from 'react-i18next';
import { SettingsData, StartupMode, SuggestionMode } from '@common/types';

import { Checkbox } from '../common/Checkbox';
import { RadioButton } from '../common/RadioButton';
import { Select, Option } from '../common/Select';
import { Section } from '../common/Section';
import { Slider } from '../common/Slider';

import { LanguageSelector } from './LanguageSelector';

const ZOOM_OPTIONS: Option[] = [
  { label: '80%', value: '0.8' },
  { label: '90%', value: '0.9' },
  { label: '100%', value: '1' },
  { label: '110%', value: '1.1' },
  { label: '120%', value: '1.2' },
  { label: '130%', value: '1.3' },
  { label: '140%', value: '1.4' },
  { label: '150%', value: '1.5' },
];

const FONT_FAMILIES = [
  'Sono',
  'Tektur',
  'system-ui',
  'Inter',
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Verdana',
];

const MONOSPACE_FONT_FAMILIES = [
  'Sono',
  'MonaspaceKrypton-SemiBold',
  'ui-monospace',
  'JetBrains Mono',
  'Fira Code',
  'Source Code Pro',
  'Monaco',
  'Menlo',
  'Consolas',
  'Courier New',
];

type Props = {
  settings: SettingsData;
  setSettings: (settings: SettingsData) => void;
  onLanguageChange: (language: string) => void;
  onZoomChange: (zoomLevel: number) => void;
  onFontChange?: (fontFamily: string, monospaceFontFamily: string) => void;
};

export const GeneralSettings = ({ settings, setSettings, onLanguageChange, onZoomChange, onFontChange }: Props) => {
  const { t } = useTranslation();

  // Theme options moved to ThemeSettings

  const fontOptions: Option[] = FONT_FAMILIES.map(font => ({
    label: t(`settings.fontOptions.${font}`),
    value: font,
  }));

  const monospaceFontOptions: Option[] = MONOSPACE_FONT_FAMILIES.map(font => ({
    label: t(`settings.monospaceFontOptions.${font}`),
    value: font,
  }));

  const handleStartupModeChange = (mode: StartupMode) => {
    setSettings({
      ...settings,
      startupMode: mode,
    });
  };

  const handleStartupModeClick = (value: string) => {
    handleStartupModeChange(value as StartupMode);
  };

  const handleZoomChange = (value: string) => {
    const newZoomLevel = parseFloat(value);
    if (!isNaN(newZoomLevel)) {
      onZoomChange(newZoomLevel);
    }
  };

  const handleNotificationsEnabledChange = (checked: boolean) => {
    setSettings({
      ...settings,
      notificationsEnabled: checked,
    });
  };

  // Theme change handler moved to ThemeSettings

  const handleSuggestionModeChange = (mode: SuggestionMode) => {
    setSettings({
      ...settings,
      promptBehavior: {
        ...settings.promptBehavior,
        suggestionMode: mode,
      },
    });
  };

  const handleSuggestionModeClick = (value: string) => {
    handleSuggestionModeChange(value as SuggestionMode);
  };

  const handleSuggestionDelayChange = (delay: number) => {
    setSettings({
      ...settings,
      promptBehavior: {
        ...settings.promptBehavior,
        suggestionDelay: delay,
      },
    });
  };

  const handleCommandConfirmationChange = (command: keyof typeof settings.promptBehavior.requireCommandConfirmation, checked: boolean) => {
    setSettings({
      ...settings,
      promptBehavior: {
        ...settings.promptBehavior,
        requireCommandConfirmation: {
          ...settings.promptBehavior.requireCommandConfirmation,
          [command]: checked,
        },
      },
    });
  };

  const handleFontFamilyChange = (value: string) => {
    const newSettings = {
      ...settings,
      fontFamily: value,
    };
    setSettings(newSettings);
    
    // Apply font changes immediately
    const root = document.documentElement;
    root.style.setProperty('--font-family-sans', value);
    console.log('Font family changed:', value);
    
    onFontChange?.(value, settings.monospaceFontFamily ?? 'Sono');
  };

  const handleMonospaceFontFamilyChange = (value: string) => {
    const newSettings = {
      ...settings,
      monospaceFontFamily: value,
    };
    setSettings(newSettings);
    
    // Apply font changes immediately
    const root = document.documentElement;
    root.style.setProperty('--font-family-mono', value);
    console.log('Monospace font family changed:', value);
    
    onFontChange?.(settings.fontFamily ?? 'Sono', value);
  };

  return (
    <div className="space-y-8 min-h-[300px]">
      <Section title={t('settings.gui')}>
        <div className="grid grid-cols-2 gap-4 p-4">
          <LanguageSelector language={settings.language} onChange={onLanguageChange} />
          <Select label={t('settings.zoom')} options={ZOOM_OPTIONS} value={String(settings.zoomLevel ?? 1)} onChange={handleZoomChange} />
          {/* Theme selector moved to ThemeSettings */}
          <Select 
            label={t('settings.fontFamily')} 
            options={fontOptions} 
            value={settings.fontFamily ?? 'Sono'} 
            onChange={handleFontFamilyChange} 
          />
          <Select 
            label={t('settings.monospaceFontFamily')} 
            options={monospaceFontOptions} 
            value={settings.monospaceFontFamily ?? 'Sono'} 
            onChange={handleMonospaceFontFamilyChange} 
          />
        </div>
      </Section>

      <Section title={t('settings.startup.title')}>
        <div className="px-4 py-3 space-y-3 mt-2">
          <RadioButton
            id="startup-empty"
            name="startup-mode"
            value={StartupMode.Empty}
            checked={settings.startupMode === StartupMode.Empty}
            onChange={handleStartupModeClick}
            label={t('settings.startup.emptySession')}
          />

          <RadioButton
            id="startup-last"
            name="startup-mode"
            value={StartupMode.Last}
            checked={settings.startupMode === StartupMode.Last}
            onChange={handleStartupModeClick}
            label={t('settings.startup.lastSession')}
          />
        </div>
      </Section>

      <Section title={t('settings.promptBehavior.title')}>
        <div className="px-4 py-5 grid grid-cols-2 gap-10">
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('settings.promptBehavior.showSuggestions')}</h4>
            <div className="space-y-2 ml-2">
              <RadioButton
                id="suggestion-automatically"
                name="suggestion-mode"
                value={SuggestionMode.Automatically}
                checked={settings.promptBehavior.suggestionMode === SuggestionMode.Automatically}
                onChange={handleSuggestionModeClick}
                label={t('settings.promptBehavior.automaticallyWhileTyping')}
              />

              {settings.promptBehavior.suggestionMode === SuggestionMode.Automatically && (
                <div className="ml-6 mt-3 mr-10">
                  <Slider
                    label={<span className="text-xs">{t('settings.promptBehavior.suggestionsDelay')}</span>}
                    min={0}
                    max={2000}
                    step={100}
                    value={settings.promptBehavior.suggestionDelay}
                    onChange={handleSuggestionDelayChange}
                    showValue={true}
                    className="max-w-[260px]"
                  />
                </div>
              )}

              <RadioButton
                id="suggestion-tab"
                name="suggestion-mode"
                value={SuggestionMode.OnTab}
                checked={settings.promptBehavior.suggestionMode === SuggestionMode.OnTab}
                onChange={handleSuggestionModeClick}
                label={t('settings.promptBehavior.onlyWhenTabPressed')}
              />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('settings.promptBehavior.requireCommandConfirmation')}</h4>
            <div className="space-y-2 ml-2">
              <Checkbox
                label={t('settings.promptBehavior.addCommand')}
                checked={settings.promptBehavior.requireCommandConfirmation.add}
                onChange={(checked) => handleCommandConfirmationChange('add', checked)}
              />
              <Checkbox
                label={t('settings.promptBehavior.readOnlyCommand')}
                checked={settings.promptBehavior.requireCommandConfirmation.readOnly}
                onChange={(checked) => handleCommandConfirmationChange('readOnly', checked)}
              />
              <Checkbox
                label={t('settings.promptBehavior.modelCommand')}
                checked={settings.promptBehavior.requireCommandConfirmation.model}
                onChange={(checked) => handleCommandConfirmationChange('model', checked)}
              />
              <Checkbox
                label={t('settings.promptBehavior.modeSwitchingCommands')}
                checked={settings.promptBehavior.requireCommandConfirmation.modeSwitching}
                onChange={(checked) => handleCommandConfirmationChange('modeSwitching', checked)}
              />
            </div>
          </div>
        </div>
      </Section>

      <Section title={t('settings.notifications.title')}>
        <div className="px-4 py-3 space-y-3 mt-2">
          <Checkbox label={t('settings.notificationsEnabled')} checked={settings.notificationsEnabled ?? false} onChange={handleNotificationsEnabledChange} />
        </div>
      </Section>
    </div>
  );
};
