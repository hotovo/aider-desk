import { ContextFile, ContextFilesUpdatedData, OS, TokensInfoData } from '@common/types';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import objectHash from 'object-hash';
import { ControlledTreeEnvironment, Tree } from 'react-complex-tree';
import { HiChevronDown, HiChevronRight, HiOutlineTrash, HiPlus, HiX } from 'react-icons/hi';
import { BiCollapseVertical, BiExpandVertical } from 'react-icons/bi';
import { LuFolderTree } from 'react-icons/lu';
import { TbPencilOff } from 'react-icons/tb';
import { useTranslation } from 'react-i18next';

import { StyledTooltip } from '../common/StyledTooltip';

import { useOS } from '@/hooks/useOS';
import { useApi } from '@/context/ApiContext';

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
  tokensInfo?: TokensInfoData | null;
};

export const ContextFiles = ({ baseDir, allFiles, showFileDialog, tokensInfo }: Props) => {
  const [files, setFiles] = useState<ContextFile[]>([]);
  const [newlyAddedFiles, setNewlyAddedFiles] = useState<string[]>([]);
  const [showAllFiles, setShowAllFiles] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const { t } = useTranslation();
  const os = useOS();
  const api = useApi();

  const handleFileDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);

      if (event.dataTransfer?.files) {
        const files = Array.from(event.dataTransfer.files);
        const droppedFilePaths = files.map((file) => api.getPathForFile(file));
        for (let filePath of droppedFilePaths) {
          const isValid = await api.isValidPath(baseDir, filePath);
          if (!isValid) {
            continue;
          }

          const isInsideProject = filePath.startsWith(baseDir + '/') || filePath === baseDir;
          if (isInsideProject) {
            filePath = filePath.slice(baseDir.length + 1);
          }
          api.addFile(baseDir, filePath, !isInsideProject);
        }
      }
    },
    [baseDir, api],
  );

  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => a.path.localeCompare(b.path));
  }, [files]);

  const sortedAllFiles = useMemo(() => {
    return [...allFiles].sort((a, b) => a.localeCompare(b));
  }, [allFiles]);

  useEffect(() => {
    const removeListener = api.addContextFilesUpdatedListener(baseDir, ({ files: updatedFiles }: ContextFilesUpdatedData) => {
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
      removeListener();
    };
  }, [baseDir, files, api]);

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
    api.runCommand(baseDir, 'drop');
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const dropFile = (item: TreeItem) => (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const file = (item as TreeItem).file;
    if (file) {
      let pathToDrop = file.path;
      if (pathToDrop.startsWith(baseDir + '/') || pathToDrop === baseDir) {
        pathToDrop = pathToDrop.slice(baseDir.length + 1);
      }
      api.dropFile(baseDir, pathToDrop);
    } else if (item.isFolder) {
      api.dropFile(baseDir, item.index as string);
    }
  };

  const addFile = (item: TreeItem) => (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const shouldBeReadOnly = event.ctrlKey || event.metaKey;
    const pathToAdd = item.file ? item.file.path : item.index;

    if (shouldBeReadOnly) {
      api.addFile(baseDir, pathToAdd, true);
    } else {
      api.addFile(baseDir, pathToAdd);
    }

    if (item.isFolder) {
      setExpandedItems((prev) => (prev.includes(item.index) ? prev : [...prev, item.index]));
    }
  };

  return (
    <div
      className={`context-files-root flex-grow w-full h-full flex flex-col pb-2 overflow-hidden ${isDragging ? 'drag-over' : ''}`}
      onDrop={handleFileDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <StyledTooltip id="context-files-tooltip" />
      <div className="flex items-center mb-2 flex-shrink-0 p-2">
        <h3 className="text-md font-semibold uppercase pl-1 flex-grow">{t('contextFiles.title')}</h3>
        <button
          onClick={handleDropAllFiles}
          className="p-1.5 hover:bg-bg-tertiary rounded-md disabled:text-text-muted-dark disabled:hover:bg-transparent"
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
              className="p-1.5 hover:bg-bg-tertiary rounded-md"
              data-tooltip-id="context-files-tooltip"
              data-tooltip-content={t('contextFiles.expandAll') || 'Expand all'}
              data-tooltip-delay-show={500}
            >
              <BiExpandVertical className="w-4 h-4" />
            </button>
            <button
              onClick={handleCollapseAll}
              className="p-1.5 hover:bg-bg-tertiary rounded-md"
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
          className="p-1.5 hover:bg-bg-tertiary rounded-md group"
          data-tooltip-id="context-files-tooltip"
          data-tooltip-content={showAllFiles ? t('contextFiles.hideAllFiles') : t('contextFiles.showAllFiles')}
          data-tooltip-delay-show={500}
        >
          <LuFolderTree className={`w-4 h-4 ${showAllFiles ? 'text-text-primary' : 'text-text-dark group-hover:text-text-muted'}`} />
        </button>
        <button
          onClick={showFileDialog}
          className="p-1 hover:bg-bg-tertiary rounded-md"
          data-tooltip-id="context-files-tooltip"
          data-tooltip-content={t('contextFiles.add')}
          data-tooltip-delay-show={500}
        >
          <HiPlus className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-grow w-full overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-bg-tertiary scrollbar-track-bg-primary-light scrollbar-rounded px-1">
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
                      {context.isExpanded ? (
                        <HiChevronDown className="w-3 h-3 text-text-muted-dark" />
                      ) : (
                        <HiChevronRight className="w-3 h-3 text-text-muted-dark" />
                      )}
                    </span>
                  ) : (
                    <span className="w-3 h-3 inline-block" />
                  )}
                  <span
                    className={`select-none text-2xs overflow-hidden ${item.isFolder ? 'context-dimmed' : 'text-text-primary font-semibold'}`}
                    {...(item.isFolder ? { onClick: context.arrowProps.onClick } : {})}
                    data-tooltip-id="context-files-tooltip"
                    data-tooltip-content={(() => {
                      if (!tokensInfo?.files || item.isFolder) {
                        return '';
                      }
                      const fileTokenInfo = tokensInfo.files[item.index as string];
                      if (!fileTokenInfo) {
                        return '';
                      }
                      return `${t('usageDashboard.charts.tokens')}: ${fileTokenInfo.tokens || 0}, ${t('usageDashboard.charts.cost')}: $${(fileTokenInfo.cost || 0).toFixed(5)}`;
                    })()}
                  >
                    {title}
                  </span>
                </div>
                {item.isFolder ? (
                  <>
                    {showAllFiles ? (
                      <>
                        <button
                          onClick={dropFile(item as TreeItem)}
                          className="px-1 py-1 rounded hover:bg-bg-primary-light text-text-muted hover:text-error-dark"
                        >
                          <HiX className="w-4 h-4" />
                        </button>
                        <button
                          onClick={addFile(item as TreeItem)}
                          className="px-1 py-1 rounded hover:bg-bg-primary-light text-text-muted hover:text-text-primary"
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
                        className="w-4 h-4 text-text-muted-light"
                        data-tooltip-id="context-files-tooltip"
                        data-tooltip-content={t('contextFiles.readOnly')}
                      />
                    )}
                    {showAllFiles ? (
                      files.some((f) => f.path === (item as TreeItem).file?.path) ? (
                        <button
                          onClick={dropFile(item as TreeItem)}
                          className="px-1 py-1 rounded hover:bg-bg-primary-light text-text-muted hover:text-error-dark"
                        >
                          <HiX className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={addFile(item as TreeItem)}
                          className="px-1 py-1 rounded hover:bg-bg-primary-light text-text-muted hover:text-text-primary"
                          data-tooltip-id="context-files-tooltip"
                          data-tooltip-content={os === OS.MacOS ? t('contextFiles.addFileTooltip.cmd') : t('contextFiles.addFileTooltip.ctrl')}
                        >
                          <HiPlus className="w-4 h-4" />
                        </button>
                      )
                    ) : (
                      <button
                        onClick={dropFile(item as TreeItem)}
                        className="px-1 py-1 rounded hover:bg-bg-primary-light text-text-muted hover:text-error-dark"
                      >
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
