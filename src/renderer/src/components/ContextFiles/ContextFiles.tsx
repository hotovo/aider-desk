import { ContextFile, ContextFilesUpdatedData, OS } from '@common/types';
import React, { useEffect, useMemo, useState } from 'react';
import objectHash from 'object-hash';
import { ControlledTreeEnvironment, Tree } from 'react-complex-tree';
import { HiChevronDown, HiChevronRight, HiPlus, HiX, HiOutlineTrash } from 'react-icons/hi';
import { BiCollapseVertical, BiExpandVertical } from 'react-icons/bi';
import { LuFolderTree } from 'react-icons/lu';
import { TbPencilOff } from 'react-icons/tb';
import { useTranslation } from 'react-i18next';

import { StyledTooltip } from '../common/StyledTooltip';

import { useOS } from '@/hooks/useOS';

import './ContextFiles.css';

interface TreeItem {
  index: string;
  isFolder: boolean;
  children: string[];
  data: string;
  file?: ContextFile;
}

const createFileTree = (files: ContextFile[]) => {
  const tree: Record<string, TreeItem> = {
    root: { index: 'root', children: [], isFolder: true, data: 'root' },
  };

  files.forEach((file) => {
    const pathParts = file.path.split(/[\\/]/);

    let currentNode = tree.root;
    pathParts.forEach((part, partIndex) => {
      const isLastPart = partIndex === pathParts.length - 1;
      const nodeId = pathParts.slice(0, partIndex + 1).join('/');

      if (!tree[nodeId]) {
        tree[nodeId] = {
          index: nodeId,
          children: [],
          data: part,
          isFolder: !isLastPart,
          file: isLastPart ? file : undefined,
        };
        if (!currentNode.children) {
          currentNode.children = [];
        }
        currentNode.children.push(nodeId);
      }

      if (isLastPart) {
        tree[nodeId].data = part;
        tree[nodeId].isFolder = false;
      }

      currentNode = tree[nodeId];
    });
  });

  // Sort children: folders first, then files, both alphabetically
  Object.values(tree).forEach((node) => {
    if (node.children && node.children.length > 0) {
      node.children.sort((aId, bId) => {
        const a = tree[aId];
        const b = tree[bId];
        if (a.isFolder && !b.isFolder) {
          return -1;
        }
        if (!a.isFolder && b.isFolder) {
          return 1;
        }
        return a.data.localeCompare(b.data);
      });
    }
  });

  return tree;
};

type Props = {
  baseDir: string;
  allFiles: string[];
  showFileDialog: () => void;
};

export const ContextFiles = ({ baseDir, allFiles, showFileDialog }: Props) => {
  const [files, setFiles] = useState<ContextFile[]>([]);
  const [newlyAddedFiles, setNewlyAddedFiles] = useState<string[]>([]);
  const [showAllFiles, setShowAllFiles] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const { t } = useTranslation();
  const os = useOS();

  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => a.path.localeCompare(b.path));
  }, [files]);

  const sortedAllFiles = useMemo(() => {
    return [...allFiles].sort((a, b) => a.localeCompare(b));
  }, [allFiles]);

  useEffect(() => {
    const listenerId = window.api.addContextFilesUpdatedListener(baseDir, (_, { files: updatedFiles }: ContextFilesUpdatedData) => {
      setFiles(updatedFiles);

      // Handle highlighting of new files
      const newFiles = updatedFiles.filter((file) => !files.some((f) => f.path === file.path));
      if (newFiles.length > 0) {
        setNewlyAddedFiles((prev) => [...prev, ...newFiles.map((f) => f.path)]);
        setTimeout(() => {
          setNewlyAddedFiles((prev) => prev.filter((path) => !newFiles.some((f) => f.path === path)));
        }, 2000);
      }
    });

    return () => {
      window.api.removeContextFilesUpdatedListener(listenerId);
    };
  }, [baseDir, files]);

  const treeKey = useMemo(() => {
    if (showAllFiles) {
      return objectHash(sortedAllFiles);
    } else {
      return objectHash(sortedFiles.map((file) => file.path));
    }
  }, [showAllFiles, sortedFiles, sortedAllFiles]);

  const treeData = useMemo(() => {
    if (showAllFiles) {
      const allFileObjects: ContextFile[] = sortedAllFiles.map((path) => ({
        path,
        readOnly: sortedFiles.find((file) => file.path === path)?.readOnly,
      }));
      return createFileTree(allFileObjects);
    } else {
      return createFileTree(sortedFiles);
    }
  }, [showAllFiles, sortedFiles, sortedAllFiles]);

  useEffect(() => {
    const foldersToExpand = Object.keys(treeData).filter((key) => {
      const node = treeData[key];
      if (!node.isFolder) {
        return false;
      }

      const checkChild = (childKey: string) => {
        const childNode = treeData[childKey];
        if (!childNode) {
          return false;
        }
        if (!childNode.isFolder) {
          return files.some((f) => f.path === childNode.file?.path);
        }
        return childNode.children.some(checkChild);
      };

      // Check if any descendant file of this folder is in the context files list
      return node.children.some(checkChild);
    });

    setExpandedItems((expandedItems) => {
      return Array.from(new Set([...expandedItems, ...foldersToExpand]));
    });
  }, [treeData, files]);

  const handleExpandAll = () => {
    setExpandedItems(Object.keys(treeData));
  };

  const handleCollapseAll = () => {
    setExpandedItems(['root']);
  };

  const handleDropAllFiles = () => {
    window.api.runCommand(baseDir, 'drop');
  };

  const dropFile = (item: TreeItem) => (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const file = (item as TreeItem).file;
    if (file) {
      window.api.dropFile(baseDir, file.path);
    } else if (item.isFolder) {
      window.api.dropFile(baseDir, item.index as string);
    }
  };

  const addFile = (item: TreeItem) => (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const shouldBeReadOnly = event.ctrlKey || event.metaKey;
    const pathToAdd = item.file ? item.file.path : item.index;

    if (shouldBeReadOnly) {
      window.api.addFile(baseDir, pathToAdd, true);
    } else {
      window.api.addFile(baseDir, pathToAdd);
    }

    if (item.isFolder) {
      setExpandedItems((prev) => (prev.includes(item.index) ? prev : [...prev, item.index]));
    }
  };

  return (
    <div className="context-files-root flex-grow w-full h-full flex flex-col pb-2 overflow-hidden">
      <StyledTooltip id="context-files-tooltip" />
      <div className="flex items-center mb-2 flex-shrink-0 p-2">
        <h3 className="text-md font-semibold uppercase pl-1 flex-grow">{t('contextFiles.title')}</h3>
        <button
          onClick={handleDropAllFiles}
          className="p-1.5 hover:bg-neutral-700 rounded-md disabled:text-neutral-600 disabled:hover:bg-transparent"
          data-tooltip-id="context-files-tooltip"
          data-tooltip-content={t('contextFiles.dropAll')}
          data-tooltip-delay-show={500}
          disabled={files.length === 0}
        >
          <HiOutlineTrash className="w-4 h-4" />
        </button>
        {showAllFiles && (
          <>
            <button
              onClick={handleExpandAll}
              className="p-1.5 hover:bg-neutral-700 rounded-md"
              data-tooltip-id="context-files-tooltip"
              data-tooltip-content={t('contextFiles.expandAll') || 'Expand all'}
              data-tooltip-delay-show={500}
            >
              <BiExpandVertical className="w-4 h-4" />
            </button>
            <button
              onClick={handleCollapseAll}
              className="p-1.5 hover:bg-neutral-700 rounded-md"
              data-tooltip-id="context-files-tooltip"
              data-tooltip-content={t('contextFiles.collapseAll') || 'Collapse all'}
              data-tooltip-delay-show={500}
            >
              <BiCollapseVertical className="w-4 h-4" />
            </button>
          </>
        )}
        <button
          onClick={() => setShowAllFiles(!showAllFiles)}
          className="p-1.5 hover:bg-neutral-700 rounded-md group"
          data-tooltip-id="context-files-tooltip"
          data-tooltip-content={showAllFiles ? t('contextFiles.hideAllFiles') : t('contextFiles.showAllFiles')}
          data-tooltip-delay-show={500}
        >
          <LuFolderTree className={`w-4 h-4 ${showAllFiles ? 'text-neutral-100' : 'text-neutral-700 group-hover:text-neutral-500'}`} />
        </button>
        <button
          onClick={showFileDialog}
          className="p-1 hover:bg-neutral-700 rounded-md"
          data-tooltip-id="context-files-tooltip"
          data-tooltip-content={t('contextFiles.add')}
          data-tooltip-delay-show={500}
        >
          <HiPlus className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-grow w-full overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-900 scrollbar-rounded px-1">
        <ControlledTreeEnvironment
          key={treeKey}
          items={treeData}
          getItemTitle={(item) => item.data}
          renderItemTitle={({ title, item }) => {
            const treeItem = item as TreeItem;
            const filePath = treeItem.file?.path;
            const isNewlyAdded = filePath && newlyAddedFiles.includes(filePath);
            const isContextFile = filePath ? files.some((f) => f.path === filePath) : false;
            const dimmed = showAllFiles && filePath && !isContextFile;

            return (
              <div className={`px-1 ${isNewlyAdded ? 'flash-highlight' : ''} flex items-center gap-1 h-6 whitespace-nowrap`}>
                <span className={dimmed ? 'context-dimmed' : undefined}>{title}</span>
              </div>
            );
          }}
          renderItemArrow={() => null}
          viewState={{
            ['contextFiles']: {
              expandedItems,
            },
          }}
          onExpandItem={(item) => setExpandedItems([...expandedItems, item.index as string])}
          onCollapseItem={(item) => setExpandedItems(expandedItems.filter((expandedItemIndex) => expandedItemIndex !== item.index))}
          renderItem={({ item, title, children, context }) => (
            <>
              <div className="flex space-between items-center w-full pr-1 h-6">
                <div className="flex items-center flex-grow min-w-0">
                  {item.isFolder ? (
                    <span className="flex items-center justify-center" {...context.arrowProps}>
                      {context.isExpanded ? <HiChevronDown className="w-3 h-3 text-neutral-600" /> : <HiChevronRight className="w-3 h-3 text-neutral-600" />}
                    </span>
                  ) : (
                    <span className="w-3 h-3 inline-block" />
                  )}
                  <span
                    className={`select-none text-xxs overflow-hidden ${item.isFolder ? 'context-dimmed' : 'text-neutral-100 font-semibold'}`}
                    {...(item.isFolder ? { onClick: context.arrowProps.onClick } : {})}
                  >
                    {title}
                  </span>
                </div>
                {item.isFolder ? (
                  <>
                    {showAllFiles ? (
                      <>
                        <button onClick={dropFile(item as TreeItem)} className="px-1 py-1 rounded hover:bg-neutral-900 text-neutral-500 hover:text-red-800">
                          <HiX className="w-4 h-4" />
                        </button>
                        <button
                          onClick={addFile(item as TreeItem)}
                          className="px-1 py-1 rounded hover:bg-neutral-900 text-neutral-500 hover:text-neutral-100"
                          data-tooltip-id="context-files-tooltip"
                          data-tooltip-content={os === OS.MacOS ? t('contextFiles.addFileTooltip.cmd') : t('contextFiles.addFileTooltip.ctrl')}
                        >
                          <HiPlus className="w-4 h-4" />
                        </button>
                      </>
                    ) : null}
                  </>
                ) : (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {(item as TreeItem).file?.readOnly && (
                      <TbPencilOff
                        className="w-4 h-4 text-neutral-400"
                        data-tooltip-id="context-files-tooltip"
                        data-tooltip-content={t('contextFiles.readOnly')}
                      />
                    )}
                    {showAllFiles ? (
                      files.some((f) => f.path === (item as TreeItem).file?.path) ? (
                        <button onClick={dropFile(item as TreeItem)} className="px-1 py-1 rounded hover:bg-neutral-900 text-neutral-500 hover:text-red-800">
                          <HiX className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={addFile(item as TreeItem)}
                          className="px-1 py-1 rounded hover:bg-neutral-900 text-neutral-500 hover:text-neutral-100"
                          data-tooltip-id="context-files-tooltip"
                          data-tooltip-content={os === OS.MacOS ? t('contextFiles.addFileTooltip.cmd') : t('contextFiles.addFileTooltip.ctrl')}
                        >
                          <HiPlus className="w-4 h-4" />
                        </button>
                      )
                    ) : (
                      <button onClick={dropFile(item as TreeItem)} className="px-1 py-1 rounded hover:bg-neutral-900 text-neutral-500 hover:text-red-800">
                        <HiX className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              {children}
            </>
          )}
          canDragAndDrop={false}
          canDropOnFolder={false}
          canReorderItems={false}
        >
          <Tree treeId="contextFiles" rootItem="root" />
        </ControlledTreeEnvironment>
      </div>
    </div>
  );
};
