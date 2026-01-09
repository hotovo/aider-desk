import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsData, ShellInfo } from '@common/types';
import { Section } from '@/components/common/Section';
import { Input } from '@/components/common/Input';
import { RadioButton } from '@/components/common/RadioButton';

type Props = {
  settings: SettingsData;
  setSettings: (settings: SettingsData) => void;
};

type ShellMode = 'auto' | 'preset' | 'custom';

export const TerminalSettings = ({ settings, setSettings }: Props) => {
  const { t } = useTranslation();
  const [availableShells, setAvailableShells] = useState<ShellInfo[]>([]);
  const [mode, setMode] = useState<ShellMode>('auto');

  useEffect(() => {
    window.api.getAvailableShells().then(setAvailableShells);
  }, []);

  const currentShell = settings.terminal?.shell || '';

  // Sync mode with settings
  useEffect(() => {
    if (currentShell === '') {
      setMode('auto');
    } else if (availableShells.some((s) => s.path === currentShell)) {
      setMode('preset');
    } else {
      setMode('custom');
    }
  }, [currentShell, availableShells]);

  const handleModeChange = (newMode: ShellMode) => {
    setMode(newMode);
    if (newMode === 'auto') {
      updateShell('');
    } else if (newMode === 'preset') {
      // If current shell is not in presets, default to first available
      if (!availableShells.some((s) => s.path === currentShell)) {
        updateShell(availableShells[0]?.path || '');
      }
    } else if (newMode === 'custom') {
      // Keep current value, user can edit it
    }
  };

  const updateShell = (path: string) => {
    setSettings({
      ...settings,
      terminal: {
        ...settings.terminal,
        shell: path,
      },
    });
  };

  return (
    <div className="space-y-6">
      <Section id="terminal-shell" title={t('settings.terminal.shell')}>
        <div className="px-4 py-5 space-y-4">
          <div className="space-y-3">
            {/* Auto Detect */}
            <RadioButton
              id="shell-auto"
              name="shell-mode"
              value="auto"
              checked={mode === 'auto'}
              onChange={() => handleModeChange('auto')}
              label={
                <div>
                  <span className="font-medium text-sm text-text-primary">{t('settings.terminal.autoDetect')}</span>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {t('settings.terminal.autoDetectDescription', 'Automatically use the system default shell')}
                  </p>
                </div>
              }
            />

            {/* Preset List */}
            <div className="space-y-2">
              <RadioButton
                id="shell-preset"
                name="shell-mode"
                value="preset"
                checked={mode === 'preset'}
                onChange={() => handleModeChange('preset')}
                label={<span className="font-medium text-sm text-text-primary">{t('settings.terminal.selectFromList', 'Select from list')}</span>}
              />

              {mode === 'preset' && (
                <div className="ml-6">
                  <select
                    className="w-full bg-bg-primary-light border border-border-primary rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-info-light"
                    value={currentShell}
                    onChange={(e) => updateShell(e.target.value)}
                  >
                    {availableShells.map((shell) => (
                      <option key={shell.path} value={shell.path}>
                        {shell.name} ({shell.path})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Custom Path */}
            <div className="space-y-2">
              <RadioButton
                id="shell-custom"
                name="shell-mode"
                value="custom"
                checked={mode === 'custom'}
                onChange={() => handleModeChange('custom')}
                label={<span className="font-medium text-sm text-text-primary">{t('settings.terminal.customPath', 'Custom path')}</span>}
              />

              {mode === 'custom' && (
                <div className="ml-6 space-y-1">
                  <Input
                    type="text"
                    value={currentShell}
                    onChange={(e) => updateShell(e.target.value)}
                    placeholder={t('settings.terminal.customShellPathPlaceholder')}
                  />
                  <p className="text-xs text-text-secondary">{t('settings.terminal.customShellPathDescription')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
};
