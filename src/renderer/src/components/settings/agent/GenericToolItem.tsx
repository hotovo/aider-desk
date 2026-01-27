import { useTranslation } from 'react-i18next';
import { ReactNode } from 'react';
import { AgentProfile, GenericTool, ToolApprovalState } from '@common/types';
import { TOOL_GROUP_NAME_SEPARATOR } from '@common/tools';

import { Select } from '@/components/common/Select';
import { InfoIcon } from '@/components/common/InfoIcon';

type Props = {
  tool: GenericTool;
  profile: AgentProfile;
  onApprovalChange?: (toolId: string, approval: ToolApprovalState) => void;
  renderToolSettings?: () => ReactNode;
};

export const GenericToolItem = ({ tool, profile, onApprovalChange, renderToolSettings }: Props) => {
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
        <InfoIcon className="mr-4" tooltip={tool.description?.trim() || t('tool.noDescription')} />
        {/* Conditionally render the approval select only if onApprovalChange is provided */}
        {onApprovalChange && profile.toolApprovals && (
          <div>
            <Select options={approvalOptions} size="sm" value={currentApproval} onChange={handleApprovalChange} />
          </div>
        )}
      </div>
      {renderToolSettings && <div className="pb-4">{renderToolSettings()}</div>}
    </>
  );
};
