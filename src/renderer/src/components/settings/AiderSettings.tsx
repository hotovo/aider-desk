import { useState, useEffect } from 'react';
import { HiEye, HiInformationCircle, HiRefresh } from 'react-icons/hi';
import { Trans, useTranslation } from 'react-i18next';
import { EnvironmentVariable, SettingsData } from '@common/types';

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
  const [effectiveEnvVars, setEffectiveEnvVars] = useState<Record<string, EnvironmentVariable>>({});
  const [isLoadingEnvVars, setIsLoadingEnvVars] = useState(false);

  const loadEffectiveEnvVars = async () => {
    try {
      setIsLoadingEnvVars(true);
      const apiKeys = [
        'OPENAI_API_KEY',
        'ANTHROPIC_API_KEY',
        'GOOGLE_API_KEY',
        'GROQ_API_KEY',
        'DEEPSEEK_API_KEY',
        'OPENROUTER_API_KEY',
        'CEREBRAS_API_KEY',
        'REQUESTY_API_KEY'
      ];

      const result: Record<string, EnvironmentVariable> = {};
      
      for (const key of apiKeys) {
        const envVar = await window.api.getEffectiveEnvironmentVariable(key);
        if (envVar) {
          result[key] = envVar;
        }
      }

      setEffectiveEnvVars(result);
      setIsLoadingEnvVars(false);
    } catch (error) {
      console.error('Error loading effective environment variables:', error);
      setIsLoadingEnvVars(false);
    }
  };

  useEffect(() => {
    loadEffectiveEnvVars();
  }, [settings.aider.environmentVariables, settings.aider.options]);

  const handleRefresh = () => {
    loadEffectiveEnvVars();
  };

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
            label={t('settings.aider.confirmBeforeEdit')}
            checked={settings.aider.confirmBeforeEdit}
            onChange={(checked) =>
              setSettings({
                ...settings,
                aider: {
                  ...settings.aider,
                  confirmBeforeEdit: checked,
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
        <div className="px-4 py-6 pb-3 space-y-4">
          {!isLoadingEnvVars && Object.keys(effectiveEnvVars).length > 0 && (
            <div className="bg-bg-secondary rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                  <HiInformationCircle className="text-info" />
                  <span>Detected API Keys</span>
                </div>
                <Button
                  variant="text"
                  color="secondary"
                  size="xs"
                  onClick={handleRefresh}
                  className="flex items-center gap-1"
                  disabled={isLoadingEnvVars}
                >
                  <HiRefresh className={isLoadingEnvVars ? 'animate-spin' : ''} />
                  Refresh
                </Button>
              </div>
              {Object.entries(effectiveEnvVars).map(([key, envVar]) => (
                <div key={key} className="flex items-center justify-between text-xs gap-2">
                  <span className="font-mono text-text-secondary flex-shrink-0">{key}</span>
                  <span className="text-text-tertiary italic text-right truncate">
                    {showEnvVars ? (
                      <span className="font-mono">{envVar.value.substring(0, 10)}...</span>
                    ) : (
                      '••••••••••'
                    )}
                    {' from '}
                    <span className="text-info-lighter">{envVar.source}</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Manual Environment Variables
            </label>
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
