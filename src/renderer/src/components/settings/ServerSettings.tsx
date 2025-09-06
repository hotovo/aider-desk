import { ChangeEvent, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsData, CloudflareTunnelStatus } from '@common/types';
import { clsx } from 'clsx';
import { BiCopy } from 'react-icons/bi';

import { Input } from '../common/Input';
import { Section } from '../common/Section';
import { Button } from '../common/Button';
import { Checkbox } from '../common/Checkbox';

import { useApi } from '@/context/ApiContext';
import { IconButton } from '@/components/common/IconButton';

type Props = {
  settings: SettingsData;
  setSettings: (settings: SettingsData) => void;
};

export const ServerSettings = ({ settings, setSettings }: Props) => {
  const { t } = useTranslation();
  const api = useApi();
  const [isLoading, setIsLoading] = useState(false);
  const [operation, setOperation] = useState<'starting' | 'stopping' | null>(null);
  const [tunnelStatus, setTunnelStatus] = useState<CloudflareTunnelStatus | null>(null);
  const [tunnelLoading, setTunnelLoading] = useState(false);
  const [tunnelOperation, setTunnelOperation] = useState<'starting' | 'stopping' | null>(null);

  const isServerRunning = settings.server.enabled;

  useEffect(() => {
    const loadTunnelStatus = async () => {
      if (isServerRunning) {
        try {
          const status = await api.getCloudflareTunnelStatus();
          setTunnelStatus(status);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to load tunnel status:', error);
        }
      } else {
        setTunnelStatus(null);
      }
    };
    void loadTunnelStatus();
  }, [isServerRunning, api]);

  const handleServerToggle = async () => {
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    const isStarting = !isServerRunning;
    setOperation(isStarting ? 'starting' : 'stopping');

    try {
      let success: boolean;

      if (isStarting) {
        // Start server with current credentials if basic auth is enabled
        const username = settings.server.basicAuth.enabled ? settings.server.basicAuth.username : undefined;
        const password = settings.server.basicAuth.enabled ? settings.server.basicAuth.password : undefined;
        success = await api.startServer(username, password);
      } else {
        // Stop server
        success = await api.stopServer();
      }

      if (success) {
        // Update settings to reflect the new server state
        setSettings({
          ...settings,
          server: {
            ...settings.server,
            enabled: isStarting,
          },
        });
      } else {
        // Handle failure (could add toast notification here)
      }
    } catch {
      // Handle error (could add toast notification here)
    } finally {
      setIsLoading(false);
      setOperation(null);
    }
  };

  const handleBasicAuthEnabledChange = (checked: boolean) => {
    setSettings({
      ...settings,
      server: {
        ...settings.server,
        basicAuth: {
          ...settings.server.basicAuth,
          enabled: checked,
        },
      },
    });
  };

  const handleUsernameChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSettings({
      ...settings,
      server: {
        ...settings.server,
        basicAuth: {
          ...settings.server.basicAuth,
          username: e.target.value,
        },
      },
    });
  };

  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSettings({
      ...settings,
      server: {
        ...settings.server,
        basicAuth: {
          ...settings.server.basicAuth,
          password: e.target.value,
        },
      },
    });
  };

  const handleTunnelToggle = async () => {
    if (tunnelLoading) {
      return;
    }

    setTunnelLoading(true);
    const isStarting = !tunnelStatus?.isRunning;
    setTunnelOperation(isStarting ? 'starting' : 'stopping');

    try {
      let success: boolean;

      if (isStarting) {
        success = await api.startCloudflareTunnel();
      } else {
        await api.stopCloudflareTunnel();
        success = true;
      }

      if (success) {
        // Reload tunnel status
        const status = await api.getCloudflareTunnelStatus();
        setTunnelStatus(status);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Tunnel operation failed:', error);
    } finally {
      setTunnelLoading(false);
      setTunnelOperation(null);
    }
  };

  const getButtonText = () => {
    if (operation === 'starting') {
      return t('settings.server.starting');
    }
    if (operation === 'stopping') {
      return t('settings.server.stopping');
    }
    return isServerRunning ? t('settings.server.stop') : t('settings.server.start');
  };

  const getTunnelButtonText = () => {
    if (tunnelOperation === 'starting') {
      return t('settings.server.starting');
    }
    if (tunnelOperation === 'stopping') {
      return t('settings.server.stopping');
    }
    return tunnelStatus?.isRunning ? t('settings.server.stop') : t('settings.server.start');
  };

  return (
    <div className="space-y-6">
      <Section title={t('settings.server.authentication')}>
        <div className="p-4 space-y-4">
          <div>
            <Checkbox
              label={t('settings.server.enableBasicAuth')}
              checked={settings.server.basicAuth.enabled}
              onChange={handleBasicAuthEnabledChange}
              disabled={isServerRunning}
            />
            <p className="text-xs text-text-muted mt-2">{t('settings.server.enableBasicAuthDescription')}</p>
          </div>
          {/* Collapsible Authentication Inputs */}
          {settings.server.basicAuth.enabled && (
            <div className="grid grid-cols-2 gap-4">
              <Input
                label={<div className="text-xs">{t('settings.server.username')}</div>}
                value={settings.server.basicAuth.username}
                onChange={handleUsernameChange}
                type="text"
                placeholder="admin"
              />
              <Input
                label={<div className="text-xs">{t('settings.server.password')}</div>}
                value={settings.server.basicAuth.password}
                onChange={handlePasswordChange}
                type="password"
                placeholder="password"
              />
            </div>
          )}
        </div>
      </Section>

      <Section title={t('settings.server.serverControl')}>
        <div className="p-4 space-y-4">
          <p className="text-xs text-text-muted">{t('settings.server.description')}</p>
          <div className="flex items-center justify-between p-3 bg-bg-secondary rounded-lg">
            <div>
              <p className="text-sm text-text-muted">
                {t('settings.server.status')}:{' '}
                <span className={clsx('font-medium', isServerRunning ? 'text-success' : 'text-error')}>
                  {isServerRunning ? t('settings.server.running') : t('settings.server.stopped')}
                </span>
              </p>
            </div>
            <Button variant="contained" size="sm" onClick={handleServerToggle} disabled={isLoading}>
              {getButtonText()}
            </Button>
          </div>
        </div>
      </Section>

      {isServerRunning && (
        <Section title={t('settings.server.tunnelManagement')}>
          <div className="p-4 space-y-4">
            <p className="text-xs text-text-muted">{t('settings.server.tunnelDescription')}</p>
            <div className="flex items-center justify-between p-3 bg-bg-secondary">
              <div className="flex-1">
                <p className="text-sm text-text-muted">
                  {t('settings.server.status')}:{' '}
                  <span className={clsx('font-medium', tunnelStatus?.isRunning ? 'text-success' : 'text-error')}>
                    {tunnelStatus?.isRunning ? t('settings.server.running') : t('settings.server.stopped')}
                  </span>
                </p>
              </div>
              <div className="ml-4">
                <Button variant="contained" size="sm" onClick={handleTunnelToggle} disabled={tunnelLoading}>
                  {getTunnelButtonText()}
                </Button>
              </div>
            </div>
            {tunnelStatus?.url && (
              <div className="pt-2 pb-4 flex items-center space-x-2 justify-center">
                <a href={tunnelStatus.url} target="_blank" rel="noopener noreferrer" className="text-info-light underline text-xs">
                  {tunnelStatus.url}
                </a>
                <IconButton
                  icon={<BiCopy className="h-5 w-5" />}
                  onClick={() => navigator.clipboard.writeText(tunnelStatus.url!)}
                  tooltip={t('settings.server.copyUrl')}
                />
              </div>
            )}
          </div>
        </Section>
      )}
    </div>
  );
};
