import { McpOAuthStatus, type McpServerConfig } from '@common/types';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/common/Button';
import { useApi } from '@/contexts/ApiContext';

type Props = {
  serverName: string;
  config: McpServerConfig;
  refreshTrigger: number;
  onAuthenticated: () => void;
  onDisconnected: () => void;
  onStatusChange: (status: McpOAuthStatus) => void;
};

export const McpOAuthControls = ({ serverName, config, refreshTrigger, onAuthenticated, onDisconnected, onStatusChange }: Props) => {
  const { t } = useTranslation();
  const api = useApi();
  const [status, setStatus] = useState(McpOAuthStatus.NotRequired);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateStatus = useCallback(
    (newStatus: McpOAuthStatus) => {
      setStatus(newStatus);
      onStatusChange(newStatus);
    },
    [onStatusChange],
  );

  useEffect(() => {
    let cancelled = false;
    const loadStatus = async () => {
      try {
        const result = await api.getMcpOAuthStatus(serverName, config);
        if (!cancelled) {
          updateStatus(result.status);
        }
      } catch {
        if (!cancelled) {
          updateStatus(McpOAuthStatus.NotRequired);
        }
      }
    };
    void loadStatus();
    return () => {
      cancelled = true;
    };
  }, [api, config, refreshTrigger, serverName, updateStatus]);

  useEffect(() => {
    if (status !== McpOAuthStatus.Authorizing) {
      return;
    }
    const interval = setInterval(() => {
      void api
        .getMcpOAuthStatus(serverName, config)
        .then((result) => {
          updateStatus(result.status);
          if (result.status === McpOAuthStatus.Authenticated) {
            onAuthenticated();
          }
        })
        .catch(() => undefined);
    }, 1000);
    return () => clearInterval(interval);
  }, [api, config, onAuthenticated, serverName, status, updateStatus]);

  const handleConnect = async () => {
    setBusy(true);
    setError(null);
    try {
      const authorizationUrl = await api.startMcpOAuth(serverName, config);
      updateStatus(McpOAuthStatus.Authorizing);
      await api.openUrlExternally(authorizationUrl);
    } catch (error) {
      setError(error instanceof Error ? error.message : t('mcp.oauth.connectError'));
      updateStatus(McpOAuthStatus.AuthenticationRequired);
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.disconnectMcpOAuth(serverName, config);
      updateStatus(McpOAuthStatus.AuthenticationRequired);
      onDisconnected();
    } catch (error) {
      setError(error instanceof Error ? error.message : t('mcp.oauth.disconnectError'));
    } finally {
      setBusy(false);
    }
  };

  if (status === McpOAuthStatus.NotRequired) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 border-b border-border-default-dark p-3 text-xs">
      <div className="flex items-center justify-between gap-3">
        <span className="text-text-secondary">
          {status === McpOAuthStatus.Authenticated
            ? t('mcp.oauth.connected')
            : status === McpOAuthStatus.Authorizing
              ? t('mcp.oauth.authorizing')
              : t('mcp.oauth.authenticationRequired')}
        </span>
        {status === McpOAuthStatus.Authenticated ? (
          <Button size="xs" color="danger" variant="outline" disabled={busy} onClick={handleDisconnect}>
            {t('mcp.oauth.disconnect')}
          </Button>
        ) : (
          <Button size="xs" disabled={busy} onClick={handleConnect}>
            {busy ? t('common.loading') : status === McpOAuthStatus.Authorizing ? t('mcp.oauth.reopen') : t('mcp.oauth.connect')}
          </Button>
        )}
      </div>
      {error && <span className="text-error-light">{error}</span>}
    </div>
  );
};
