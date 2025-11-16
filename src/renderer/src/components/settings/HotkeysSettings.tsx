import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HotkeyConfig } from '@common/types';

import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { DEFAULT_HOTKEY_CONFIG } from '@/utils/hotkeys';

type Props = {
  hotkeyConfig: HotkeyConfig;
  onSave: (config: HotkeyConfig) => void;
};

export const HotkeysSettings = ({ hotkeyConfig, onSave }: Props) => {
  const { t } = useTranslation();
  const mergedHotkeyConfig: HotkeyConfig = {
    ...DEFAULT_HOTKEY_CONFIG,
    ...hotkeyConfig,
    projectHotkeys: {
      ...DEFAULT_HOTKEY_CONFIG.projectHotkeys,
      ...(hotkeyConfig?.projectHotkeys ?? {}),
    },
    taskHotkeys: {
      ...DEFAULT_HOTKEY_CONFIG.taskHotkeys,
      ...(hotkeyConfig?.taskHotkeys ?? {}),
    },
    dialogHotkeys: {
      ...DEFAULT_HOTKEY_CONFIG.dialogHotkeys,
      ...(hotkeyConfig?.dialogHotkeys ?? {}),
    },
  };
  const [config, setConfig] = useState<HotkeyConfig>(mergedHotkeyConfig);

  const handleChange = (category: keyof HotkeyConfig, key: string, value: string) => {
    setConfig((prev) => {
      const updatedConfig = {
        ...prev,
        [category]: {
          ...prev[category],
          [key]: value,
        },
      };
      onSave(updatedConfig);
      return updatedConfig;
    });
  };

  const handleReset = () => {
    const resetConfig: HotkeyConfig = {
      ...DEFAULT_HOTKEY_CONFIG,
      projectHotkeys: { ...DEFAULT_HOTKEY_CONFIG.projectHotkeys },
      taskHotkeys: { ...DEFAULT_HOTKEY_CONFIG.taskHotkeys },
      dialogHotkeys: { ...DEFAULT_HOTKEY_CONFIG.dialogHotkeys },
    };
    setConfig(resetConfig);
    onSave(resetConfig);
  };

  const renderHotkeyInput = (category: keyof HotkeyConfig, key: string, label: string) => {
    const categoryConfig = config[category] as Record<string, string>;
    const defaultCategoryConfig = DEFAULT_HOTKEY_CONFIG[category] as Record<string, string>;
    const value = categoryConfig?.[key] ?? defaultCategoryConfig?.[key] ?? '';

    return (
      <div key={key} className="flex items-center justify-between py-2 border-b border-border-default-dark last:border-b-0">
        <label className="text-sm text-text-primary flex-1">{label}</label>
        <Input
          value={value}
          onChange={(e) => handleChange(category, key, e.target.value)}
          className="w-48"
          size="sm"
          placeholder={t('settings.hotkeys.enterHotkey')}
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-bg-secondary scrollbar-thumb-bg-tertiary">
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-md font-semibold text-text-primary uppercase">{t('settings.hotkeys.projectHotkeys')}</h3>
              <Button variant="text" size="xs" onClick={handleReset}>
                {t('settings.hotkeys.resetToDefaults')}
              </Button>
            </div>
            <div className="bg-bg-secondary-light rounded-lg p-4">
              {renderHotkeyInput('projectHotkeys', 'closeProject', t('settings.hotkeys.closeProject'))}
              {renderHotkeyInput('projectHotkeys', 'newProject', t('settings.hotkeys.newProject'))}
              {renderHotkeyInput('projectHotkeys', 'usageDashboard', t('settings.hotkeys.usageDashboard'))}
              {renderHotkeyInput('projectHotkeys', 'modelLibrary', t('settings.hotkeys.modelLibrary'))}
              {renderHotkeyInput('projectHotkeys', 'settings', t('settings.hotkeys.settings'))}
              {renderHotkeyInput('projectHotkeys', 'cycleNextProject', t('settings.hotkeys.cycleNextProject'))}
              {renderHotkeyInput('projectHotkeys', 'cyclePrevProject', t('settings.hotkeys.cyclePrevProject'))}
              {renderHotkeyInput('projectHotkeys', 'switchProject1', t('settings.hotkeys.switchProject', { number: 1 }))}
              {renderHotkeyInput('projectHotkeys', 'switchProject2', t('settings.hotkeys.switchProject', { number: 2 }))}
              {renderHotkeyInput('projectHotkeys', 'switchProject3', t('settings.hotkeys.switchProject', { number: 3 }))}
              {renderHotkeyInput('projectHotkeys', 'switchProject4', t('settings.hotkeys.switchProject', { number: 4 }))}
              {renderHotkeyInput('projectHotkeys', 'switchProject5', t('settings.hotkeys.switchProject', { number: 5 }))}
              {renderHotkeyInput('projectHotkeys', 'switchProject6', t('settings.hotkeys.switchProject', { number: 6 }))}
              {renderHotkeyInput('projectHotkeys', 'switchProject7', t('settings.hotkeys.switchProject', { number: 7 }))}
              {renderHotkeyInput('projectHotkeys', 'switchProject8', t('settings.hotkeys.switchProject', { number: 8 }))}
              {renderHotkeyInput('projectHotkeys', 'switchProject9', t('settings.hotkeys.switchProject', { number: 9 }))}
            </div>
          </div>

          <div>
            <h3 className="text-md font-semibold text-text-primary mb-3 uppercase">{t('settings.hotkeys.taskHotkeys')}</h3>
            <div className="bg-bg-secondary-light rounded-lg p-4">
              {renderHotkeyInput('taskHotkeys', 'focusPrompt', t('settings.hotkeys.focusPrompt'))}
              {renderHotkeyInput('taskHotkeys', 'newTask', t('settings.hotkeys.newTask'))}
              {renderHotkeyInput('taskHotkeys', 'closeTask', t('settings.hotkeys.closeTask'))}
              {renderHotkeyInput('taskHotkeys', 'switchTask1', t('settings.hotkeys.switchTask', { number: 1 }))}
              {renderHotkeyInput('taskHotkeys', 'switchTask2', t('settings.hotkeys.switchTask', { number: 2 }))}
              {renderHotkeyInput('taskHotkeys', 'switchTask3', t('settings.hotkeys.switchTask', { number: 3 }))}
              {renderHotkeyInput('taskHotkeys', 'switchTask4', t('settings.hotkeys.switchTask', { number: 4 }))}
              {renderHotkeyInput('taskHotkeys', 'switchTask5', t('settings.hotkeys.switchTask', { number: 5 }))}
              {renderHotkeyInput('taskHotkeys', 'switchTask6', t('settings.hotkeys.switchTask', { number: 6 }))}
              {renderHotkeyInput('taskHotkeys', 'switchTask7', t('settings.hotkeys.switchTask', { number: 7 }))}
              {renderHotkeyInput('taskHotkeys', 'switchTask8', t('settings.hotkeys.switchTask', { number: 8 }))}
              {renderHotkeyInput('taskHotkeys', 'switchTask9', t('settings.hotkeys.switchTask', { number: 9 }))}
            </div>
          </div>

          <div>
            <h3 className="text-md font-semibold text-text-primary mb-3 uppercase">{t('settings.hotkeys.dialogHotkeys')}</h3>
            <div className="bg-bg-secondary-light rounded-lg p-4">{renderHotkeyInput('dialogHotkeys', 'browseFolder', t('settings.hotkeys.browseFolder'))}</div>
          </div>

          <div className="bg-bg-tertiary-strong rounded-lg p-4">
            <p className="text-xs text-text-muted mb-2">{t('settings.hotkeys.hotkeyFormat')}</p>
            <ul className="text-xs text-text-muted space-y-1 list-disc list-inside">
              <li>{t('settings.hotkeys.modKey')}</li>
              <li>{t('settings.hotkeys.multipleKeys')}</li>
              <li>{t('settings.hotkeys.examples')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
