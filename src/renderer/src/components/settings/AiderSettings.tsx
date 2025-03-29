import { SettingsData } from '@common/types';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/common/Input';
import { TextArea } from '@/components/common/TextArea';

const OPTIONS_PLACEHOLDER = 'e.g. --no-auto-commits --cache-prompts';

const ENV_VARIABLES_PLACEHOLDER = `#################
# LLM parameters:
#
# Include xxx_API_KEY parameters and other params needed for your LLMs.
# See https://aider.chat/docs/llms.html for details.

## OpenAI
#OPENAI_API_KEY=

## Anthropic
#ANTHROPIC_API_KEY=`;

type Props = {
  settings: SettingsData;
  setSettings: (settings: SettingsData) => void;
};

export const AiderSettings = ({ settings, setSettings }: Props) => {
  const { t } = useTranslation();
  
  return (
    <>
      <div className="space-y-1">
        <Input
          label={t('settings.aider.options')}
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
          placeholder={OPTIONS_PLACEHOLDER}
        />
        <p className="text-xs text-neutral-200">
          {t('settings.aider.optionsDocumentation')}{' '}
          <a href="https://aider.chat/docs/config/options.html" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
            https://aider.chat/docs/config/options.html
          </a>
        </p>
      </div>

      <div className="space-y-1 mt-4">
        <TextArea
          label={t('settings.aider.environmentVariables')}
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
          placeholder={ENV_VARIABLES_PLACEHOLDER}
        />
        <p className="text-xs text-neutral-400">
          {t('settings.aider.envVarsDocumentation')}{' '}
          <a href="https://aider.chat/docs/config/dotenv.html" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
            https://aider.chat/docs/config/dotenv.html
          </a>
        </p>
      </div>
    </>
  );
};
