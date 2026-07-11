import { AgentProfile } from '@common/types';
import { useTranslation } from 'react-i18next';

import { AgentRules } from '../AgentRules';
import { SystemPromptEditor } from '../SystemPromptEditor';

import { InfoIcon } from '@/components/common/InfoIcon';

type Props = {
  profile: AgentProfile;
  onSettingChange: <K extends keyof AgentProfile>(field: K, value: AgentProfile[K]) => void;
};

export const ProfilePromptsSection = ({ profile, onSettingChange }: Props) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <SystemPromptEditor
        label={
          <div className="flex items-center">
            <span>{t('settings.agent.systemPrompt')}</span>
            <InfoIcon className="ml-1" tooltip={t('settings.agent.systemPromptTooltip')} />
          </div>
        }
        value={profile.systemPrompt ?? ''}
        onChange={(value) => onSettingChange('systemPrompt', value)}
        placeholder={t('settings.agent.systemPromptPlaceholder')}
        info={t('settings.agent.systemPromptInfo')}
      />

      <div className="border-t border-border-default-dark pt-4">
        <div className="text-sm font-medium text-text-primary mb-3">{t('settings.agent.rules')}</div>
        <AgentRules profile={profile} handleProfileSettingChange={onSettingChange} />
      </div>
    </div>
  );
};
