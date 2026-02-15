import { useTranslation } from 'react-i18next';
import { HotkeyConfig, SettingsData } from '@aider-desk/common/types';

import { Section } from '../common/Section';

import { HotkeyConfig as HotkeyConfigRow } from './HotkeyConfig';

import { Button } from '@/components/common/Button';
import { DEFAULT_HOTKEY_CONFIG } from '@/utils/hotkeys';

type Props = {
  settings: SettingsData;
  setSettings: (settings: SettingsData) => void;
};

export const HotkeysSettings = ({ settings, setSettings }: Props) => {
  const { t } = useTranslation();

  const mergedHotkeyConfig: HotkeyConfig = {
    ...DEFAULT_HOTKEY_CONFIG,
    ...settings.hotkeyConfig,
    projectHotkeys: {
      ...DEFAULT_HOTKEY_CONFIG.projectHotkeys,
      ...(settings.hotkeyConfig?.projectHotkeys ?? {}),
    },
    taskHotkeys: {
      ...DEFAULT_HOTKEY_CONFIG.taskHotkeys,
      ...(settings.hotkeyConfig?.taskHotkeys ?? {}),
    },
    dialogHotkeys: {
      ...DEFAULT_HOTKEY_CONFIG.dialogHotkeys,
      ...(settings.hotkeyConfig?.dialogHotkeys ?? {}),
    },
  };

  const handleChange = (category: keyof HotkeyConfig, key: string, value: string) => {
    const updatedHotkeyConfig: HotkeyConfig = {
      ...mergedHotkeyConfig,
      [category]: {
        ...(mergedHotkeyConfig[category] as Record<string, string>),
        [key]: value,
      },
    };

    setSettings({
      ...settings,
      hotkeyConfig: updatedHotkeyConfig,
    });
  };

  const handleReset = () => {
    setSettings({
      ...settings,
      hotkeyConfig: {
        ...DEFAULT_HOTKEY_CONFIG,
        projectHotkeys: { ...DEFAULT_HOTKEY_CONFIG.projectHotkeys },
        taskHotkeys: { ...DEFAULT_HOTKEY_CONFIG.taskHotkeys },
        dialogHotkeys: { ...DEFAULT_HOTKEY_CONFIG.dialogHotkeys },
      },
    });
  };

  const renderHotkeyConfig = (category: keyof HotkeyConfig, key: string, label: string) => {
    const categoryConfig = mergedHotkeyConfig[category] as Record<string, string>;
    const value = categoryConfig?.[key] ?? '';

    return <HotkeyConfigRow key={key} label={label} value={value} onChange={(newValue) => handleChange(category, key, newValue)} size="sm" />;
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="space-y-6 flex-1">
        <Section id="hotkeys-project" title={t('settings.hotkeys.projectHotkeys')}>
          <div className="px-5 py-3 space-y-1">
            {renderHotkeyConfig('projectHotkeys', 'closeProject', t('settings.hotkeys.closeProject'))}
            {renderHotkeyConfig('projectHotkeys', 'newProject', t('settings.hotkeys.newProject'))}
            {renderHotkeyConfig('projectHotkeys', 'usageDashboard', t('settings.hotkeys.usageDashboard'))}
            {renderHotkeyConfig('projectHotkeys', 'modelLibrary', t('settings.hotkeys.modelLibrary'))}
            {renderHotkeyConfig('projectHotkeys', 'settings', t('settings.hotkeys.settings'))}
            {renderHotkeyConfig('projectHotkeys', 'cycleNextProject', t('settings.hotkeys.cycleNextProject'))}
            {renderHotkeyConfig('projectHotkeys', 'cyclePrevProject', t('settings.hotkeys.cyclePrevProject'))}
            {renderHotkeyConfig('projectHotkeys', 'switchProject1', t('settings.hotkeys.switchProject', { number: 1 }))}
            {renderHotkeyConfig('projectHotkeys', 'switchProject2', t('settings.hotkeys.switchProject', { number: 2 }))}
            {renderHotkeyConfig('projectHotkeys', 'switchProject3', t('settings.hotkeys.switchProject', { number: 3 }))}
            {renderHotkeyConfig('projectHotkeys', 'switchProject4', t('settings.hotkeys.switchProject', { number: 4 }))}
            {renderHotkeyConfig('projectHotkeys', 'switchProject5', t('settings.hotkeys.switchProject', { number: 5 }))}
            {renderHotkeyConfig('projectHotkeys', 'switchProject6', t('settings.hotkeys.switchProject', { number: 6 }))}
            {renderHotkeyConfig('projectHotkeys', 'switchProject7', t('settings.hotkeys.switchProject', { number: 7 }))}
            {renderHotkeyConfig('projectHotkeys', 'switchProject8', t('settings.hotkeys.switchProject', { number: 8 }))}
            {renderHotkeyConfig('projectHotkeys', 'switchProject9', t('settings.hotkeys.switchProject', { number: 9 }))}
          </div>
        </Section>

        <Section id="hotkeys-task" title={t('settings.hotkeys.taskHotkeys')}>
          <div className="px-5 py-3 space-y-1">
            {renderHotkeyConfig('taskHotkeys', 'focusPrompt', t('settings.hotkeys.focusPrompt'))}
            {renderHotkeyConfig('taskHotkeys', 'newTask', t('settings.hotkeys.newTask'))}
            {renderHotkeyConfig('taskHotkeys', 'closeTask', t('settings.hotkeys.closeTask'))}
            {renderHotkeyConfig('taskHotkeys', 'switchTask1', t('settings.hotkeys.switchTask', { number: 1 }))}
            {renderHotkeyConfig('taskHotkeys', 'switchTask2', t('settings.hotkeys.switchTask', { number: 2 }))}
            {renderHotkeyConfig('taskHotkeys', 'switchTask3', t('settings.hotkeys.switchTask', { number: 3 }))}
            {renderHotkeyConfig('taskHotkeys', 'switchTask4', t('settings.hotkeys.switchTask', { number: 4 }))}
            {renderHotkeyConfig('taskHotkeys', 'switchTask5', t('settings.hotkeys.switchTask', { number: 5 }))}
            {renderHotkeyConfig('taskHotkeys', 'switchTask6', t('settings.hotkeys.switchTask', { number: 6 }))}
            {renderHotkeyConfig('taskHotkeys', 'switchTask7', t('settings.hotkeys.switchTask', { number: 7 }))}
            {renderHotkeyConfig('taskHotkeys', 'switchTask8', t('settings.hotkeys.switchTask', { number: 8 }))}
            {renderHotkeyConfig('taskHotkeys', 'switchTask9', t('settings.hotkeys.switchTask', { number: 9 }))}
          </div>
        </Section>

        <Section id="hotkeys-dialog" title={t('settings.hotkeys.dialogHotkeys')}>
          <div className="px-5 py-3 space-y-1">{renderHotkeyConfig('dialogHotkeys', 'browseFolder', t('settings.hotkeys.browseFolder'))}</div>
        </Section>
      </div>

      <div className="pt-4 pb-6 flex justify-end">
        <Button variant="outline" size="sm" onClick={handleReset} color="danger">
          {t('settings.hotkeys.resetToDefaults')}
        </Button>
      </div>
    </div>
  );
};
