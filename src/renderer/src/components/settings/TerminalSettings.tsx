import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsData, ShellInfo } from '@common/types';
import { Section } from '@/components/common/Section';
import { Input } from '@/components/common/Input';

type Props = {
  settings: SettingsData;
  setSettings: (settings: SettingsData) => void;
};

export const TerminalSettings = ({ settings, setSettings }: Props) => {
  const { t } = useTranslation();
  const [availableShells, setAvailableShells] = useState<ShellInfo[]>([]);

  useEffect(() => {
    window.api.getAvailableShells().then(setAvailableShells);
  }, []);

  return (
    <div className="space-y-6">
      <Section id="terminal-shell" title={t('settings.terminal.shell')}>
        <div className="px-4 py-5 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              {t('settings.terminal.shellPath')}
            </label>
            <div className="flex gap-2">
              <select
                className="flex-1 bg-bg-primary-light border border-border-primary rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-info-light"
                value={settings.terminal?.shell || ''}
                onChange={(e) => {
                  setSettings({
                    ...settings,
                    terminal: {
                      ...settings.terminal,
                      shell: e.target.value,
                    },
                  });
                }}
              >
                <option value="">{t('settings.terminal.autoDetect')}</option>
                {availableShells.map((shell) => (
                  <option key={shell.path} value={shell.path}>
                    {shell.name} ({shell.path})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              {t('settings.terminal.customShellPath')}
            </label>
            <Input
              type="text"
              value={settings.terminal?.shell || ''}
              onChange={(e) => {
                setSettings({
                  ...settings,
                  terminal: {
                    ...settings.terminal,
                    shell: e.target.value,
                  },
                });
              }}
              placeholder={t('settings.terminal.customShellPathPlaceholder')}
            />
            <p className="text-xs text-text-secondary">
              {t('settings.terminal.customShellPathDescription')}
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
};
