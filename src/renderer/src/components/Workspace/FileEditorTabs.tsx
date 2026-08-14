import { type MouseEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { IoMdClose } from 'react-icons/io';
import { clsx } from 'clsx';

export type OpenEditorFile = {
  path: string;
  taskId: string;
};

type Props = {
  openFiles: OpenEditorFile[];
  activeFilePath: string | null;
  dirtyPaths: Set<string>;
  actions?: ReactNode;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
};

export const FileEditorTabs = ({ openFiles, activeFilePath, dirtyPaths, actions, onSelect, onClose }: Props) => {
  const { t } = useTranslation();

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

          return (
            <div
              key={file.path}
              role="tab"
              aria-selected={isActive}
              title={file.path}
              onClick={handleSelect}
              onAuxClick={handleAuxClick}
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
