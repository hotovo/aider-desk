import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { FaCheck, FaChevronDown, FaDownload } from 'react-icons/fa';
import { clsx } from 'clsx';

import type { AvailableExtension, InstalledExtension } from '@common/types';

import { Button } from '@/components/common/Button';
import { Checkbox } from '@/components/common/Checkbox';
import { MARKDOWN_COMPONENTS, REMARK_PLUGINS } from '@/components/message/utils';

type Props = {
  extension: InstalledExtension | AvailableExtension;
  isDisabled?: boolean;
  isUninstalling?: boolean;
  isInstalling?: boolean;
  onToggle?: (extensionName: string, isDisabled: boolean) => void;
  onUninstall?: (extensionName: string) => void;
  onInstall?: (extension: AvailableExtension) => void;
};

// Helper to normalize extension data
const getExtensionData = (extension: InstalledExtension | AvailableExtension) => {
  const isLoadedExtension = 'metadata' in extension;
  return {
    name: isLoadedExtension ? extension.metadata.name : extension.name,
    version: isLoadedExtension ? extension.metadata.version : extension.version,
    description: isLoadedExtension ? extension.metadata.description : extension.description,
    author: isLoadedExtension ? extension.metadata.author : extension.author,
    projectDir: isLoadedExtension ? extension.projectDir : undefined,
    hasDependencies: isLoadedExtension ? false : extension.hasDependencies,
    readmeContent: extension.readmeContent,
  };
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
    if (onUninstall) {
      onUninstall(data.name);
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
        'group relative rounded-lg border transition-all duration-200',
        isInstalled && isDisabled ? 'bg-bg-primary-light-strong border-border-default' : 'bg-bg-secondary border-border-default',
      )}
    >
      <div className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className={clsx('min-w-0 flex-1', isInstalled && isDisabled ? 'opacity-50' : '')}>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-semibold text-text-primary truncate">{data.name}</h4>
              <span className="text-2xs px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted font-medium">v{data.version}</span>
              {isInstalled && !isDisabled && (
                <span className="text-2xs px-1.5 py-0.5 rounded bg-success/10 text-success font-medium flex items-center gap-1">
                  <FaCheck className="w-2 h-2" />
                  {t('settings.extensions.active')}
                </span>
              )}
              {data.hasDependencies && (
                <span className="text-2xs px-1.5 py-0.5 rounded bg-warning/10 text-warning font-medium">{t('settings.extensions.hasDependencies')}</span>
              )}
              {data.projectDir && (
                <span className="text-2xs px-1.5 py-0.5 rounded bg-info/10 text-info font-medium">{t('settings.extensions.projectSpecific')}</span>
              )}
            </div>
            {data.description && <p className="text-xs text-text-secondary mt-1.5 line-clamp-2">{data.description}</p>}
            {data.author && (
              <p className="text-2xs text-text-muted mt-2">
                {t('settings.extensions.by')} {data.author}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {isInstalled ? (
              <>
                <Checkbox checked={!isDisabled} onChange={handleToggleDisabled} label={t('settings.extensions.enabled')} />
                <Button onClick={handleUninstall} disabled={isUninstalling} variant="outline" size="xs" color="danger">
                  {t('settings.extensions.uninstall')}
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
          <div className="flex justify-center pb-2 -mt-8">
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
