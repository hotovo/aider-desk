import { ChangeEvent, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsData, CloudflareTunnelStatus } from '@common/types';
import { clsx } from 'clsx';
import { BiCopy } from 'react-icons/bi';

import { Input } from '../common/Input';
import { Section } from '../common/Section';
import { Button } from '../common/Button';
import { Checkbox } from '../common/Checkbox';
import { ChipListInput } from '../common/ChipListInput';

import { useApi } from '@/contexts/ApiContext';
import { IconButton } from '@/components/common/IconButton';
import { InfoIcon } from '@/components/common/InfoIcon';

type Props = {
  settings: SettingsData;
  setSettings: (settings: SettingsData) => void;
};

export const NetworkSettings = ({ settings, setSettings }: Props) => {
  const { t } = useTranslation();
  const api = useApi();
  const [isLoading, setIsLoading] = useState(false);
  const [operation, setOperation] = useState<'starting' | 'stopping' | null>(null);
  const [tunnelStatus, setTunnelStatus] = useState<CloudflareTunnelStatus | null>(null);
  const [tunnelLoading, setTunnelLoading] = useState(false);
  const [tunnelOperation, setTunnelOperation] = useState<'starting' | 'stopping' | null>(null);

  const isServerRunning = settings.server.enabled;

  const handleProxyEnabledChange = (checked: boolean) => {
    setSettings({
      ...settings,
      proxy: {
        ...settings.proxy,
        enabled: checked,
      },
    });
  };

  const handleProxyUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSettings({
      ...settings,
      proxy: {
        ...settings.proxy,
        url: e.target.value,
      },
    });
  };

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

  const handleCorsEnabledChange = (checked: boolean) => {
    setSettings({
      ...settings,
      server: {
        ...settings.server,
        cors: {
          ...settings.server.cors,
          enabled: checked,
        },
      },
    });
  };

  const handleAddCorsOrigin = (origin: string) => {
    setSettings({
      ...settings,
      server: {
        ...settings.server,
        cors: {
          ...settings.server.cors,
          origins: [...settings.server.cors.origins, origin],
        },
      },
    });
  };

  const handleRemoveCorsOrigin = (origin: string) => {
    setSettings({
      ...settings,
      server: {
        ...settings.server,
        cors: {
          ...settings.server.cors,
          origins: settings.server.cors.origins.filter((o) => o !== origin),
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

  const renderProxySection = () => (
    <Section id="network-proxy" title={t('settings.network.proxy')}>
      <div className="p-4 space-y-4">
        <div>
          <Checkbox label={t('settings.network.enableProxy')} checked={settings.proxy.enabled} onChange={handleProxyEnabledChange} />
          <p className="text-xs text-text-muted mt-2">{t('settings.network.enableProxyDescription')}</p>
        </div>
        {settings.proxy.enabled && (
          <Input
            label={<div className="text-xs">{t('settings.network.proxyUrl')}</div>}
            value={settings.proxy.url}
            onChange={handleProxyUrlChange}
            type="text"
            placeholder={t('settings.network.proxyUrlPlaceholder')}
          />
        )}
      </div>
    </Section>
  );

  const renderCorsSection = () => (
    <div className="space-y-2">
      <div className="flex items-center">
        <Checkbox
          label={t('settings.server.enableCors')}
          checked={settings.server.cors.enabled}
          onChange={handleCorsEnabledChange}
          disabled={isServerRunning}
        />
        <InfoIcon tooltip={t('settings.server.enableCorsDescription')} />
      </div>
      {settings.server.cors.enabled && (
        <ChipListInput
          label={t('settings.server.corsOrigins')}
          items={settings.server.cors.origins}
          onAdd={handleAddCorsOrigin}
          onRemove={handleRemoveCorsOrigin}
          placeholder={t('settings.server.corsOriginPlaceholder')}
          addLabel={t('settings.server.addCorsOrigin')}
        />
      )}
    </div>
  );

  if (!api.isManageServerSupported()) {
    return (
      <div className="space-y-6">
        {renderProxySection()}
        <Section id="network-cors" title={t('settings.server.cors')}>
          <div className="p-4">{renderCorsSection()}</div>
        </Section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {renderProxySection()}

      <Section id="network-server" title={t('settings.tabs.server')}>
        <div className="p-4 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center">
              <Checkbox
                label={t('settings.server.enableBasicAuth')}
                checked={settings.server.basicAuth.enabled}
                onChange={handleBasicAuthEnabledChange}
                disabled={isServerRunning}
              />
              <InfoIcon tooltip={t('settings.server.enableBasicAuthDescription')} />
            </div>
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

          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-bg-secondary rounded-md">
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
            <p className="text-xs text-text-muted">{t('settings.server.description')}</p>
          </div>
          {isServerRunning && (
            <div className="space-y-6">
              {renderCorsSection()}
              <div className="space-y-2">
                <div className="flex items-center">
                  <h4 className="text-sm font-medium">{t('settings.server.tunnelManagement')}</h4>
                  <InfoIcon tooltip={t('settings.server.tunnelDescription')} />
                </div>
                <div className="flex items-center justify-between p-3 bg-bg-secondary rounded-md">
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
                      onClick={async () => {
                        try {
                          await api.writeToClipboard(tunnelStatus.url!);
                        } catch (error) {
                          // eslint-disable-next-line no-console
                          console.error('Failed to copy URL:', error);
                        }
                      }}
                      tooltip={t('settings.server.copyUrl')}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
};
