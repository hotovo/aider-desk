import { McpOAuthStatus, McpServerConfig, McpTool, ToolApprovalState } from '@common/types';
import { extractIpcErrorMessage } from '@common/utils';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaPencilAlt, FaTrash } from 'react-icons/fa';
import { TOOL_GROUP_NAME_SEPARATOR } from '@common/tools';

import { McpToolItem } from './McpToolItem';
import { McpOAuthControls } from './McpOAuthControls';

import { Accordion } from '@/components/common/Accordion';
import { IconButton } from '@/components/common/IconButton';
import { Checkbox } from '@/components/common/Checkbox';
import { useApi } from '@/contexts/ApiContext';
import { Tooltip } from '@/components/ui/Tooltip';

type Props = {
  serverName: string;
  config: McpServerConfig;
  onRemove?: () => void;
  onEdit?: () => void;
  toolApprovals: Record<string, ToolApprovalState>;
  onApprovalChange: (toolId: string, approval: ToolApprovalState) => void;
  reloadTrigger?: number;
  enabled?: boolean;
  onEnabledChange?: (enabled: boolean) => void;
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
      const loadedTools = await api.loadMcpServerTools(serverName, config);
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
  }, [api, config, serverName]);

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

  const renderTitle = () => {
    const enabledCount =
      tools && tools.length - tools.filter((tool) => toolApprovals[`${serverName}${TOOL_GROUP_NAME_SEPARATOR}${tool.name}`] === ToolApprovalState.Never).length;

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
              <div className="text-xs text-text-muted-light ml-1">{t('mcp.tools')}</div>
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
