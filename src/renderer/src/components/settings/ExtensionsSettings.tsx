import { AvailableExtension, InstalledExtension, ProjectData, SettingsData } from '@common/types';
import { Activity, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaChevronDown, FaChevronLeft, FaChevronRight, FaPlus, FaSearch, FaSync, FaTrash } from 'react-icons/fa';
import { AIDER_DESK_EXTENSIONS_REPO_URL } from '@common/extensions';
import { clsx } from 'clsx';

import { useApi } from '@/contexts/ApiContext';
import { getPathBasename } from '@/utils/path-utils';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { Input } from '@/components/common/Input';
import { showErrorNotification, showSuccessNotification } from '@/utils/notifications';
import { LoadingOverlay } from '@/components/common/LoadingOverlay';
import { ExtensionCard } from '@/components/settings/ExtensionCard';

// Helper to format repository URL for display
const formatRepositoryName = (url: string): string => {
  try {
    const urlObj = new URL(url);

    // Check if it's a GitHub URL
    if (urlObj.hostname === 'github.com' || urlObj.hostname === 'www.github.com') {
      // Extract pathname and remove leading/trailing slashes
      const path = urlObj.pathname.replace(/^\/+|\/+$/g, '');

      // Remove .git suffix if present
      const cleanPath = path.replace(/\.git$/, '');

      // Extract only organization/repository (first two segments)
      const segments = cleanPath.split('/');
      if (segments.length >= 2) {
        return `${segments[0]}/${segments[1]}`;
      }

      return cleanPath || url;
    }

    // For non-GitHub URLs, return the full URL
    return url;
  } catch {
    // If URL parsing fails, return original
    return url;
  }
};

enum Tab {
  Available = 'available',
  Installed = 'installed',
}

type Props = {
  settings: SettingsData;
  setSettings: (settings: SettingsData) => void;
  openProjects?: ProjectData[];
  selectedProjectContext?: 'global' | string;
};

export const ExtensionsSettings = ({ settings, setSettings, openProjects = [], selectedProjectContext }: Props) => {
  const { t } = useTranslation();
  const api = useApi();

  const [activeTab, setActiveTab] = useState<Tab>(Tab.Installed);
  const [installedExtensions, setInstalledExtensions] = useState<InstalledExtension[]>([]);
  const [availableExtensions, setAvailableExtensions] = useState<AvailableExtension[]>([]);
  const [loadingInstalled, setLoadingInstalled] = useState(false);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [installingExtensions, setInstallingExtensions] = useState<Set<string>>(new Set());
  const [uninstallingExtensions, setUninstallingExtensions] = useState<Set<string>>(new Set());
  const [newRepositoryUrl, setNewRepositoryUrl] = useState('');
  const [expandedRepositories, setExpandedRepositories] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCapabilities, setSelectedCapabilities] = useState<Set<string>>(new Set());

  // Track repositories that are currently being loaded
  const [loadingRepositories, setLoadingRepositories] = useState<Set<string>>(new Set());

  // Context state for project-level extensions
  const contexts = useMemo(() => ['global', ...openProjects.map((p) => p.baseDir)], [openProjects]);
  const [contextIndex, setContextIndex] = useState(0);
  const [profileContext, setProfileContext] = useState<'global' | string>(selectedProjectContext || 'global');

  // Sync internal profileContext with selectedProjectContext prop
  useEffect(() => {
    if (selectedProjectContext !== undefined) {
      setProfileContext(selectedProjectContext);
      const newIndex = contexts.indexOf(selectedProjectContext);
      if (newIndex !== -1) {
        setContextIndex(newIndex);
      }
    }
  }, [selectedProjectContext, contexts]);

  // Context navigation logic
  const navigateContext = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev' ? (contextIndex - 1 + contexts.length) % contexts.length : (contextIndex + 1) % contexts.length;
    setContextIndex(newIndex);
    setProfileContext(contexts[newIndex]);
  };

  // Get context display name
  const getContextDisplayName = () => {
    if (profileContext === 'global') {
      return 'Global';
    }
    const project = openProjects.find((p) => p.baseDir === profileContext);
    return project ? getPathBasename(project.baseDir) : profileContext;
  };

  const projectDir = profileContext !== 'global' ? profileContext : undefined;

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

  const loadAvailableExtensions = async (forceRefresh = false, repositories?: string[]) => {
    setLoadingAvailable(true);
    try {
      const repos = repositories || settings.extensions?.repositories || [AIDER_DESK_EXTENSIONS_REPO_URL];
      const extensions = await api.getAvailableExtensions(repos, forceRefresh);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectDir]);

  // Load available extensions on initial mount only
  useEffect(() => {
    void loadAvailableExtensions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleUninstall = async (extensionFilePath: string) => {
    setUninstallingExtensions((prev) => new Set(prev).add(extensionFilePath));
    try {
      const success = await api.uninstallExtension(extensionFilePath, projectDir);
      if (success) {
        showSuccessNotification(t('settings.extensions.success.uninstall', { name: extensionFilePath }));
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
        next.delete(extensionFilePath);
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

  const handleAddRepository = async () => {
    const trimmedUrl = newRepositoryUrl.trim();
    if (!trimmedUrl) {
      return;
    }

    const currentRepositories = settings.extensions?.repositories || [AIDER_DESK_EXTENSIONS_REPO_URL];
    if (currentRepositories.includes(trimmedUrl)) {
      showErrorNotification(t('settings.extensions.errors.repositoryExists'));
      return;
    }

    // Update settings first
    setSettings({
      ...settings,
      extensions: {
        ...settings.extensions,
        repositories: [...currentRepositories, trimmedUrl],
        disabled: settings.extensions?.disabled || [],
      },
    });

    setNewRepositoryUrl('');

    // Fetch extensions from the new repository (fetchOnly=true to bypass all caching)
    setLoadingRepositories((prev) => new Set(prev).add(trimmedUrl));
    try {
      const newExtensions = await api.getAvailableExtensions([trimmedUrl], true, true);
      // Add new extensions to existing list
      setAvailableExtensions((prev) => [...prev, ...newExtensions]);
    } catch {
      showErrorNotification(t('settings.extensions.errors.loadAvailable'));
    } finally {
      setLoadingRepositories((prev) => {
        const next = new Set(prev);
        next.delete(trimmedUrl);
        return next;
      });
    }
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

    // Remove extensions from the removed repository from UI
    setAvailableExtensions((prev) => prev.filter((ext) => ext.repositoryUrl !== repositoryUrl));
  };

  const disabledExtensions = settings.extensions?.disabled || [];

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
          className="bg-bg-secondary border"
          wrapperClassName="flex-1"
        />
        <Button onClick={handleAddRepository} variant="text" size="sm" disabled={!newRepositoryUrl.trim()}>
          <FaPlus className="mr-1.5 w-3 h-3" />
          {t('settings.extensions.repositories.add')}
        </Button>
      </div>
    );
  };

  const filteredInstalledExtensions = installedExtensions.filter((ext) => {
    // Filter by context: in Global context, hide project-level extensions
    // In project context, show only extensions for that specific project
    if (profileContext === 'global') {
      // In global context, only show global extensions (no projectDir)
      if (ext.projectDir) {
        return false;
      }
    } else {
      // In project context, only show extensions for this specific project
      if (ext.projectDir !== profileContext) {
        return false;
      }
    }

    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      ext.metadata.name.toLowerCase().includes(searchLower) ||
      ext.metadata.description?.toLowerCase().includes(searchLower) ||
      ext.metadata.author?.toLowerCase().includes(searchLower);

    if (!matchesSearch) {
      return false;
    }

    if (selectedCapabilities.size > 0) {
      const extCapabilities = ext.metadata.capabilities || [];
      const hasSelectedCapability = Array.from(selectedCapabilities).some((cap) => extCapabilities.includes(cap));
      if (!hasSelectedCapability) {
        return false;
      }
    }

    return true;
  });

  const renderInstalledTab = () => {
    if (loadingInstalled) {
      return (
        <div className="flex items-center justify-center py-12 text-2xs">
          <LoadingOverlay message={t('settings.extensions.loading')} spinnerSize="sm" transparent={true} />
        </div>
      );
    }

    if (filteredInstalledExtensions.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm text-text-muted mb-2">{t('settings.extensions.installed.empty')}</p>
          <p className="text-xs text-text-muted">{t('settings.extensions.installed.emptyHint')}</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {filteredInstalledExtensions.map((extension) => (
          <ExtensionCard
            key={extension.filePath}
            extension={extension}
            isDisabled={disabledExtensions.includes(extension.metadata.name)}
            isUninstalling={uninstallingExtensions.has(extension.filePath)}
            onToggle={handleToggleDisabled}
            onUninstall={handleUninstall}
          />
        ))}
      </div>
    );
  };

  const filteredAvailableExtensions = availableExtensions.filter((ext) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      ext.name.toLowerCase().includes(searchLower) || ext.description?.toLowerCase().includes(searchLower) || ext.author?.toLowerCase().includes(searchLower);

    if (!matchesSearch) {
      return false;
    }

    if (selectedCapabilities.size > 0) {
      const extCapabilities = ext.capabilities || [];
      const hasSelectedCapability = Array.from(selectedCapabilities).some((cap) => extCapabilities.includes(cap));
      if (!hasSelectedCapability) {
        return false;
      }
    }

    return true;
  });

  const renderAvailableTab = () => {
    // Group all extensions by repository URL
    const extensionsByRepository = new Map<string, AvailableExtension[]>();

    // Add all available extensions to the map
    filteredAvailableExtensions.forEach((extension) => {
      const repo = extension.repositoryUrl;
      if (!extensionsByRepository.has(repo)) {
        extensionsByRepository.set(repo, []);
      }
      extensionsByRepository.get(repo)!.push(extension);
    });

    // Render extension card with appropriate controls based on installation status
    const renderExtensionCard = (extension: AvailableExtension) => {
      // Check if extension is installed in the current context
      const installedExtension = installedExtensions.find((inst) => {
        if (inst.id !== extension.id) {
          return false;
        }
        // In global context, only consider global extensions
        if (profileContext === 'global') {
          return !inst.projectDir;
        }
        // In project context, only consider extensions for this specific project
        return inst.projectDir === profileContext;
      });

      // If installed, render with available extension data but installed controls
      if (installedExtension) {
        return (
          <ExtensionCard
            key={extension.id}
            extension={extension}
            isInstalled={true}
            isDisabled={disabledExtensions.includes(installedExtension.metadata.name)}
            isUninstalling={uninstallingExtensions.has(installedExtension.filePath)}
            installedFilePath={installedExtension.filePath}
            onToggle={handleToggleDisabled}
            onUninstall={handleUninstall}
          />
        );
      }

      // If not installed, render with available extension (AvailableExtension)
      return <ExtensionCard key={extension.id} extension={extension} isInstalling={installingExtensions.has(extension.id)} onInstall={handleInstall} />;
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

    // Render repository section
    const renderRepositorySection = (repositoryUrl: string, extensions: AvailableExtension[]) => {
      const installedCount = extensions.filter((ext) =>
        installedExtensions.some((inst) => {
          if (inst.id !== ext.id) {
            return false;
          }
          if (profileContext === 'global') {
            return !inst.projectDir;
          }
          return inst.projectDir === profileContext;
        }),
      ).length;
      const isDefault = repositoryUrl === AIDER_DESK_EXTENSIONS_REPO_URL;
      const isExpanded = expandedRepositories.has(repositoryUrl);
      const isLoadingRepo = loadingRepositories.has(repositoryUrl);

      return (
        <div key={repositoryUrl} className="rounded-lg border border-border-light bg-bg-secondary-light overflow-hidden group">
          {/* Repository Header */}
          <div
            className={clsx(
              'flex items-center justify-between px-4 py-3 cursor-pointer transition-colors',
              'bg-gradient-to-r from-button-primary via-button-primary to-bg-tertiary',
              'bg-[length:4px_100%,100%_100%] bg-no-repeat hover:bg-[length:4px_100%,100%_100%]',
              'hover:to-bg-secondary-light',
            )}
            onClick={() => handleToggleRepository(repositoryUrl)}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0 ml-3">
              <span className="text-sm font-semibold text-text-primary font-mono truncate">{formatRepositoryName(repositoryUrl)}</span>
              {isLoadingRepo ? (
                <span className="text-3xs text-text-muted font-medium">{t('settings.extensions.loading')}</span>
              ) : (
                <span className="text-3xs text-text-muted font-medium">
                  {installedCount}/{extensions.length} {t('settings.extensions.available.installedExtensions')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {!isDefault && (
                <IconButton
                  icon={<FaTrash />}
                  onClick={() => handleRemoveRepository(repositoryUrl)}
                  tooltip={t('settings.extensions.repositories.remove')}
                  className="text-error hover:text-error-light transition-colors opacity-0 group-hover:opacity-100"
                />
              )}
              <FaChevronDown className={clsx('w-3 h-3 text-text-muted transition-transform duration-200', !isExpanded && '-rotate-90')} />
            </div>
          </div>

          {/* Repository Content */}
          {isExpanded && <div className="p-4 space-y-3">{extensions.map(renderExtensionCard)}</div>}
        </div>
      );
    };

    return (
      <div className="space-y-3">
        {renderAddRepository()}
        {loadingAvailable ? (
          <div className="flex items-center justify-center py-12 text-2xs relative">
            <LoadingOverlay message={t('settings.extensions.loading')} spinnerSize="sm" transparent={true} />
          </div>
        ) : extensionsByRepository.size === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-xs text-text-muted">{t('settings.extensions.available.empty')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {Array.from(extensionsByRepository.entries()).map(([repoUrl, extensions]) => renderRepositorySection(repoUrl, extensions))}
            {/* Show loading repositories that don't have extensions yet */}
            {Array.from(loadingRepositories).map((repoUrl) => {
              if (!extensionsByRepository.has(repoUrl)) {
                return renderRepositorySection(repoUrl, []);
              }
              return null;
            })}
          </div>
        )}
      </div>
    );
  };

  const isLoading = loadingInstalled || loadingAvailable;

  const allCapabilities = Array.from(
    new Set([...installedExtensions.flatMap((ext) => ext.metadata.capabilities || []), ...availableExtensions.flatMap((ext) => ext.capabilities || [])]),
  ).sort();

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-1 p-1 bg-bg-primary rounded-lg border border-border-default">
          <button
            onClick={() => setActiveTab(Tab.Installed)}
            className={clsx(
              'px-4 py-2 text-sm font-medium rounded-md transition-all duration-200',
              activeTab === Tab.Installed ? 'bg-bg-tertiary text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary hover:bg-bg-tertiary',
            )}
          >
            {t('settings.extensions.tabs.installed')}
            {filteredInstalledExtensions.length > 0 && (
              <span className="ml-2 text-2xs px-1.5 py-0.5 rounded-full bg-bg-tertiary">{filteredInstalledExtensions.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab(Tab.Available)}
            className={clsx(
              'px-4 py-2 text-sm font-medium rounded-md transition-all duration-200',
              activeTab === Tab.Available ? 'bg-bg-tertiary text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary hover:bg-bg-tertiary',
            )}
          >
            {t('settings.extensions.tabs.available')}
            {availableExtensions.length > 0 && <span className="ml-2 text-2xs px-1.5 py-0.5 rounded-full bg-bg-tertiary">{availableExtensions.length}</span>}
          </button>
        </div>
        <div className="flex items-center justify-between w-[200px]">
          <IconButton
            icon={<FaChevronLeft className="w-3 h-3" />}
            onClick={() => navigateContext('prev')}
            tooltip={t('settings.extensions.previousContext')}
            disabled={contexts.length <= 1}
            className="p-1"
          />
          <div className="text-xs text-text-secondary truncate flex-1 text-center">{getContextDisplayName()}</div>
          <IconButton
            icon={<FaChevronRight className="w-3 h-3" />}
            onClick={() => navigateContext('next')}
            tooltip={t('settings.extensions.nextContext')}
            disabled={contexts.length <= 1}
            className="p-1"
          />
        </div>
        <Button onClick={handleRefresh} disabled={isLoading} variant="outline" size="sm">
          <FaSync className={clsx('mr-1.5 w-3 h-3', isLoading && 'animate-spin')} />
          {t('common.refresh')}
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="space-y-2">
        <div className="relative">
          <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('settings.extensions.search.placeholder')}
            className="pl-10 bg-bg-primary border w-full"
            wrapperClassName="w-full"
          />
        </div>

        {allCapabilities.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {allCapabilities.map((capability) => {
              const isSelected = selectedCapabilities.has(capability);
              return (
                <button
                  key={capability}
                  onClick={() => {
                    setSelectedCapabilities((prev) => {
                      const next = new Set(prev);
                      if (next.has(capability)) {
                        next.delete(capability);
                      } else {
                        next.add(capability);
                      }
                      return next;
                    });
                  }}
                  className={clsx(
                    'px-3 py-1 text-3xs font-medium rounded-full transition-colors border border-border-default',
                    isSelected ? 'bg-bg-secondary-light text-text-primary' : 'bg-bg-primary text-text-muted hover:text-text-secondary hover:bg-bg-tertiary',
                  )}
                >
                  {capability}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Tab Content */}
      <Activity mode={activeTab === Tab.Installed ? 'visible' : 'hidden'}>{renderInstalledTab()}</Activity>
      <Activity mode={activeTab === Tab.Available ? 'visible' : 'hidden'}>{renderAvailableTab()}</Activity>
    </div>
  );
};
