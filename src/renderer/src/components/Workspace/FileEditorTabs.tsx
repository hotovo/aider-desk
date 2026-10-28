import { type MouseEvent, type ReactNode, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { IoMdClose } from 'react-icons/io';
import { clsx } from 'clsx';

import { MenuOption, useContextMenu } from '@/contexts/ContextMenuContext';
import { useApi } from '@/contexts/ApiContext';
import { showSuccessNotification } from '@/utils/notifications';

export type OpenEditorFile = {
  path: string;
  taskId: string;
};

type Props = {
  baseDir: string;
  openFiles: OpenEditorFile[];
  activeFilePath: string | null;
  dirtyPaths: Set<string>;
  actions?: ReactNode;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  onCloseOthers: (path: string) => void;
  onCloseAll: () => void;
};

const isAbsolutePath = (filePath: string): boolean => /^(?:[a-zA-Z]:[\\/]|\\\\|\/)/.test(filePath);

const toAbsolutePath = (baseDir: string, filePath: string): string => {
  if (isAbsolutePath(filePath)) {
    return filePath;
  }
  const separator = baseDir.includes('\\') && !baseDir.includes('/') ? '\\' : '/';
  return `${baseDir}${separator}${filePath}`;
};

const toRelativePath = (baseDir: string, filePath: string): string => {
  for (const separator of ['/', '\\']) {
    const prefix = `${baseDir}${separator}`;
    if (filePath.startsWith(prefix)) {
      return filePath.slice(prefix.length);
    }
  }
  return filePath;
};

export const FileEditorTabs = ({ baseDir, openFiles, activeFilePath, dirtyPaths, actions, onSelect, onClose, onCloseOthers, onCloseAll }: Props) => {
  const { t } = useTranslation();
  const api = useApi();
  const { showMenu } = useContextMenu();
  const activeTabRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeFilePath]);

  if (openFiles.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center border-b border-border-default bg-bg-secondary" role="tablist">
      <div className="flex items-stretch overflow-x-auto scrollbar-thin scrollbar-thumb-bg-tertiary scrollbar-track-bg-primary-light scrollbar-rounded">
        {openFiles.map((file) => {
          const isActive = file.path === activeFilePath;
          const isDirty = dirtyPaths.has(file.path);
          const fileName = file.path.split('/').pop() || file.path;

          const handleSelect = () => {
            onSelect(file.path);
          };

          const handleCloseClick = (event: MouseEvent<HTMLButtonElement>) => {
            event.preventDefault();
            event.stopPropagation();
            onClose(file.path);
          };

          const handleAuxClick = (event: MouseEvent<HTMLDivElement>) => {
            if (event.button === 1) {
              event.preventDefault();
              onClose(file.path);
            }
          };

          const handleContextMenu = (event: MouseEvent<HTMLDivElement>) => {
            event.preventDefault();

            const options: MenuOption[] = [
              {
                label: t('contextMenu.close'),
                action: () => onClose(file.path),
              },
            ];

            if (openFiles.length > 1) {
              options.push(
                {
                  label: t('contextMenu.closeOtherTabs'),
                  action: () => onCloseOthers(file.path),
                },
                {
                  label: t('contextMenu.closeAllTabs'),
                  action: () => onCloseAll(),
                },
              );
            }

            options.push(
              {
                label: t('fileEditor.copyAbsolutePath'),
                action: async () => {
                  await api.writeToClipboard(toAbsolutePath(baseDir, file.path));
                  showSuccessNotification(t('fileEditor.pathCopied'));
                },
              },
              {
                label: t('fileEditor.copyRelativePath'),
                action: async () => {
                  await api.writeToClipboard(toRelativePath(baseDir, file.path));
                  showSuccessNotification(t('fileEditor.pathCopied'));
                },
              },
              {
                label: t('fileEditor.openInExternal'),
                action: () => {
                  void api.openPath(toAbsolutePath(baseDir, file.path));
                },
              },
            );

            showMenu(event.clientX, event.clientY, options, event.currentTarget);
          };

          return (
            <div
              key={file.path}
              ref={isActive ? activeTabRef : undefined}
              role="tab"
              aria-selected={isActive}
              title={file.path}
              onClick={handleSelect}
              onAuxClick={handleAuxClick}
              onContextMenu={handleContextMenu}
              className={clsx(
                'group flex items-center gap-1.5 pl-3 pr-1.5 py-2 text-xs cursor-pointer border-b-2 whitespace-nowrap shrink-0 select-none',
                isActive
                  ? 'border-accent-primary text-text-primary bg-bg-tertiary'
                  : 'border-transparent text-text-muted hover:text-text-secondary hover:bg-bg-tertiary-emphasis',
              )}
            >
              <span className="max-w-[160px] truncate">{fileName}</span>
              {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" aria-label={t('fileEditor.unsavedChanges')} />}
              <button
                type="button"
                onClick={handleCloseClick}
                onMouseDown={(event) => event.stopPropagation()}
                aria-label={t('fileEditor.closeTab', { file: fileName })}
                className={clsx(
                  'flex items-center justify-center w-4 h-4 rounded transition-colors',
                  isActive ? 'opacity-60 hover:opacity-100 hover:bg-bg-fourth' : 'opacity-0 group-hover:opacity-60 hover:opacity-100 hover:bg-bg-tertiary',
                )}
              >
                <IoMdClose className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
      {actions && <div className="flex items-center gap-3 shrink-0 px-3 py-1.5 ml-auto">{actions}</div>}
    </div>
  );
};
