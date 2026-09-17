import { ContextFile, OS, TokensCost, UpdatedFile } from '@common/types';
import { Dispatch, MouseEvent, RefObject, SetStateAction, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTree } from '@headless-tree/react';
import { hotkeysCoreFeature, propMemoizationFeature, syncDataLoaderFeature } from '@headless-tree/core';
import { useVirtualizer } from '@tanstack/react-virtual';

import { MemoizedTreeItemRenderer } from './TreeItemRenderer';

import type { Virtualizer } from '@tanstack/react-virtual';
import type { SectionType, TreeItem } from './types';

export const TREE_ROW_HEIGHT = 24;

type SharedRowProps = {
  section: SectionType;
  treeData: Record<string, TreeItem>;
  contextFilesMap: Map<string, ContextFile>;
  updatedFiles: UpdatedFile[];
  fileTokensInfo?: Record<string, TokensCost> | null;
  os: OS | null;
  disabledRuleFiles?: string[];
  onToggleRuleFile?: (filePaths: string[], disabled: boolean) => void;
  onFileDiffClick: (file: UpdatedFile) => void;
  onFilePreviewClick?: (filePath: string) => void;
  onAddFileToGit?: (filePath: string) => void;
  addingFilesToGit?: Set<string>;
  onRevertFile: (filePath: string) => void;
  onDropFile: (item: TreeItem) => (e: MouseEvent<HTMLButtonElement>) => void;
  onAddFile: (item: TreeItem) => (event: MouseEvent<HTMLButtonElement>) => void;
};

type TreeProps = SharedRowProps & {
  expandedItems: string[];
  setExpandedItems: Dispatch<SetStateAction<string[]>>;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
};

export const Tree = ({ expandedItems, setExpandedItems, scrollContainerRef, treeData, ...shared }: TreeProps) => {
  const innerScrollRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const virtualizerRef = useRef<Virtualizer<HTMLDivElement, Element> | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  const tree = useTree<TreeItem>({
    rootItemId: 'root',
    getItemName: (item) => item.getItemData().data,
    isItemFolder: (item) => item.getItemData().isFolder === true,
    dataLoader: {
      getItem: (itemId) => treeData[String(itemId)] ?? { index: itemId, isFolder: false, data: String(itemId), children: [] },
      getChildren: (itemId) => (treeData[String(itemId)]?.children ?? []).filter((childId) => treeData[childId]).map(String),
    },
    state: {
      expandedItems,
    },
    setExpandedItems: setExpandedItems as (updater: string[] | ((old: string[]) => string[])) => void,
    scrollToItem: (item) => {
      virtualizerRef.current?.scrollToIndex(item.getItemMeta().index);
    },
    features: [syncDataLoaderFeature, hotkeysCoreFeature, propMemoizationFeature],
  });

  useEffect(() => {
    tree.rebuildTree();
  }, [treeData, tree]);

  const visibleItems = tree.getItems();

  useLayoutEffect(() => {
    if (!scrollContainerRef) {
      return;
    }
    const scrollEl = scrollContainerRef.current;
    const listEl = listRef.current;
    if (!scrollEl || !listEl) {
      return;
    }
    const margin = listEl.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top + scrollEl.scrollTop;
    setScrollMargin((prev) => (Math.abs(prev - margin) < 0.5 ? prev : margin));
  }, [scrollContainerRef]);

  // useVirtualizer returns a stateful instance with methods, which React Compiler cannot memoize;
  // Tree is skipped by the compiler, rows are already memoized via MemoizedTreeItemRenderer.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: visibleItems.length,
    getScrollElement: () => scrollContainerRef?.current ?? (innerScrollRef.current as HTMLDivElement | null),
    estimateSize: () => TREE_ROW_HEIGHT,
    overscan: 8,
    scrollMargin,
  });
  virtualizerRef.current = virtualizer;

  const handleToggleFolder = useCallback(
    (itemId: string | number) => {
      const instance = tree.getItemInstance(String(itemId));
      if (instance.isExpanded()) {
        instance.collapse();
      } else {
        instance.expand();
      }
    },
    [tree],
  );

  const containerProps = tree.getContainerProps();

  return (
    <div
      ref={innerScrollRef}
      className="flex-grow w-full overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-bg-tertiary scrollbar-track-bg-primary-light scrollbar-rounded pl-1 py-1 bg-bg-primary-light-strong relative"
    >
      <div ref={listRef} {...containerProps} style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const item = visibleItems[virtualItem.index];
          if (!item) {
            return null;
          }
          const itemInstanceProps = item.getProps();
          return (
            <div
              key={item.getId()}
              {...itemInstanceProps}
              ref={(el) => {
                itemInstanceProps.ref?.(el);
              }}
              style={{
                position: 'absolute',
                top: virtualItem.start,
                left: 0,
                width: '100%',
                height: TREE_ROW_HEIGHT,
              }}
              data-testid="workspace-tree-row"
            >
              <MemoizedTreeItemRenderer
                item={item.getItemData()}
                title={item.getItemName()}
                level={item.getItemMeta().level}
                isExpanded={item.isExpanded()}
                onToggleFolder={handleToggleFolder}
                type={shared.section}
                treeData={treeData}
                {...shared}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
