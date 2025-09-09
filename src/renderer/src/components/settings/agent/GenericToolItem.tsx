import { useTranslation } from 'react-i18next';
import { AgentProfile, GenericTool, ToolApprovalState } from '@common/types';
import { POWER_TOOL_BASH, TOOL_GROUP_NAME_SEPARATOR } from '@common/tools';

import { Select } from '@/components/common/Select';
import { InfoIcon } from '@/components/common/InfoIcon';
import { Input } from '@/components/common/Input';

type Props = {
  tool: GenericTool;
  profile: AgentProfile;
  onApprovalChange?: (toolId: string, approval: ToolApprovalState) => void;
  onProfileChange: (field: keyof AgentProfile, value: AgentProfile[keyof AgentProfile]) => void;
};

export const GenericToolItem = ({ tool, profile, onApprovalChange, onProfileChange }: Props) => {
  const { t } = useTranslation();
  const fullToolId = `${tool.groupName}${TOOL_GROUP_NAME_SEPARATOR}${tool.name}`;

  // Default to 'Always' if approvals are not being managed in this context
  const currentApproval = profile.toolApprovals ? profile.toolApprovals[fullToolId] || ToolApprovalState.Always : ToolApprovalState.Always;

  const approvalOptions = [
    { value: ToolApprovalState.Always, label: t('tool.approval.always') },
    { value: ToolApprovalState.Never, label: t('tool.approval.never') },
    { value: ToolApprovalState.Ask, label: t('tool.approval.ask') },
  ];

  const handleApprovalChange = (value: string) => {
    if (onApprovalChange) {
      onApprovalChange(fullToolId, value as ToolApprovalState);
    }
  };

  return (
    <>
      <div className="flex items-center">
        <div className="flex-1 text-xs ml-2 mr-2">{tool.name}</div>
        <InfoIcon className="mr-4" tooltip={tool.description?.trim() || t('tool.noDescription')} tooltipId="global-tooltip-md" />
        {/* Conditionally render the approval select only if onApprovalChange is provided */}
        {onApprovalChange && profile.toolApprovals && (
          <div>
            <Select options={approvalOptions} size="sm" value={currentApproval} onChange={handleApprovalChange} />
          </div>
        )}
      </div>
      {tool.name === POWER_TOOL_BASH && (
        <div className="grid grid-cols-2 gap-x-2 my-2">
          <Input
            label={<span className="text-2xs">{t('settings.agent.bashToolAllowedPattern')}</span>}
            value={profile.bashToolAllowedPattern}
            onChange={(e) => onProfileChange('bashToolAllowedPattern', e.target.value)}
            placeholder={t('settings.agent.bashToolAllowedPatternPlaceholder')}
          />
          <Input
            label={<span className="text-2xs">{t('settings.agent.bashToolDeniedPattern')}</span>}
            value={profile.bashToolDeniedPattern}
            onChange={(e) => onProfileChange('bashToolDeniedPattern', e.target.value)}
            placeholder={t('settings.agent.bashToolDeniedPatternPlaceholder')}
          />
        </div>
      )}
    </>
  );
};
