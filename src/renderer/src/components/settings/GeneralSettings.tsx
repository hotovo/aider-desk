import { useTranslation } from 'react-i18next';
import { Font, FONTS, SettingsData, ProjectStartMode, SuggestionMode, Theme, THEMES, DiffViewMode, MessageViewMode } from '@common/types';

import { Checkbox } from '../common/Checkbox';
import { RadioButton } from '../common/RadioButton';
import { Select, Option } from '../common/Select';
import { Section } from '../common/Section';
import { Slider } from '../common/Slider';
import { InfoIcon } from '../common/InfoIcon';

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

const FONT_SIZE_OPTIONS: Option[] = [
  { label: '12px', value: '12' },
  { label: '13px', value: '13' },
  { label: '14px', value: '14' },
  { label: '15px', value: '15' },
  { label: '16px', value: '16' },
  { label: '17px', value: '17' },
  { label: '18px', value: '18' },
  { label: '20px', value: '20' },
  { label: '22px', value: '22' },
  { label: '24px', value: '24' },
  { label: '28px', value: '28' },
  { label: '32px', value: '32' },
];

type Props = {
  settings: SettingsData;
  setSettings: (settings: SettingsData) => void;
  onLanguageChange: (language: string) => void;
  onZoomChange: (zoomLevel: number) => void;
  onThemeChange: (themeName: Theme) => void;
  onFontChange: (fontName: Font) => void;
  onFontSizeChange: (fontSize: number) => void;
};

export const GeneralSettings = ({ settings, setSettings, onLanguageChange, onZoomChange, onThemeChange, onFontChange, onFontSizeChange }: Props) => {
  const { t } = useTranslation();

  const fontOptions: Option[] = FONTS.map((font) => ({
    label: t(`settings.fontOptions.${font}`, font),
    value: font,
    style: { fontFamily: font },
  })).sort((a, b) => a.label.localeCompare(b.label));

  const themeOptions: Option[] = THEMES.map((theme) => ({
    label: t(`settings.themeOptions.${theme}`, theme),
    value: theme,
  })).sort((a, b) => (a.label as string).localeCompare(b.label as string));

  const diffViewOptions: Option[] = [
    { label: t('diffViewer.sideBySide'), value: DiffViewMode.SideBySide },
    { label: t('diffViewer.unified'), value: DiffViewMode.Unified },
    { label: t('diffViewer.compact'), value: DiffViewMode.Compact },
  ];

  const messageViewOptions: Option[] = [
    { label: t('settings.messages.viewModeFull'), value: MessageViewMode.Full },
    { label: t('settings.messages.viewModeCompact'), value: MessageViewMode.Compact },
  ];

  const handleStartupModeChange = (mode: ProjectStartMode) => {
    setSettings({
      ...settings,
      startupMode: mode,
    });
  };

  const handleStartupModeClick = (value: string) => {
    handleStartupModeChange(value as ProjectStartMode);
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

  const handleThemeChange = (value: string) => {
    setSettings({
      ...settings,
      theme: value as Theme,
    });
    onThemeChange(value as Theme);
  };

  const handleFontChange = (value: string) => {
    setSettings({
      ...settings,
      font: value as Font,
    });
    onFontChange(value as Font);
  };

  const handleFontSizeChange = (value: string) => {
    const newFontSize = parseFloat(value);
    setSettings({
      ...settings,
      fontSize: newFontSize,
    });
    onFontSizeChange(newFontSize);
  };

  const handleDiffViewModeChange = (value: string) => {
    setSettings({
      ...settings,
      diffViewMode: value as DiffViewMode,
    });
  };

  const handleMessageViewModeChange = (value: string) => {
    setSettings({
      ...settings,
      messageViewMode: value as MessageViewMode,
    });
  };

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

  return (
    <div className="space-y-6">
      <Section id="general-gui" title={t('settings.gui')}>
        <div className="grid grid-cols-2 gap-4 pt-4 px-4">
          <LanguageSelector language={settings.language} onChange={onLanguageChange} size="sm" />
          <Select
            label={<span className="text-xs">{t('settings.zoom')}</span>}
            options={ZOOM_OPTIONS}
            value={String(settings.zoomLevel ?? 1)}
            onChange={handleZoomChange}
            size="sm"
          />
        </div>
        <div className="grid grid-cols-3 gap-4 p-4">
          <Select
            label={<span className="text-xs">{t('settings.theme')}</span>}
            options={themeOptions}
            value={settings.theme ?? 'dark'}
            onChange={handleThemeChange}
            className="col-span-3"
            size="sm"
          />
          <Select
            label={<span className="text-xs">{t('settings.font')}</span>}
            options={fontOptions}
            value={settings.font ?? 'sono'}
            onChange={handleFontChange}
            size="sm"
          />
          <Select
            label={<span className="text-xs">{t('settings.fontSize')}</span>}
            options={FONT_SIZE_OPTIONS}
            value={String(settings.fontSize ?? 16)}
            onChange={handleFontSizeChange}
            size="sm"
          />
        </div>
      </Section>

      <Section id="general-startup" title={t('settings.startup.title')}>
        <div className="px-4 py-3 space-y-3 mt-2">
          <RadioButton
            id="startup-empty"
            name="startup-mode"
            value={ProjectStartMode.Empty}
            checked={settings.startupMode === ProjectStartMode.Empty}
            onChange={handleStartupModeClick}
            label={t('settings.startup.emptyTask')}
          />

          <RadioButton
            id="startup-last"
            name="startup-mode"
            value={ProjectStartMode.Last}
            checked={settings.startupMode === ProjectStartMode.Last}
            onChange={handleStartupModeClick}
            label={t('settings.startup.lastTask')}
          />
        </div>
      </Section>

      <Section id="general-messages" title={t('settings.messages.title')}>
        <div className="px-4 py-5 grid grid-cols-2 gap-x-10 gap-y-6">
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-text-muted">{t('settings.messages.display')}</h4>
            <div className="space-y-2 ml-0.5">
              <Checkbox
                label={t('settings.messages.markdownRendering')}
                checked={settings.renderMarkdown ?? true}
                onChange={(checked) =>
                  setSettings({
                    ...settings,
                    renderMarkdown: checked,
                  })
                }
              />
              <div className="flex items-center space-x-2">
                <Checkbox
                  label={t('settings.messages.virtualizedRendering')}
                  checked={settings.virtualizedRendering ?? false}
                  onChange={(checked) =>
                    setSettings({
                      ...settings,
                      virtualizedRendering: checked,
                    })
                  }
                />
                <InfoIcon tooltip={t('settings.messages.virtualizedRenderingTooltip')} />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Select
              label={<span className="text-xs">{t('settings.messages.viewMode')}</span>}
              options={messageViewOptions}
              value={settings.messageViewMode ?? MessageViewMode.Full}
              onChange={handleMessageViewModeChange}
              size="sm"
            />
            <Select
              label={<span className="text-xs">{t('settings.messages.diffViewMode')}</span>}
              options={diffViewOptions}
              value={settings.diffViewMode ?? DiffViewMode.SideBySide}
              onChange={handleDiffViewModeChange}
              size="sm"
            />
          </div>
        </div>
      </Section>

      <Section id="general-prompt" title={t('settings.promptBehavior.title')}>
        <div className="px-4 py-5 grid grid-cols-2 gap-x-10 gap-y-6">
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-text-muted">{t('settings.promptBehavior.showSuggestions')}</h4>
            <div className="space-y-2 ml-0.5">
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
              <RadioButton
                id="suggestion-at-sign"
                name="suggestion-mode"
                value={SuggestionMode.MentionAtSign}
                checked={settings.promptBehavior.suggestionMode === SuggestionMode.MentionAtSign}
                onChange={handleSuggestionModeClick}
                label={t('settings.promptBehavior.modeAtSign')}
              />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-text-muted">{t('settings.promptBehavior.requireCommandConfirmation')}</h4>
            <div className="space-y-2 ml-0.5">
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

          {/* Vim key bindings */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-text-muted">{t('settings.promptBehavior.keyBindings')}</h4>
            <div className="flex items-center space-x-2 ml-0.5">
              <Checkbox
                label={t('settings.promptBehavior.useVimBindings')}
                checked={settings.promptBehavior.useVimBindings}
                onChange={(checked) =>
                  setSettings({
                    ...settings,
                    promptBehavior: {
                      ...settings.promptBehavior,
                      useVimBindings: checked,
                    },
                  })
                }
                data-testid="vim-bindings-checkbox"
              />
              <InfoIcon tooltip={t('settings.promptBehavior.useVimBindingsTooltip')} />
            </div>
          </div>
        </div>
      </Section>

      <Section id="general-notifications" title={t('settings.notifications.title')}>
        <div className="px-4 py-3 space-y-3 mt-2">
          <Checkbox label={t('settings.notificationsEnabled')} checked={settings.notificationsEnabled ?? false} onChange={handleNotificationsEnabledChange} />
        </div>
      </Section>
    </div>
  );
};
