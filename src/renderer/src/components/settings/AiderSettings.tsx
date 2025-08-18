import { useState } from 'react';
import { HiEye } from 'react-icons/hi';
import { Trans, useTranslation } from 'react-i18next';
import { SettingsData } from '@common/types';

import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Section } from '@/components/common/Section';
import { TextArea } from '@/components/common/TextArea';
import { Checkbox } from '@/components/common/Checkbox';
import { CodeInline } from '@/components/common/CodeInline';

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
      <Section title={t('settings.aider.options')}>
        <div className="px-4 py-5 pb-3 space-y-1.5">
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
          <Checkbox
            label={t('settings.aider.copyPaste')}
            checked={settings.aider.copyPaste}
            onChange={(checked) =>
              setSettings({
                ...settings,
                aider: {
                  ...settings.aider,
                  copyPaste: checked,
                },
              })
            }
          />
          <Input
            className="mt-3"
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
          <p className="text-xs text-text-secondary px-1">
            {t('settings.aider.optionsDocumentation')}{' '}
            <a
              href="https://aider.chat/docs/config/options.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-info-lighter hover:text-info-lightest"
            >
              https://aider.chat/docs/config/options.html
            </a>
          </p>
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
              className="min-h-[200px]"
              placeholder={t('settings.aider.envVarsPlaceholder')}
            />
            {!showEnvVars && (
              <div className="absolute inset-[3px] bottom-[9px] bg-bg-primary-light-strong backdrop-blur-sm flex items-center justify-center rounded-sm">
                <Button variant="text" color="secondary" onClick={() => setShowEnvVars(true)} className="flex items-center" size="sm">
                  <HiEye className="mr-2" /> {t('settings.common.showSecrets')}
                </Button>
              </div>
            )}
          </div>
          <p className="text-xs text-text-secondary px-1">
            {t('settings.aider.envVarsDocumentation')}{' '}
            <a
              href="https://aider.chat/docs/config/dotenv.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-info-lighter hover:text-info-lightest"
            >
              https://aider.chat/docs/config/dotenv.html
            </a>
          </p>
        </div>
      </Section>
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
    </div>
  );
};
