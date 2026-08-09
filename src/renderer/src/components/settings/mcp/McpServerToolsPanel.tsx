import { McpOAuthStatus, McpServerConfig, McpTool } from '@common/types';
import { clsx } from 'clsx';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaPencilAlt, FaSyncAlt, FaTrash } from 'react-icons/fa';

import { McpOAuthControls } from './McpOAuthControls';
import { McpToolCard } from './McpToolCard';

import { IconButton } from '@/components/common/IconButton';

type Props = {
  serverName: string;
  config: McpServerConfig;
  tools: McpTool[] | null;
  loading: boolean;
  error: string | null;
  onReload: () => void;
  onEdit: () => void;
  onRemove: () => void;
};

export const McpServerToolsPanel = ({ serverName, config, tools, loading, error, onReload, onEdit, onRemove }: Props) => {
  const { t } = useTranslation();
  const [oauthStatus, setOAuthStatus] = useState(McpOAuthStatus.NotRequired);
  const [oauthRefreshTrigger, setOAuthRefreshTrigger] = useState(0);

  const handleRefresh = useCallback(() => {
    onReload();
  }, [onReload]);

  const handleOAuthAuthenticated = useCallback(() => {
    onReload();
  }, [onReload]);

  const handleOAuthDisconnected = useCallback(() => {
    setOAuthRefreshTrigger((value) => value + 1);
    onReload();
  }, [onReload]);

  const handleOAuthStatusChange = useCallback((status: McpOAuthStatus) => {
    setOAuthStatus(status);
  }, []);

  // A late tools-load failure with an auth error means OAuth discovery has completed in the main
  // process; re-fetch the OAuth status so the Connect control appears without reselecting the server.
  useEffect(() => {
    if (error?.includes('McpAuthenticationRequiredError') || error?.includes('requires OAuth authentication')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOAuthRefreshTrigger((value) => value + 1);
    }
  }, [error]);

  const isAuthError =
    oauthStatus === McpOAuthStatus.AuthenticationRequired ||
    oauthStatus === McpOAuthStatus.Authorizing ||
    !!error?.includes('McpAuthenticationRequiredError') ||
    !!error?.includes('requires OAuth authentication');

  return (
    <div className="flex flex-col h-full min-w-0">
      {/* Server header */}
      <div className="px-6 pt-5 pb-1">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
          <div className="text-sm font-medium text-text-primary truncate">{serverName}</div>
          <div className="flex items-center gap-2">
            {loading ? (
              <span className="text-xs text-text-muted-light">{t('common.loading')}</span>
            ) : error ? (
              <span className="text-xs text-error-light">{t('mcp.loadToolsError')}</span>
            ) : tools && tools.length > 0 ? (
              <span className="text-xs text-text-muted-light">{t('mcp.toolsCount', { count: tools.length })}</span>
            ) : null}
            <IconButton
              icon={<FaPencilAlt className="w-3.5 h-3.5" />}
              onClick={onEdit}
              tooltip={t('common.edit')}
              className="p-2 rounded hover:bg-bg-tertiary"
            />
            <IconButton
              icon={<FaTrash className="w-3.5 h-3.5" />}
              onClick={onRemove}
              tooltip={t('common.remove')}
              className="p-2 rounded hover:bg-bg-tertiary hover:text-error"
            />
            <IconButton
              icon={<FaSyncAlt className={clsx('w-3.5 h-3.5', loading && 'animate-spin')} />}
              onClick={handleRefresh}
              tooltip={t('mcp.reloadServer')}
              className="p-2 rounded hover:bg-bg-tertiary"
            />
          </div>
        </div>
      </div>

      {/* Tools content */}
      <div className="flex-1 min-h-0 overflow-hidden px-6 pb-4">
        <div className="max-w-3xl mx-auto py-2 pr-1 max-h-full overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-bg-tertiary">
          <McpOAuthControls
            serverName={serverName}
            config={config}
            refreshTrigger={oauthRefreshTrigger}
            onAuthenticated={handleOAuthAuthenticated}
            onDisconnected={handleOAuthDisconnected}
            onStatusChange={handleOAuthStatusChange}
            borderless
          />
          {loading ? (
            <div className="text-xs text-text-muted p-2">{t('common.loading')}</div>
          ) : isAuthError ? null : error ? (
            <div className="text-xs text-error-light p-4">{error}</div>
          ) : tools && tools.length > 0 ? (
            <div className="space-y-2">
              {tools.map((tool) => (
                <McpToolCard key={tool.name} tool={tool} />
              ))}
            </div>
          ) : (
            <div className="text-xs text-text-muted p-4">{t('mcp.noToolsFound')}</div>
          )}
        </div>
      </div>
    </div>
  );
};
