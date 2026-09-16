import { McpOAuthStatus, McpServerConfig, McpTool, ToolApprovalState } from '@common/types';
import { extractIpcErrorMessage } from '@common/utils';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaPencilAlt, FaTrash } from 'react-icons/fa';
import { TOOL_GROUP_NAME_SEPARATOR } from '@common/tools';

import { McpToolItem } from './McpToolItem';
import { McpOAuthControls } from './McpOAuthControls';

import { Select } from '@/components/common/Select';
import { Accordion } from '@/components/common/Accordion';
import { IconButton } from '@/components/common/IconButton';
import { Checkbox } from '@/components/common/Checkbox';
import { useApi } from '@/contexts/ApiContext';
import { Tooltip } from '@/components/ui/Tooltip';

const MIXED_VALUE = '-';

type Props = {
  serverName: string;
  config: McpServerConfig;
  onRemove?: () => void;
  onEdit?: () => void;
  toolApprovals?: Record<string, ToolApprovalState>;
  onApprovalChange?: (toolId: string | string[], approval: ToolApprovalState) => void;
  reloadTrigger?: number;
  enabled?: boolean;
  onEnabledChange?: (enabled: boolean) => void;
  projectDir?: string;
};

export const McpServerItem = ({
  serverName,
  config,
  onRemove,
  onEdit,
  toolApprovals,
  onApprovalChange,
  reloadTrigger = 0,
  enabled,
  onEnabledChange,
  projectDir,
}: Props) => {
  const { t } = useTranslation();
  const [tools, setTools] = useState<McpTool[] | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [oauthStatus, setOAuthStatus] = useState(McpOAuthStatus.NotRequired);
  const [oauthRefreshTrigger, setOAuthRefreshTrigger] = useState(0);
  const api = useApi();

  const loadTools = useCallback(async () => {
    try {
      const loadedTools = await api.loadMcpServerTools(serverName, config, projectDir);
      setTools(loadedTools);
      setError(null);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load MCP server tools:', error);
      const errorMessage = extractIpcErrorMessage(error);
      setTools(null);
      setError(errorMessage);
      if (errorMessage.includes('McpAuthenticationRequiredError') || errorMessage.includes('requires OAuth authentication')) {
        setOAuthStatus(McpOAuthStatus.AuthenticationRequired);
        setIsOpen(true);
      }
    } finally {
      setLoading(false);
      setOAuthRefreshTrigger((value) => value + 1);
    }
  }, [api, config, serverName, projectDir]);

  useEffect(() => {
    setLoading(true);
    void loadTools();
  }, [loadTools, reloadTrigger]);

  const handleOAuthAuthenticated = useCallback(() => {
    setLoading(true);
    void api
      .reloadMcpServer(serverName, config)
      .then((loadedTools) => {
        setTools(loadedTools);
        setError(null);
      })
      .catch((error) => {
        setError(extractIpcErrorMessage(error));
      })
      .finally(() => {
        setLoading(false);
        setOAuthRefreshTrigger((value) => value + 1);
      });
  }, [api, config, serverName]);

  const handleOAuthDisconnected = useCallback(() => {
    setTools(null);
    setError(t('mcp.oauth.authenticationRequired'));
  }, [t]);

  const handleOAuthStatusChange = useCallback((status: McpOAuthStatus) => {
    setOAuthStatus(status);
    if (status === McpOAuthStatus.AuthenticationRequired || status === McpOAuthStatus.Authorizing) {
      setIsOpen(true);
    }
  }, []);

  const approvalOptions = [
    { value: ToolApprovalState.Always, label: t('tool.approval.always') },
    { value: ToolApprovalState.Never, label: t('tool.approval.never') },
    { value: ToolApprovalState.Ask, label: t('tool.approval.ask') },
  ];

  const getApproval = (tool: McpTool) => toolApprovals?.[`${serverName}${TOOL_GROUP_NAME_SEPARATOR}${tool.name}`] || ToolApprovalState.Always;

  const commonApproval = tools && tools.length > 0 && tools.every((tool) => getApproval(tool) === getApproval(tools[0])) ? getApproval(tools[0]) : null;

  const handleBulkApprovalChange = useCallback(
    (value: string) => {
      if (!onApprovalChange || !tools || value === MIXED_VALUE) {
        return;
      }
      onApprovalChange(
        tools.map((tool) => `${serverName}${TOOL_GROUP_NAME_SEPARATOR}${tool.name}`),
        value as ToolApprovalState,
      );
    },
    [onApprovalChange, tools, serverName],
  );

  const renderTitle = () => {
    const enabledCount =
      tools &&
      tools.length - tools.filter((tool) => toolApprovals?.[`${serverName}${TOOL_GROUP_NAME_SEPARATOR}${tool.name}`] === ToolApprovalState.Never).length;

    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center">
          {onEnabledChange && <Checkbox id={`enable-server-${serverName}`} checked={enabled || false} onChange={onEnabledChange} className="mr-2" />}
          <span className="text-sm">{serverName}</span>
        </div>
        <div className="flex items-center">
          {loading ? (
            <span className="text-xs text-text-muted-light">{t('common.loading')}</span>
          ) : (
            tools &&
            tools?.length > 0 && (
              <span className="text-xs mr-3 text-text-muted-light">
                {t('mcp.serverToolStatus', {
                  count: tools.length,
                  enabledCount,
                })}
              </span>
            )
          )}
          {!loading && (
            <div className="flex items-center">
              {error ? (
                <Tooltip content={error}>
                  <div className="w-3 h-3 rounded-full flex items-center justify-center bg-error" />
                </Tooltip>
              ) : (
                <div className="w-3 h-3 rounded-full flex items-center justify-center bg-success" />
              )}
            </div>
          )}
          {onEdit && (
            <IconButton
              icon={<FaPencilAlt className="text-text-secondary hover:text-text-primary w-3.5 h-3.5" />}
              onClick={onEdit}
              tooltip={t('common.edit')}
              className="ml-4"
            />
          )}
          {onRemove && (
            <IconButton
              icon={<FaTrash className="text-error-strong hover:text-error w-3.5 h-3.5" />}
              onClick={onRemove}
              tooltip={t('common.remove')}
              className="ml-3"
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="border border-border-default-dark rounded mb-1">
      <Accordion title={renderTitle()} buttonClassName="px-2" chevronPosition="right" isOpen={isOpen} onOpenChange={setIsOpen}>
        <McpOAuthControls
          serverName={serverName}
          config={config}
          refreshTrigger={oauthRefreshTrigger}
          onAuthenticated={handleOAuthAuthenticated}
          onDisconnected={handleOAuthDisconnected}
          onStatusChange={handleOAuthStatusChange}
        />
        {loading ? (
          <div className="text-xs text-text-muted p-2">{t('common.loading')}</div>
        ) : oauthStatus === McpOAuthStatus.AuthenticationRequired || oauthStatus === McpOAuthStatus.Authorizing ? null : error ? (
          <div className="text-xs text-error-light p-4">{error}</div>
        ) : tools && tools.length > 0 ? (
          <div>
            <div className="text-xs p-2 pt-1 rounded mt-1 space-y-2">
              {onApprovalChange && toolApprovals && (
                <div className="flex items-center">
                  <div className="flex-1 text-xs ml-1 text-text-muted-light">{t('mcp.tools')}</div>
                  <div className="flex items-center">
                    <span className="text-xs text-text-muted-light mr-2">{t('mcp.all')}</span>
                    <Select
                      options={approvalOptions}
                      size="sm"
                      value={commonApproval ?? MIXED_VALUE}
                      notFoundLabel={MIXED_VALUE}
                      onChange={handleBulkApprovalChange}
                    />
                  </div>
                </div>
              )}
              {tools.map((tool) => (
                <McpToolItem key={tool.name} tool={tool} toolApprovals={toolApprovals} onApprovalChange={onApprovalChange} serverName={serverName} />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-xs text-text-muted p-4">{t('mcp.noToolsFound')}</div>
        )}
      </Accordion>
    </div>
  );
};
