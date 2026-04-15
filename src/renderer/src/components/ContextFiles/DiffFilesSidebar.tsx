import { ContextFile, UpdatedFile } from '@common/types';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HiChevronDown, HiChevronRight } from 'react-icons/hi';
import { MdOutlineCommit } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { useDebounce, useLocalStorage } from '@reactuses/core';
import { ControlledTreeEnvironment, Tree } from 'react-complex-tree';
import { ResizableBox } from 'react-resizable';
import { clsx } from 'clsx';

import { createFileTree, normalizePath } from './types';
import { UNCOMMITTED_GROUP_ID } from './group-files';

import type { DiffModalGroup } from './UpdatedFilesDiffModal';
import type { TreeItem } from './types';

import { Input } from '@/components/common/Input';
import { Tooltip } from '@/components/ui/Tooltip';

type GroupTree = {
  group: DiffModalGroup;
  treeData: Record<string, TreeItem>;
  files: UpdatedFile[];
};

const MIN_WIDTH = 180;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 240;

type Props = {
  groups: DiffModalGroup[];
  currentFile: UpdatedFile | null;
  onFileSelect: (file: UpdatedFile) => void;
};

export const DiffFilesSidebar = ({ groups, currentFile, onFileSelect }: Props) => {
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 50);
  const [sidebarWidth, setSidebarWidth] = useLocalStorage('diff-files-sidebar-width', DEFAULT_WIDTH);
  const [expandedItemsPerGroup, setExpandedItemsPerGroup] = useState<Record<string, string[]>>({});
  const selectedItemRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpandedItemsPerGroup((prev) => {
      const next: Record<string, string[]> = {};
      for (const gt of groupTrees) {
        const groupId = gt.group.id ?? UNCOMMITTED_GROUP_ID;
        const allFolders = Object.keys(gt.treeData).filter((key) => gt.treeData[key].isFolder);
        const existing = prev[groupId] || [];
        next[groupId] = Array.from(new Set([...existing, ...allFolders]));
      }
      return next;
    });
  }, [groupTrees]);

  useEffect(() => {
    if (currentFile && selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [currentFile]);

  const handleResize = useCallback(
    (_e: unknown, data: { size: { width: number } }) => {
      setSidebarWidth(data.size.width);
    },
    [setSidebarWidth],
  );

  const isCurrentFile = useCallback(
    (item: TreeItem) => {
      if (!currentFile || item.isFolder || !item.file) {
        return false;
      }
      return normalizePath(item.file.path) === normalizePath(currentFile.path);
    },
    [currentFile],
  );

  const handleFileClick = useCallback(
    (item: TreeItem, groupFiles: UpdatedFile[]) => {
      if (item.isFolder || !item.file) {
        return;
      }
      const filePath = normalizePath(item.file.path);
      const file = groupFiles.find((f) => normalizePath(f.path) === filePath);
      if (file) {
        onFileSelect(file);
      }
    },
    [onFileSelect],
  );

  const hasContent = groupTrees.some((gt) => Object.keys(gt.treeData).length > 1);

  const isFlatMode = groups.length === 1 && !groups[0].commitHash;

  const renderGroupHeader = (group: DiffModalGroup) => {
    if (isFlatMode) {
      return null;
    }

    const isUncommitted = !group.commitHash;
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 border-t border-border-default shrink-0">
        <MdOutlineCommit className="h-3 w-3 text-text-muted shrink-0" />
        {isUncommitted ? (
          <span className="text-2xs font-medium text-text-secondary uppercase">{t('contextFiles.uncommitted')}</span>
        ) : (
          <>
            <Tooltip content={group.commitMessage || ''}>
              <span className="text-2xs font-medium text-text-secondary font-mono">{group.commitHash?.slice(0, 7)}</span>
            </Tooltip>
            {group.commitMessage && <span className="text-2xs text-text-muted truncate">{group.commitMessage}</span>}
          </>
        )}
      </div>
    );
  };

  const renderTreeForGroup = (gt: GroupTree) => {
    const groupId = gt.group.id ?? UNCOMMITTED_GROUP_ID;
    const treeId = `diff-sidebar-tree-${groupId}`;
    const expandedItems = expandedItemsPerGroup[groupId] || [];

    const handleExpandItem = (item: TreeItem) => {
      setExpandedItemsPerGroup((prev) => ({
        ...prev,
        [groupId]: [...(prev[groupId] || []), String(item.index)],
      }));
    };

    const handleCollapseItem = (item: TreeItem) => {
      setExpandedItemsPerGroup((prev) => ({
        ...prev,
        [groupId]: (prev[groupId] || []).filter((id) => id !== String(item.index)),
      }));
    };

    const renderItem = (props: { item: TreeItem; title: ReactNode; children: ReactNode; context: unknown }) => {
      const isFolder = props.item.isFolder;
      const selected = isCurrentFile(props.item);

      const handleClick = () => {
        if (isFolder) {
          const isExpanded = expandedItems.includes(String(props.item.index));
          if (isExpanded) {
            handleCollapseItem(props.item);
          } else {
            handleExpandItem(props.item);
          }
        } else {
          handleFileClick(props.item, gt.files);
        }
      };

      const renderChevron = () => {
        if (!isFolder) {
          return <span className="w-2.5 h-2.5 inline-block flex-shrink-0" />;
        }
        const isExpanded = expandedItems.includes(String(props.item.index));
        return isExpanded ? <HiChevronDown className="w-3 h-3 text-text-muted-dark" /> : <HiChevronRight className="w-3 h-3 text-text-muted-dark" />;
      };

      const matchedFile = !isFolder && props.item.file ? gt.files.find((f) => normalizePath(f.path) === normalizePath(props.item.file!.path)) : undefined;

      return (
        <>
          <div ref={selected ? selectedItemRef : undefined} className={clsx('flex items-center w-full pr-1 h-6 cursor-pointer')} onClick={handleClick}>
            {renderChevron()}
            <span
              className={clsx(
                'select-none text-2xs overflow-hidden whitespace-nowrap overflow-ellipsis ml-0.5 flex-grow min-w-0',
                !isFolder && 'hover:text-text-tertiary',
                isFolder ? 'text-text-muted' : selected ? 'text-text-primary font-medium' : 'text-text-muted',
              )}
            >
              {props.title}
            </span>
            {!isFolder && matchedFile && (matchedFile.additions > 0 || matchedFile.deletions > 0) && (
              <span className="text-4xs text-text-muted-dark flex-shrink-0 flex items-center gap-0.5 ml-auto pl-2">
                {matchedFile.additions > 0 && <span className="text-success">+{matchedFile.additions}</span>}
                {matchedFile.deletions > 0 && <span className="text-error">-{matchedFile.deletions}</span>}
              </span>
            )}
          </div>
          {props.children}
        </>
      );
    };

    return (
      <div key={groupId}>
        {renderGroupHeader(gt.group)}
        <ControlledTreeEnvironment
          items={gt.treeData}
          getItemTitle={(item) => item.data}
          renderItemTitle={({ title }) => title}
          viewState={{
            [treeId]: {
              expandedItems,
            },
          }}
          onExpandItem={handleExpandItem}
          onCollapseItem={handleCollapseItem}
          renderItem={renderItem}
          canDragAndDrop={false}
          canDropOnFolder={false}
          canReorderItems={false}
        >
          <Tree treeId={treeId} rootItem="root" />
        </ControlledTreeEnvironment>
      </div>
    );
  };

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
            groupTrees.map((gt) => renderTreeForGroup(gt))
          ) : (
            <div className="flex items-center justify-center text-text-muted text-2xs h-full">{t('common.noFiles')}</div>
          )}
        </div>
      </div>
    </ResizableBox>
  );
};
