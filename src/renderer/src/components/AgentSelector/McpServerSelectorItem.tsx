import { useEffect, useState } from 'react';
import { CgSpinner } from 'react-icons/cg';
import { ToolApprovalState } from '@common/types';
import { TOOL_GROUP_NAME_SEPARATOR } from '@common/tools';
import { useTranslation } from 'react-i18next';

import { Checkbox } from '../common/Checkbox';

type Props = {
  serverName: string;
  disabled: boolean;
  toolApprovals: Record<string, ToolApprovalState>;
  onToggle: (serverName: string) => void;
};

export const McpServerSelectorItem = ({ serverName, disabled, toolApprovals, onToggle }: Props) => {
  const { t } = useTranslation();
  const [toolsCount, setToolsCount] = useState<number | null>(null);

  useEffect(() => {
    const loadTools = async () => {
      const timeoutId = setTimeout(() => setToolsCount(null), 500);
      try {
        const tools = await window.api.loadMcpServerTools(serverName);
        const totalTools = tools?.length ?? 0;
        const disabledCount =
          tools?.filter((tool) => toolApprovals[`${serverName}${TOOL_GROUP_NAME_SEPARATOR}${tool.name}`] === ToolApprovalState.Never).length ?? 0;
        setToolsCount(Math.max(0, totalTools - disabledCount));
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to load MCP server tools:', error);
        setToolsCount(0);
      } finally {
        clearTimeout(timeoutId);
      }
    };

    void loadTools();
  }, [toolApprovals, serverName]);

  return (
    <div className="flex items-center justify-between px-3 py-1 hover:bg-bg-secondaryLight cursor-pointer text-xs" onClick={() => onToggle(serverName)}>
      <Checkbox checked={!disabled} onChange={() => onToggle(serverName)} className="mr-1" label={serverName} />
      {toolsCount === null ? (
        <CgSpinner className="animate-spin text-xs text-text-dark ml-2" />
      ) : (
        <span className="text-2xs text-text-dark ml-2 whitespace-nowrap">{t('mcp.toolsCount', { count: toolsCount })}</span>
      )}
    </div>
  );
};
