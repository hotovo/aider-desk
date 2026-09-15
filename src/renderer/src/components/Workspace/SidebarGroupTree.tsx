import { UpdatedFile } from '@common/types';
import { MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HiChevronDown, HiChevronRight } from 'react-icons/hi';
import { RiAlertLine } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';
import { useTree } from '@headless-tree/react';
import { hotkeysCoreFeature, propMemoizationFeature, syncDataLoaderFeature } from '@headless-tree/core';
import { clsx } from 'clsx';

import { normalizePath, INDENT_PX } from './types';

import type { TreeItem, GroupTree } from './types';
import type { ItemInstance } from '@headless-tree/core';

import { Tooltip } from '@/components/ui/Tooltip';
import { TriStateCheckbox, type TriState } from '@/components/common/TriStateCheckbox';

const collectDescendantFilePaths = (treeData: Record<string, TreeItem>, nodeId: string): string[] => {
  const node = treeData[nodeId];
  if (!node) {
    return [];
  }
  if (!node.isFolder) {
    return node.file ? [node.file.path] : [];
  }
  return (node.children ?? []).flatMap((childId) => collectDescendantFilePaths(treeData, String(childId)));
};

type SidebarGroupTreeProps = {
  groupTree: GroupTree;
  showCheckboxes: boolean;
  currentFilePath?: string;
  selectedFilePaths: Set<string>;
  onFileSelect: (file: UpdatedFile) => void;
  onToggleFileSelection: (filePath: string, selected: boolean) => void;
  onToggleFolderSelection: (filePaths: string[], selected: boolean) => void;
};

export const SidebarGroupTree = ({
  groupTree,
  showCheckboxes,
  currentFilePath,
  selectedFilePaths,
  onFileSelect,
  onToggleFileSelection,
  onToggleFolderSelection,
}: SidebarGroupTreeProps) => {
  const { t } = useTranslation();
  const { treeData, files } = groupTree;
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const selectedItemRef = useRef<HTMLDivElement>(null);

  const allFolderIds = useMemo(() => Object.keys(treeData).filter((key) => treeData[key].isFolder), [treeData]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- merge auto-expanded folders into external state
    setExpandedItems((prev) => Array.from(new Set([...prev, ...allFolderIds])));
  }, [allFolderIds]);

  useEffect(() => {
    if (currentFilePath && selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [currentFilePath]);

  const isCurrentFile = useCallback(
    (item: TreeItem) => (currentFilePath && item.file ? normalizePath(item.file.path) === normalizePath(currentFilePath) : false),
    [currentFilePath],
  );

  const tree = useTree<TreeItem>({
    rootItemId: 'root',
    getItemName: (item) => item.getItemData().data,
    isItemFolder: (item) => item.getItemData().isFolder === true,
    dataLoader: {
      getItem: (itemId) => treeData[String(itemId)],
      getChildren: (itemId) => treeData[String(itemId)]?.children?.map(String) ?? [],
    },
    state: {
      expandedItems,
    },
    setExpandedItems,
    features: [syncDataLoaderFeature, hotkeysCoreFeature, propMemoizationFeature],
  });

  useEffect(() => {
    tree.rebuildTree();
  }, [treeData, tree]);

  const renderRow = (item: ItemInstance<TreeItem>) => {
    const payload = item.getItemData();
    const isFolder = payload.isFolder === true;
    const isExpanded = item.isExpanded();
    const level = item.getItemMeta().level;
    const selected = isCurrentFile(payload);

    const matchedFile = !isFolder && payload.file ? files.find((f) => normalizePath(f.path) === normalizePath(payload.file!.path)) : undefined;

    const filePath = !isFolder && payload.file ? payload.file.path : undefined;
    const descendantPaths = isFolder ? collectDescendantFilePaths(treeData, payload.index as string) : [];
    const fileSelected = filePath !== undefined && selectedFilePaths.has(filePath);
    const selectedDescendantsCount = descendantPaths.filter((p) => selectedFilePaths.has(p)).length;
    const checkboxState: TriState = isFolder
      ? selectedDescendantsCount === 0
        ? 'unchecked'
        : selectedDescendantsCount === descendantPaths.length
          ? 'checked'
          : 'indeterminate'
      : fileSelected
        ? 'checked'
        : 'unchecked';

    const handleClick = () => {
      if (isFolder) {
        if (isExpanded) {
          item.collapse();
        } else {
          item.expand();
        }
      } else if (payload.file) {
        const file = files.find((f) => normalizePath(f.path) === normalizePath(payload.file!.path));
        if (file) {
          onFileSelect(file);
        }
      }
    };

    const handleToggleSelection = () => {
      if (isFolder) {
        onToggleFolderSelection(descendantPaths, checkboxState !== 'checked');
      } else if (filePath) {
        onToggleFileSelection(filePath, !fileSelected);
      }
    };

    const handleChevronClick = (e: MouseEvent<HTMLSpanElement>) => {
      e.stopPropagation();
      e.preventDefault();
      if (isExpanded) {
        item.collapse();
      } else {
        item.expand();
      }
    };

    return (
      <div
        ref={selected ? selectedItemRef : undefined}
        className="flex items-center w-full pr-1 h-6 cursor-pointer"
        style={{ paddingLeft: `${level * INDENT_PX}px` }}
        onClick={handleClick}
        data-testid="diff-sidebar-tree-row"
      >
        {showCheckboxes && <TriStateCheckbox state={checkboxState} onChange={handleToggleSelection} className="shrink-0 mr-0.5" />}
        {isFolder ? (
          <span className="flex items-center justify-center cursor-pointer flex-shrink-0" onClick={handleChevronClick}>
            {isExpanded ? <HiChevronDown className="w-3 h-3 text-text-muted-dark" /> : <HiChevronRight className="w-3 h-3 text-text-muted-dark" />}
          </span>
        ) : (
          <span className="w-2.5 h-2.5 inline-block flex-shrink-0" />
        )}
        <span
          className={clsx(
            'select-none text-2xs overflow-hidden whitespace-nowrap overflow-ellipsis ml-0.5 flex-grow min-w-0',
            !isFolder && 'hover:text-text-tertiary',
            isFolder ? 'text-text-muted' : selected ? 'text-text-primary font-medium' : 'text-text-muted',
          )}
        >
          {payload.data}
        </span>
        {!isFolder && matchedFile && (matchedFile.additions > 0 || matchedFile.deletions > 0) && (
          <span className="text-4xs text-text-muted-dark flex-shrink-0 flex items-center gap-0.5 ml-auto pl-2">
            {matchedFile.additions > 0 && <span className="text-success">+{matchedFile.additions}</span>}
            {matchedFile.deletions > 0 && <span className="text-error">-{matchedFile.deletions}</span>}
          </span>
        )}
        {!isFolder && matchedFile?.hasConflicts && (
          <Tooltip content={t('contextFiles.fileHasConflicts')}>
            <RiAlertLine className="w-3.5 h-3.5 text-warning flex-shrink-0 ml-1" />
          </Tooltip>
        )}
      </div>
    );
  };

  return (
    <div className="pl-1 py-1" {...tree.getContainerProps()}>
      {tree.getItems().map((item) => (
        <div key={item.getId()}>{renderRow(item)}</div>
      ))}
    </div>
  );
};
