import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { FaChevronDown, FaDownload } from 'react-icons/fa';
import { clsx } from 'clsx';

import type { AvailableExtension, InstalledExtension } from '@common/types';

import { Button } from '@/components/common/Button';
import { Toggle } from '@/components/common/Toggle';
import { MARKDOWN_COMPONENTS, REMARK_PLUGINS } from '@/components/message/utils';

// Helper to normalize extension data
const getExtensionData = (extension: InstalledExtension | AvailableExtension) => {
  const isLoadedExtension = 'metadata' in extension;
  return {
    filePath: isLoadedExtension ? extension.filePath : null,
    name: isLoadedExtension ? extension.metadata.name : extension.name,
    version: isLoadedExtension ? extension.metadata.version : extension.version,
    description: isLoadedExtension ? extension.metadata.description : extension.description,
    author: isLoadedExtension ? extension.metadata.author : extension.author,
    projectDir: isLoadedExtension ? extension.projectDir : undefined,
    readmeContent: extension.readmeContent,
    iconUrl: isLoadedExtension ? extension.metadata.iconUrl : extension.iconUrl,
  };
};

type Props = {
  extension: InstalledExtension | AvailableExtension;
  isDisabled?: boolean;
  isUninstalling?: boolean;
  isInstalling?: boolean;
  onToggle?: (extensionName: string, isDisabled: boolean) => void;
  onUninstall?: (exensionFilePath: string) => void;
  onInstall?: (extension: AvailableExtension) => void;
};

export const ExtensionCard = ({ extension, isDisabled = false, isUninstalling = false, isInstalling = false, onToggle, onUninstall, onInstall }: Props) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const data = getExtensionData(extension);
  const hasReadme = data.readmeContent && data.readmeContent.trim().length > 0;
  const isInstalled = 'metadata' in extension;

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleToggleDisabled = () => {
    if (onToggle) {
      onToggle(data.name, isDisabled);
    }
  };

  const handleUninstall = () => {
    if (onUninstall && data.filePath) {
      onUninstall(data.filePath);
    }
  };

  const handleInstall = () => {
    if (onInstall && !('metadata' in extension)) {
      onInstall(extension as AvailableExtension);
    }
  };

  return (
    <div
      className={clsx(
        'group relative rounded-xl transition-all duration-200',
        isInstalled
          ? clsx('bg-bg-secondary border-2 shadow-subtle border-border-default', isDisabled && 'opacity-60')
          : 'bg-bg-secondary border-2 border-border-default',
      )}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3 flex-1 min-w-0">
            {/* Icon */}
            <div
              className={clsx(
                'w-12 h-12 rounded-xl flex items-center justify-center text-text-primary font-bold text-lg flex-shrink-0 bg-bg-primary-light-strong overflow-hidden',
                isDisabled && 'opacity-50',
              )}
            >
              {data.iconUrl ? <img src={data.iconUrl} alt={data.name} className="p-1 w-full h-full object-cover" /> : data.name.charAt(0).toUpperCase()}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h4 className={clsx('text-sm font-semibold truncate', isDisabled ? 'text-text-muted' : 'text-text-primary')}>{data.name}</h4>
                <span className="text-3xs px-2 py-0.5 rounded bg-bg-tertiary text-text-muted font-medium font-mono">v{data.version}</span>
                {isInstalled && !isDisabled && (
                  <span className="text-3xs px-2 py-0.5 rounded bg-success-subtle text-success font-semibold flex items-center gap-1">
                    ✓ {t('settings.extensions.active')}
                  </span>
                )}
                {isInstalled && isDisabled && (
                  <span className="text-3xs px-2 py-0.5 rounded bg-bg-tertiary text-text-muted font-semibold">{t('settings.extensions.disabled')}</span>
                )}
                {data.projectDir && (
                  <span className="text-3xs px-2 py-0.5 rounded bg-info-subtle text-info font-semibold">{t('settings.extensions.projectSpecific')}</span>
                )}
              </div>
              {data.description && (
                <p className={clsx('text-xs mt-1.5 line-clamp-2', isDisabled ? 'text-text-muted' : 'text-text-secondary')}>{data.description}</p>
              )}
              {data.author && (
                <p className="text-3xs text-text-muted mt-2">
                  {t('settings.extensions.by')} {data.author}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {isInstalled ? (
              <>
                <Toggle checked={!isDisabled} onChange={handleToggleDisabled} aria-label={t('settings.extensions.enabled')} />

                <Button onClick={handleUninstall} disabled={isUninstalling} variant="outline" size="xs" color="danger">
                  {isUninstalling ? t('settings.extensions.uninstalling') : t('settings.extensions.uninstall')}
                </Button>
              </>
            ) : (
              <Button onClick={handleInstall} disabled={isInstalling} variant="contained" size="xs">
                <FaDownload className="mr-1.5 w-3 h-3" />
                {isInstalling ? t('settings.extensions.installing') : t('settings.extensions.install')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Expandable README section */}
      {hasReadme && (
        <>
          {/* Chevron button at bottom center */}
          <div className="flex justify-center pb-2 -mt-6">
            <button
              onClick={handleToggleExpand}
              className="flex items-center justify-center w-8 h-6 rounded hover:bg-bg-tertiary transition-colors"
              aria-label={isExpanded ? t('settings.extensions.collapseReadme') : t('settings.extensions.expandReadme')}
            >
              <FaChevronDown className={clsx('w-3 h-3 text-text-muted transition-transform duration-200', isExpanded && 'rotate-180')} />
            </button>
          </div>

          {/* README content */}
          {isExpanded && (
            <div className="border-t border-border-default p-6">
              <div className="text-4xs text-text-primary max-w-none max-h-96 overflow-y-auto bg-bg-primary-light rounded-md p-4 scrollbar-thin scrollbar-track-bg-secondary scrollbar-thumb-bg-tertiary hover:scrollbar-thumb-bg-fourth">
                <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
                  {data.readmeContent!}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
