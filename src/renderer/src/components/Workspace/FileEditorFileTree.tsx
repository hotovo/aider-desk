import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { hotkeysCoreFeature, propMemoizationFeature, syncDataLoaderFeature } from '@headless-tree/core';
import { useTree } from '@headless-tree/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { HiChevronDown, HiChevronRight } from 'react-icons/hi';
import { VscFile } from 'react-icons/vsc';
import { clsx } from 'clsx';

import { INDENT_PX, createFileTree, normalizePath } from './types';

import type { TreeItem } from './types';
import type { ContextFile } from '@common/types';
import type { Virtualizer } from '@tanstack/react-virtual';

const ROW_HEIGHT = 24;

type Props = {
  allFiles: string[];
  activeFilePath: string | null;
  openFilePaths: Set<string>;
  onOpenFile: (path: string) => void;
};

const getAncestorIds = (path: string): string[] => {
  const parts = normalizePath(path).split('/');
  const ancestors: string[] = [];
  for (let index = 1; index < parts.length; index++) {
    ancestors.push(parts.slice(0, index).join('/'));
  }
  return ancestors;
};

export const FileEditorFileTree = ({ allFiles, activeFilePath, openFilePaths, onOpenFile }: Props) => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const virtualizerRef = useRef<Virtualizer<HTMLDivElement, Element> | null>(null);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const treeData = useMemo(() => {
    const files: ContextFile[] = [...allFiles].sort((a, b) => a.localeCompare(b)).map((path) => ({ path }));
    return createFileTree(files, 'root');
  }, [allFiles]);

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

  // useVirtualizer returns a stateful instance with methods, which React Compiler cannot memoize.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: visibleItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });
  virtualizerRef.current = virtualizer;

  useEffect(() => {
    if (!activeFilePath) {
      return;
    }
    const ancestors = getAncestorIds(activeFilePath);
    if (ancestors.length === 0) {
      return;
    }
    setExpandedItems((prev) => {
      const missing = ancestors.filter((id) => !prev.includes(id));
      return missing.length === 0 ? prev : [...prev, ...missing];
    });
  }, [activeFilePath]);

  useEffect(() => {
    if (!activeFilePath) {
      return;
    }
    const normalized = normalizePath(activeFilePath);
    const index = visibleItems.findIndex((item) => String(item.getId()) === normalized);
    if (index >= 0) {
      virtualizer.scrollToIndex(index, { align: 'auto' });
    }
  }, [activeFilePath, expandedItems, visibleItems, virtualizer]);

  const handleToggleFolder = useCallback(
    (itemId: string) => {
      const instance = tree.getItemInstance(itemId);
      if (instance.isExpanded()) {
        instance.collapse();
      } else {
        instance.expand();
      }
    },
    [tree],
  );

  const containerProps = tree.getContainerProps();

  if (allFiles.length === 0) {
    return <div className="flex-1 flex items-center justify-center p-4 text-2xs text-text-muted text-center">{t('fileEditor.noProjectFiles')}</div>;
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-bg-tertiary scrollbar-track-bg-primary-light scrollbar-rounded py-1"
    >
      <div {...containerProps} style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const item = visibleItems[virtualItem.index];
          if (!item) {
            return null;
          }
          const itemData = item.getItemData();
          const itemId = String(item.getId());
          const isFolder = itemData.isFolder === true;
          const filePath = itemData.file?.path;
          const isActive = !isFolder && !!filePath && normalizePath(filePath) === normalizePath(activeFilePath ?? '');
          const isOpen = !isFolder && !!filePath && openFilePaths.has(filePath);
          const level = item.getItemMeta().level;
          const itemInstanceProps = item.getProps();

          const handleClick = (event: MouseEvent<HTMLDivElement>) => {
            event.preventDefault();
            if (isFolder) {
              handleToggleFolder(itemId);
            } else if (filePath) {
              onOpenFile(filePath);
            }
          };

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
                height: ROW_HEIGHT,
              }}
              data-testid="file-editor-tree-row"
            >
              <div
                onClick={handleClick}
                title={filePath ?? itemData.data}
                className={clsx(
                  'flex items-center gap-1 h-6 pr-2 cursor-pointer select-none text-2xs overflow-hidden',
                  isActive
                    ? 'bg-bg-tertiary text-text-primary'
                    : isOpen
                      ? 'text-text-secondary hover:bg-bg-tertiary-emphasis'
                      : 'text-text-muted hover:bg-bg-tertiary-emphasis',
                )}
                style={{ paddingLeft: `${level * INDENT_PX + 4}px` }}
              >
                {isFolder ? (
                  <span className="flex items-center justify-center w-3 h-3 flex-shrink-0">
                    {item.isExpanded() ? (
                      <HiChevronDown className="w-3 h-3 text-text-muted-dark" />
                    ) : (
                      <HiChevronRight className="w-3 h-3 text-text-muted-dark" />
                    )}
                  </span>
                ) : (
                  <VscFile className="w-3 h-3 flex-shrink-0 text-text-muted-dark" />
                )}
                <span className="truncate">{itemData.data}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
