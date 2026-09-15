import { ContextFile, UpdatedFile } from '@common/types';
import { useCallback, useMemo, useState } from 'react';
import { MdOutlineCommit } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { useDebounce, useLocalStorage } from '@reactuses/core';
import { ResizableBox } from 'react-resizable';

import { SidebarGroupTree } from './SidebarGroupTree';
import { createFileTree, normalizePath } from './types';
import { UNCOMMITTED_GROUP_ID } from './group-files';

import type { DiffModalGroup } from './UpdatedFilesDiffModal';
import type { GroupTree } from './types';

import { Input } from '@/components/common/Input';
import { Tooltip } from '@/components/ui/Tooltip';

const MIN_WIDTH = 180;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 240;

type Props = {
  groups: DiffModalGroup[];
  currentFile: UpdatedFile | null;
  onFileSelect: (file: UpdatedFile) => void;
  selectedFilePaths: Set<string>;
  onToggleFileSelection: (filePath: string, selected: boolean) => void;
  onToggleFolderSelection: (filePaths: string[], selected: boolean) => void;
};

export const DiffFilesSidebar = ({ groups, currentFile, onFileSelect, selectedFilePaths, onToggleFileSelection, onToggleFolderSelection }: Props) => {
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 50);
  const [sidebarWidth, setSidebarWidth] = useLocalStorage('diff-files-sidebar-width', DEFAULT_WIDTH);

  const handleResize = useCallback(
    (_e: unknown, data: { size: { width: number } }) => {
      setSidebarWidth(data.size.width);
    },
    [setSidebarWidth],
  );

  const searchTextLower = debouncedSearchQuery.trim().toLowerCase();

  const groupTrees = useMemo(() => {
    const result: GroupTree[] = [];

    for (const group of groups) {
      let files = group.files;
      if (searchTextLower) {
        files = files.filter((f) => f.path.toLowerCase().includes(searchTextLower));
      }
      if (files.length === 0) {
        continue;
      }

      const allFileObjects: ContextFile[] = files.map((f) => ({ path: f.path }));
      const treeData = createFileTree(allFileObjects, 'root');

      result.push({ group, treeData, files });
    }

    return result;
  }, [groups, searchTextLower]);

  const hasContent = groupTrees.length > 0;

  const isFlatMode = groups.length === 1 && !groups[0].commitHash;

  return (
    <ResizableBox
      width={sidebarWidth || DEFAULT_WIDTH}
      height={Infinity}
      minConstraints={[MIN_WIDTH, Infinity]}
      maxConstraints={[MAX_WIDTH, Infinity]}
      axis="x"
      resizeHandles={['e']}
      className="flex flex-col h-full"
      onResize={handleResize}
    >
      <div className="flex flex-col h-full border-r border-border-default bg-bg-primary-light-strong overflow-hidden">
        <div className="px-2 py-1.5 border-b border-border-default bg-bg-primary-light shrink-0">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('contextFiles.searchPlaceholder')}
            size="sm"
            autoFocus={false}
          />
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-bg-tertiary scrollbar-track-bg-primary-light scrollbar-rounded pl-1 py-1">
          {hasContent ? (
            groupTrees.map((gt) => {
              const groupId = gt.group.id ?? UNCOMMITTED_GROUP_ID;
              const isUncommitted = !gt.group.commitHash;
              return (
                <div key={groupId}>
                  {isFlatMode ? null : (
                    <div className="flex items-center gap-1.5 px-2 py-1 border-t border-border-default shrink-0">
                      <MdOutlineCommit className="h-3 w-3 text-text-muted shrink-0" />
                      {isUncommitted ? (
                        <span className="text-2xs font-medium text-text-secondary uppercase">{t('contextFiles.uncommitted')}</span>
                      ) : (
                        <>
                          <Tooltip content={gt.group.commitMessage || ''}>
                            <span className="text-2xs font-medium text-text-secondary font-mono">{gt.group.commitHash?.slice(0, 7)}</span>
                          </Tooltip>
                          {gt.group.commitMessage && <span className="text-2xs text-text-muted truncate">{gt.group.commitMessage}</span>}
                        </>
                      )}
                    </div>
                  )}
                  <SidebarGroupTree
                    groupTree={gt}
                    showCheckboxes={isUncommitted}
                    currentFilePath={currentFile ? normalizePath(currentFile.path) : undefined}
                    selectedFilePaths={selectedFilePaths}
                    onFileSelect={onFileSelect}
                    onToggleFileSelection={onToggleFileSelection}
                    onToggleFolderSelection={onToggleFolderSelection}
                  />
                </div>
              );
            })
          ) : (
            <div className="flex items-center justify-center text-text-muted text-2xs h-full">{t('common.noFiles')}</div>
          )}
        </div>
      </div>
    </ResizableBox>
  );
};
