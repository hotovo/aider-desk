import { useTranslation } from 'react-i18next';
import { AgentProfile, BashToolSettings, GenericTool, ToolApprovalState } from '@aider-desk/common/types';
import { POWER_TOOL_BASH, POWER_TOOL_GROUP_NAME, TOOL_GROUP_NAME_SEPARATOR } from '@aider-desk/common/tools';

import { GenericToolItem } from './GenericToolItem';

import { Input } from '@/components/common/Input';
import { InfoIcon } from '@/components/common/InfoIcon';

type Props = {
  tool: GenericTool;
  profile: AgentProfile;
  onApprovalChange?: (toolId: string, approval: ToolApprovalState) => void;
  onProfileChange: (field: keyof AgentProfile, value: AgentProfile[keyof AgentProfile]) => void;
};

export const BashToolItem = ({ tool, profile, onApprovalChange, onProfileChange }: Props) => {
  const { t } = useTranslation();

  if (tool.groupName !== POWER_TOOL_GROUP_NAME || tool.name !== POWER_TOOL_BASH) {
    return null;
  }

  const toolId = `${tool.groupName}${TOOL_GROUP_NAME_SEPARATOR}${tool.name}`;
  const bashSettings = profile.toolSettings?.[toolId] as BashToolSettings;

  const renderToolSettings = () => (
    <div className="grid grid-cols-2 gap-x-2 pl-6">
      <Input
        label={
          <div className="flex items-center">
            <span className="text-2xs">{t('settings.agent.bashToolAllowedPattern')}</span>
            <InfoIcon className="ml-2" tooltip={t('settings.agent.bashToolAllowedPatternTooltip')} />
          </div>
        }
        value={bashSettings?.allowedPattern || ''}
        onChange={(e) => {
          const currentSettings = profile.toolSettings || {};
          const updatedSettings = {
            ...currentSettings,
            [toolId]: {
              ...(currentSettings[toolId] as BashToolSettings),
              allowedPattern: e.target.value,
            },
          };
          onProfileChange('toolSettings', updatedSettings);
        }}
        size="sm"
        placeholder={t('settings.agent.bashToolAllowedPatternPlaceholder')}
      />
      <Input
        label={
          <div className="flex items-center">
            <span className="text-2xs">{t('settings.agent.bashToolDeniedPattern')}</span>
            <InfoIcon className="ml-2" tooltip={t('settings.agent.bashToolDeniedPatternTooltip')} />
          </div>
        }
        value={bashSettings?.deniedPattern || ''}
        onChange={(e) => {
          const currentSettings = profile.toolSettings || {};
          const updatedSettings = {
            ...currentSettings,
            [toolId]: {
              ...(currentSettings[toolId] as BashToolSettings),
              deniedPattern: e.target.value,
            },
          };
          onProfileChange('toolSettings', updatedSettings);
        }}
        size="sm"
        placeholder={t('settings.agent.bashToolDeniedPatternPlaceholder')}
      />
    </div>
  );

  return <GenericToolItem tool={tool} profile={profile} onApprovalChange={onApprovalChange} renderToolSettings={renderToolSettings} />;
};
