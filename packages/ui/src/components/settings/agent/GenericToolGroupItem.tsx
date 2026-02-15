import { AgentProfile, GenericTool, ToolApprovalState } from '@aider-desk/common/types';
import { useTranslation } from 'react-i18next';
import { POWER_TOOL_BASH, TOOL_GROUP_NAME_SEPARATOR } from '@aider-desk/common/tools';

import { GenericToolItem } from './GenericToolItem';
import { BashToolItem } from './BashToolItem';

import { Accordion } from '@/components/common/Accordion';
import { Checkbox } from '@/components/common/Checkbox';

type Props = {
  name: string;
  tools: GenericTool[];
  profile: AgentProfile;
  onApprovalChange: (toolId: string, approval: ToolApprovalState) => void;
  onProfileChange: (field: keyof AgentProfile, value: AgentProfile[keyof AgentProfile]) => void;
  enabled?: boolean;
  onEnabledChange?: (enabled: boolean) => void;
};

export const GenericToolGroupItem = ({ name, tools, profile, onApprovalChange, onProfileChange, enabled, onEnabledChange }: Props) => {
  const { t } = useTranslation();

  const renderTitle = () => {
    const enabledCount =
      tools.length - tools.filter((tool) => profile.toolApprovals[`${name}${TOOL_GROUP_NAME_SEPARATOR}${tool.name}`] === ToolApprovalState.Never).length;

    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center">
          {onEnabledChange && <Checkbox id={`enable-group-${name}`} checked={enabled || false} onChange={onEnabledChange} className="mr-2" />}
          <span className="text-sm">{name}</span>
        </div>
        <div className="flex items-center">
          {tools.length > 0 && (
            <span className="text-xs mr-3 text-text-muted-light">
              {t('mcp.serverToolStatus', {
                count: tools.length,
                enabledCount,
              })}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="border border-border-default-dark rounded mb-1">
      <Accordion title={renderTitle()} buttonClassName="px-2" chevronPosition="right">
        {tools.length > 0 ? (
          <div>
            <div className="text-xs p-2 pt-1 rounded mt-1 space-y-2">
              <div className="text-xs text-text-muted-light ml-1">{t('mcp.tools')}</div>
              {tools.map((tool) => {
                if (tool.name === POWER_TOOL_BASH) {
                  return <BashToolItem key={tool.name} tool={tool} profile={profile} onApprovalChange={onApprovalChange} onProfileChange={onProfileChange} />;
                }

                return <GenericToolItem key={tool.name} tool={tool} profile={profile} onApprovalChange={onApprovalChange} />;
              })}
            </div>
          </div>
        ) : (
          <div className="text-xs text-text-muted p-4">{t('mcp.noToolsFound')}</div>
        )}
      </Accordion>
    </div>
  );
};
