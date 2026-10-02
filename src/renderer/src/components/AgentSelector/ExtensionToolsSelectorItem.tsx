import { ExtensionToolInfo, ToolApprovalState } from '@common/types';
import { TOOL_GROUP_NAME_SEPARATOR } from '@common/tools';
import { useTranslation } from 'react-i18next';

import { Checkbox } from '../common/Checkbox';

type Props = {
  extensionInfo: ExtensionToolInfo;
  disabled: boolean;
  toolApprovals: Record<string, ToolApprovalState>;
  onToggle: (extensionId: string) => void;
};

export const ExtensionToolsSelectorItem = ({ extensionInfo, disabled, toolApprovals, onToggle }: Props) => {
  const { t } = useTranslation();

  const handleToggle = () => onToggle(extensionInfo.extensionId);

  const enabledToolsCount =
    extensionInfo.tools.length -
    extensionInfo.tools.filter((tool) => toolApprovals[`${extensionInfo.extensionId}${TOOL_GROUP_NAME_SEPARATOR}${tool.name}`] === ToolApprovalState.Never)
      .length;

  return (
    <div className="flex items-center justify-between px-3 py-1 hover:bg-bg-secondary-light cursor-pointer text-xs" onClick={handleToggle}>
      <Checkbox checked={!disabled} onChange={handleToggle} className="mr-1" label={extensionInfo.extensionName} />
      <span className="text-2xs text-text-dark ml-2 whitespace-nowrap">{t('mcp.toolsCount', { count: enabledToolsCount })}</span>
    </div>
  );
};
