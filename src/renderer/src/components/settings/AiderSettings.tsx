import { useState } from 'react';
import { HiEye } from 'react-icons/hi';
import { Trans, useTranslation } from 'react-i18next';
import { SettingsData } from '@common/types';

import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Section } from '@/components/common/Section';
import { TextArea } from '@/components/common/TextArea';
import { Checkbox } from '@/components/common/Checkbox';
import { CodeInline } from '@/components/message';

type Props = {
  settings: SettingsData;
  setSettings: (settings: SettingsData) => void;
  initialShowEnvVars?: boolean;
};

export const AiderSettings = ({ settings, setSettings, initialShowEnvVars = false }: Props) => {
  const { t } = useTranslation();
  const [showEnvVars, setShowEnvVars] = useState(initialShowEnvVars);

  return (
    <div className="space-y-6">
      <Section title={t('settings.aider.context')}>
        <div className="px-4 py-6 pb-3 space-y-1.5">
          <Checkbox
            label={
              <Trans
                i18nKey="settings.aider.addRuleFiles"
                components={{
                  file: <CodeInline />,
                }}
              />
            }
            checked={settings.aider.addRuleFiles}
            onChange={(checked) =>
              setSettings({
                ...settings,
                aider: {
                  ...settings.aider,
                  addRuleFiles: checked,
                },
              })
            }
          />
        </div>
      </Section>

      <Section title={t('settings.aider.options')}>
        <div className="px-4 py-6 pb-3 space-y-1.5">
          <Input
            type="text"
            value={settings.aider.options}
            spellCheck={false}
            onChange={(e) =>
              setSettings({
                ...settings,
                aider: {
                  ...settings.aider,
                  options: e.target.value,
                },
              })
            }
            placeholder={t('settings.aider.optionsPlaceholder')}
          />
          <p className="text-xs text-neutral-200 px-1">
            {t('settings.aider.optionsDocumentation')}{' '}
            <a href="https://aider.chat/docs/config/options.html" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
              https://aider.chat/docs/config/options.html
            </a>
          </p>
          <div className="flex gap-4 pt-2">
            <Checkbox
              label={t('settings.aider.autoCommits')}
              checked={settings.aider.autoCommits}
              onChange={(checked) => {
                setSettings({
                  ...settings,
                  aider: {
                    ...settings.aider,
                    autoCommits: checked,
                  },
                });
              }}
            />
            <Checkbox
              label={t('settings.aider.cachingEnabled')}
              checked={settings.aider.cachingEnabled}
              onChange={(checked) =>
                setSettings({
                  ...settings,
                  aider: {
                    ...settings.aider,
                    cachingEnabled: checked,
                  },
                })
              }
            />
            <Checkbox
              label={t('settings.aider.watchFiles')}
              checked={settings.aider.watchFiles}
              onChange={(checked) =>
                setSettings({
                  ...settings,
                  aider: {
                    ...settings.aider,
                    watchFiles: checked,
                  },
                })
              }
            />
          </div>
        </div>
      </Section>

      <Section title={t('settings.aider.environmentVariables')}>
        <div className="px-4 py-6 pb-3">
          <div className="relative">
            <TextArea
              value={settings.aider.environmentVariables}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  aider: {
                    ...settings.aider,
                    environmentVariables: e.target.value,
                  },
                })
              }
              spellCheck={false}
              className="min-h-[300px]"
              placeholder={t('settings.aider.envVarsPlaceholder')}
            />
            {!showEnvVars && (
              <div className="absolute inset-[3px] bottom-[9px] bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center rounded-sm">
                <Button variant="text" color="secondary" onClick={() => setShowEnvVars(true)} className="flex items-center" size="sm">
                  <HiEye className="mr-2" /> {t('settings.common.showSecrets')}
                </Button>
              </div>
            )}
          </div>
          <p className="text-xs text-neutral-200 px-1">
            {t('settings.aider.envVarsDocumentation')}{' '}
            <a href="https://aider.chat/docs/config/dotenv.html" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
              https://aider.chat/docs/config/dotenv.html
            </a>
          </p>
        </div>
      </Section>
    </div>
  );
};
