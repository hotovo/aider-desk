import { Trans, useTranslation } from 'react-i18next';
import { AgentProfile } from '@common/types';

import { TextArea } from '@/components/common/TextArea';
import { CodeInline } from '@/components/common/CodeInline';

const CUSTOM_INSTRUCTIONS_PLACEHOLDER = `## Probe Tools Usage

- use probe tools when you need to find files related to users request
- think about the search queries you need to use to find the files`;

type AgentRulesProps = {
  profile: AgentProfile;
  handleProfileSettingChange: <K extends keyof AgentProfile>(field: K, value: AgentProfile[K]) => void;
};

export const AgentRules = ({ profile, handleProfileSettingChange }: AgentRulesProps) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-2 text-2xs text-text-primary">
      <div>{t('settings.agent.rulesInfo')}</div>
      <div>
        <Trans
          i18nKey="settings.agent.ruleFilesInfo"
          components={{
            file: <CodeInline />,
            a: (
              <a
                href="https://github.com/hotovo/aider-desk/tree/main/.aider-desk/rules"
                target="_blank"
                rel="noopener noreferrer"
                className="text-info-lighter hover:underline"
              />
            ),
          }}
        />
      </div>
      <TextArea
        value={profile.customInstructions}
        label={<div className="text-xs !mt-4 font-medium">{t('settings.agent.customInstructions')}</div>}
        onChange={(e) => handleProfileSettingChange('customInstructions', e.target.value)}
        rows={10}
        className="w-full resize-none"
        placeholder={CUSTOM_INSTRUCTIONS_PLACEHOLDER}
      />
    </div>
  );
};
