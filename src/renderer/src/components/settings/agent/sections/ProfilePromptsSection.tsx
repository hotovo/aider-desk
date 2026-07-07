import { AgentProfile } from '@common/types';
import { useTranslation } from 'react-i18next';

import { AgentRules } from '../AgentRules';

import { TextArea } from '@/components/common/TextArea';
import { InfoIcon } from '@/components/common/InfoIcon';

type Props = {
  profile: AgentProfile;
  onSettingChange: <K extends keyof AgentProfile>(field: K, value: AgentProfile[K]) => void;
};

export const ProfilePromptsSection = ({ profile, onSettingChange }: Props) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <TextArea
          label={
            <div className="flex items-center text-sm font-medium text-text-primary mb-1">
              <span>{t('settings.agent.systemPrompt')}</span>
              <InfoIcon className="ml-1" tooltip={t('settings.agent.systemPromptTooltip')} />
            </div>
          }
          className="min-h-[160px]"
          value={profile.systemPrompt ?? ''}
          onChange={(e) => onSettingChange('systemPrompt', e.target.value)}
          placeholder={t('settings.agent.systemPromptPlaceholder')}
        />
        <div className="text-2xs text-text-muted-light mt-1">{t('settings.agent.systemPromptInfo')}</div>
      </div>

      <div className="border-t border-border-default-dark pt-4">
        <div className="text-sm font-medium text-text-primary mb-3">{t('settings.agent.rules')}</div>
        <AgentRules profile={profile} handleProfileSettingChange={onSettingChange} />
      </div>
    </div>
  );
};
