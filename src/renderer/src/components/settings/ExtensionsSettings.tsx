import { AvailableExtension, LoadedExtension, ProjectData, SettingsData } from '@common/types';
import { Activity, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaDownload, FaPlus, FaTrash, FaCheck, FaSync } from 'react-icons/fa';
import { AIDER_DESK_EXTENSIONS_REPO_URL } from '@common/extensions';
import { clsx } from 'clsx';

import { useApi } from '@/contexts/ApiContext';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { Input } from '@/components/common/Input';
import { Checkbox } from '@/components/common/Checkbox';
import { Accordion } from '@/components/common/Accordion';
import { showSuccessNotification, showErrorNotification } from '@/utils/notifications';

enum Tab {
  Available = 'available',
  Installed = 'installed',
}

type Props = {
  settings: SettingsData;
  setSettings: (settings: SettingsData) => void;
  openProjects?: ProjectData[];
  selectedProjectContext?: string;
};

export const ExtensionsSettings = ({ settings, setSettings, selectedProjectContext }: Props) => {
  const { t } = useTranslation();
  const api = useApi();

  const [activeTab, setActiveTab] = useState<Tab>(Tab.Available);
  const [installedExtensions, setInstalledExtensions] = useState<LoadedExtension[]>([]);
  const [availableExtensions, setAvailableExtensions] = useState<AvailableExtension[]>([]);
  const [loadingInstalled, setLoadingInstalled] = useState(false);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [installingExtensions, setInstallingExtensions] = useState<Set<string>>(new Set());
  const [uninstallingExtensions, setUninstallingExtensions] = useState<Set<string>>(new Set());
  const [newRepositoryUrl, setNewRepositoryUrl] = useState('');
  const [expandedRepositories, setExpandedRepositories] = useState<Set<string>>(new Set());

  const projectDir = selectedProjectContext && selectedProjectContext !== 'global' ? selectedProjectContext : undefined;

  const loadInstalledExtensions = async () => {
    setLoadingInstalled(true);
    try {
      const extensions = await api.getInstalledExtensions(projectDir);
      setInstalledExtensions(extensions);
    } catch {
      showErrorNotification(t('settings.extensions.errors.loadInstalled'));
    } finally {
      setLoadingInstalled(false);
    }
  };

  const loadAvailableExtensions = async (forceRefresh = false) => {
    setLoadingAvailable(true);
    try {
      const repositories = settings.extensions?.repositories || [AIDER_DESK_EXTENSIONS_REPO_URL];
      const extensions = await api.getAvailableExtensions(repositories, forceRefresh);
      setAvailableExtensions(extensions);
    } catch {
      showErrorNotification(t('settings.extensions.errors.loadAvailable'));
    } finally {
      setLoadingAvailable(false);
    }
  };

  const handleRefresh = async () => {
    await Promise.all([loadInstalledExtensions(), loadAvailableExtensions(true)]);
  };

  useEffect(() => {
    void loadInstalledExtensions();
    void loadAvailableExtensions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectDir, settings.extensions?.repositories]);

  const handleToggleDisabled = (extensionName: string, isCurrentlyDisabled: boolean) => {
    const disabledExtensions = settings.extensions?.disabled || [];
    const updatedDisabled = isCurrentlyDisabled ? disabledExtensions.filter((name) => name !== extensionName) : [...disabledExtensions, extensionName];

    setSettings({
      ...settings,
      extensions: {
        ...settings.extensions,
        repositories: settings.extensions?.repositories || [AIDER_DESK_EXTENSIONS_REPO_URL],
        disabled: updatedDisabled,
      },
    });
  };

  const handleUninstall = async (extensionName: string) => {
    setUninstallingExtensions((prev) => new Set(prev).add(extensionName));
    try {
      const success = await api.uninstallExtension(extensionName, projectDir);
      if (success) {
        showSuccessNotification(t('settings.extensions.success.uninstall', { name: extensionName }));
        await loadInstalledExtensions();
        await loadAvailableExtensions();
      } else {
        showErrorNotification(t('settings.extensions.errors.uninstall'));
      }
    } catch {
      showErrorNotification(t('settings.extensions.errors.uninstall'));
    } finally {
      setUninstallingExtensions((prev) => {
        const next = new Set(prev);
        next.delete(extensionName);
        return next;
      });
    }
  };

  const handleInstall = async (extension: AvailableExtension) => {
    setInstallingExtensions((prev) => new Set(prev).add(extension.id));
    try {
      const success = await api.installExtension(extension.id, extension.repositoryUrl, projectDir);
      if (success) {
        showSuccessNotification(t('settings.extensions.success.install', { name: extension.name }));
        await loadInstalledExtensions();
        await loadAvailableExtensions();
      } else {
        showErrorNotification(t('settings.extensions.errors.install'));
      }
    } catch {
      showErrorNotification(t('settings.extensions.errors.install'));
    } finally {
      setInstallingExtensions((prev) => {
        const next = new Set(prev);
        next.delete(extension.id);
        return next;
      });
    }
  };

  const handleAddRepository = () => {
    const trimmedUrl = newRepositoryUrl.trim();
    if (!trimmedUrl) {
      return;
    }

    const currentRepositories = settings.extensions?.repositories || [AIDER_DESK_EXTENSIONS_REPO_URL];
    if (currentRepositories.includes(trimmedUrl)) {
      showErrorNotification(t('settings.extensions.errors.repositoryExists'));
      return;
    }

    setSettings({
      ...settings,
      extensions: {
        ...settings.extensions,
        repositories: [...currentRepositories, trimmedUrl],
        disabled: settings.extensions?.disabled || [],
      },
    });

    setNewRepositoryUrl('');
    showSuccessNotification(t('settings.extensions.success.addRepository'));
  };

  const handleRemoveRepository = (repositoryUrl: string) => {
    if (repositoryUrl === AIDER_DESK_EXTENSIONS_REPO_URL) {
      showErrorNotification(t('settings.extensions.errors.cannotRemoveDefault'));
      return;
    }

    const currentRepositories = settings.extensions?.repositories || [];
    const updatedRepositories = currentRepositories.filter((url) => url !== repositoryUrl);

    setSettings({
      ...settings,
      extensions: {
        ...settings.extensions,
        repositories: updatedRepositories,
        disabled: settings.extensions?.disabled || [],
      },
    });

    showSuccessNotification(t('settings.extensions.success.removeRepository'));
  };

  const disabledExtensions = settings.extensions?.disabled || [];

  const renderInstalledExtensionCard = (extension: LoadedExtension) => {
    const isDisabled = disabledExtensions.includes(extension.metadata.name);
    const isUninstalling = uninstallingExtensions.has(extension.metadata.name);

    return (
      <div
        key={extension.metadata.name}
        className={clsx(
          'group relative rounded-lg border transition-all duration-200',
          isDisabled ? 'bg-bg-secondary border-border-default opacity-70' : 'bg-bg-secondary border-border-default',
        )}
      >
        <div className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-semibold text-text-primary truncate">{extension.metadata.name}</h4>
                <span className="text-2xs px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted font-medium">v{extension.metadata.version}</span>
                {!isDisabled && (
                  <span className="text-2xs px-1.5 py-0.5 rounded bg-success/10 text-success font-medium flex items-center gap-1">
                    <FaCheck className="w-2 h-2" />
                    {t('settings.extensions.active')}
                  </span>
                )}
                {extension.projectDir && (
                  <span className="text-2xs px-1.5 py-0.5 rounded bg-info/10 text-info font-medium">{t('settings.extensions.projectSpecific')}</span>
                )}
              </div>
              {extension.metadata.description && <p className="text-xs text-text-secondary mt-1.5 line-clamp-2">{extension.metadata.description}</p>}
              {extension.metadata.author && (
                <p className="text-2xs text-text-muted mt-2">
                  {t('settings.extensions.by')} {extension.metadata.author}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <Checkbox
                checked={!isDisabled}
                onChange={() => handleToggleDisabled(extension.metadata.name, isDisabled)}
                label={t('settings.extensions.enabled')}
              />
              <Button onClick={() => handleUninstall(extension.metadata.name)} disabled={isUninstalling} variant="outline" size="xs" color="danger">
                {t('settings.extensions.uninstall')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAddRepository = () => {
    return (
      <div className="flex gap-2">
        <Input
          value={newRepositoryUrl}
          onChange={(e) => setNewRepositoryUrl(e.target.value)}
          placeholder={t('settings.extensions.repositories.placeholder')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleAddRepository();
            }
          }}
          wrapperClassName="flex-1"
        />
        <Button onClick={handleAddRepository} variant="contained" size="sm" disabled={!newRepositoryUrl.trim()}>
          <FaPlus className="mr-1.5 w-3 h-3" />
          {t('settings.extensions.repositories.add')}
        </Button>
      </div>
    );
  };

  const renderInstalledTab = () => {
    if (loadingInstalled) {
      return (
        <div className="flex items-center justify-center py-12 text-2xs">
          <div className="text-sm text-text-muted">{t('settings.extensions.loading')}</div>
        </div>
      );
    }

    if (installedExtensions.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm text-text-muted mb-2">{t('settings.extensions.installed.empty')}</p>
          <p className="text-xs text-text-muted">{t('settings.extensions.installed.emptyHint')}</p>
        </div>
      );
    }

    return <div className="space-y-2">{installedExtensions.map(renderInstalledExtensionCard)}</div>;
  };

  const renderAvailableTab = () => {
    // Group all extensions by repository URL
    const extensionsByRepository = new Map<string, AvailableExtension[]>();

    // Add all available extensions to the map
    availableExtensions.forEach((extension) => {
      const repo = extension.repositoryUrl;
      if (!extensionsByRepository.has(repo)) {
        extensionsByRepository.set(repo, []);
      }
      extensionsByRepository.get(repo)!.push(extension);
    });

    // Render extension card with appropriate controls based on installation status
    const renderExtensionCard = (extension: AvailableExtension) => {
      const installedExtension = installedExtensions.find((inst) => inst.id === extension.id);
      const isInstalled = !!installedExtension;
      const isInstalling = installingExtensions.has(extension.id);
      const isDisabled = isInstalled && disabledExtensions.includes(installedExtension.metadata.name);
      const isUninstalling = isInstalled && uninstallingExtensions.has(installedExtension.metadata.name);

      return (
        <div
          key={extension.id}
          className={clsx(
            'group relative rounded-lg border transition-all duration-200',
            isInstalled && isDisabled ? 'bg-bg-secondary border-border-default opacity-70' : 'bg-bg-secondary border-border-default',
          )}
        >
          <div className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-semibold text-text-primary truncate">{extension.name}</h4>
                  <span className="text-2xs px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted font-medium">v{extension.version}</span>
                  {isInstalled && !isDisabled && (
                    <span className="text-2xs px-1.5 py-0.5 rounded bg-success/10 text-success font-medium flex items-center gap-1">
                      <FaCheck className="w-2 h-2" />
                      {t('settings.extensions.active')}
                    </span>
                  )}
                  {extension.hasDependencies && (
                    <span className="text-2xs px-1.5 py-0.5 rounded bg-warning/10 text-warning font-medium">{t('settings.extensions.hasDependencies')}</span>
                  )}
                  {isInstalled && installedExtension.projectDir && (
                    <span className="text-2xs px-1.5 py-0.5 rounded bg-info/10 text-info font-medium">{t('settings.extensions.projectSpecific')}</span>
                  )}
                </div>
                {extension.description && <p className="text-xs text-text-secondary mt-1.5 line-clamp-2">{extension.description}</p>}
                {extension.author && (
                  <p className="text-2xs text-text-muted mt-2">
                    {t('settings.extensions.by')} {extension.author}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {isInstalled ? (
                  <>
                    <Checkbox
                      checked={!isDisabled}
                      onChange={() => handleToggleDisabled(installedExtension.metadata.name, isDisabled)}
                      label={t('settings.extensions.enabled')}
                    />
                    <Button
                      onClick={() => handleUninstall(installedExtension.metadata.name)}
                      disabled={isUninstalling}
                      variant="outline"
                      size="xs"
                      color="danger"
                    >
                      {t('settings.extensions.uninstall')}
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => handleInstall(extension)} disabled={isInstalling} variant="contained" size="xs">
                    <FaDownload className="mr-1.5 w-3 h-3" />
                    {isInstalling ? t('settings.extensions.installing') : t('settings.extensions.install')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    };

    const handleToggleRepository = (repositoryUrl: string) => {
      setExpandedRepositories((prev) => {
        const next = new Set(prev);
        if (next.has(repositoryUrl)) {
          next.delete(repositoryUrl);
        } else {
          next.add(repositoryUrl);
        }
        return next;
      });
    };

    // Render repository accordion
    const renderRepositoryAccordion = (repositoryUrl: string, extensions: AvailableExtension[]) => {
      const installedCount = extensions.filter((ext) => installedExtensions.some((inst) => inst.id === ext.id)).length;
      const isDefault = repositoryUrl === AIDER_DESK_EXTENSIONS_REPO_URL;
      const isExpanded = expandedRepositories.has(repositoryUrl);

      return (
        <Accordion
          key={repositoryUrl}
          title={
            <div className="flex items-center gap-2 text-sm font-medium text-text-primary w-full pr-2">
              <div className="flex items-center gap-2 flex-1">
                <span className="truncate text-xs">{repositoryUrl}</span>
                <span className="text-2xs px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-muted">{extensions.length}</span>
                {installedCount > 0 && (
                  <span className="text-2xs px-1.5 py-0.5 rounded-full bg-success/10 text-success">
                    {installedCount} {t('settings.extensions.available.installedCount')}
                  </span>
                )}
              </div>
              {!isDefault && (
                <IconButton
                  icon={<FaTrash />}
                  onClick={() => handleRemoveRepository(repositoryUrl)}
                  tooltip={t('settings.extensions.repositories.remove')}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                />
              )}
            </div>
          }
          isOpen={isExpanded}
          onOpenChange={() => handleToggleRepository(repositoryUrl)}
          noMaxHeight={true}
          className="rounded-lg border border-border-default bg-bg-secondary group"
          buttonClassName="px-4 py-3"
        >
          <div className="px-4 pb-4 pt-2 space-y-2">{extensions.map(renderExtensionCard)}</div>
        </Accordion>
      );
    };

    return (
      <div className="space-y-4">
        {renderAddRepository()}

        {loadingAvailable ? (
          <div className="flex items-center justify-center py-12 text-2xs">
            <div className="text-sm text-text-muted">{t('settings.extensions.loading')}</div>
          </div>
        ) : extensionsByRepository.size === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-xs text-text-muted">{t('settings.extensions.available.empty')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {Array.from(extensionsByRepository.entries()).map(([repoUrl, extensions]) => renderRepositoryAccordion(repoUrl, extensions))}
          </div>
        )}
      </div>
    );
  };

  const isLoading = loadingInstalled || loadingAvailable;

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-1 p-1 bg-bg-secondary rounded-lg border border-border-default">
          <button
            onClick={() => setActiveTab(Tab.Available)}
            className={clsx(
              'px-4 py-2 text-sm font-medium rounded-md transition-all duration-200',
              activeTab === Tab.Available ? 'bg-bg-fourth text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary hover:bg-bg-tertiary',
            )}
          >
            {t('settings.extensions.tabs.available')}
            {availableExtensions.length > 0 && <span className="ml-2 text-2xs px-1.5 py-0.5 rounded-full bg-bg-tertiary">{availableExtensions.length}</span>}
          </button>
          <button
            onClick={() => setActiveTab(Tab.Installed)}
            className={clsx(
              'px-4 py-2 text-sm font-medium rounded-md transition-all duration-200',
              activeTab === Tab.Installed ? 'bg-bg-fourth text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary hover:bg-bg-tertiary',
            )}
          >
            {t('settings.extensions.tabs.installed')}
            {installedExtensions.length > 0 && <span className="ml-2 text-2xs px-1.5 py-0.5 rounded-full bg-bg-tertiary">{installedExtensions.length}</span>}
          </button>
        </div>
        <Button onClick={handleRefresh} disabled={isLoading} variant="outline" size="sm">
          <FaSync className={clsx('mr-1.5 w-3 h-3', isLoading && 'animate-spin')} />
          {t('common.refresh')}
        </Button>
      </div>

      {/* Tab Content */}
      <Activity mode={activeTab === Tab.Installed ? 'visible' : 'hidden'}>{renderInstalledTab()}</Activity>
      <Activity mode={activeTab === Tab.Available ? 'visible' : 'hidden'}>{renderAvailableTab()}</Activity>
    </div>
  );
};
