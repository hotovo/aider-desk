import { AIDER_MODES, ContextFile, Mode, OS, TokensInfoData, UpdatedFile } from '@common/types';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import objectHash from 'object-hash';
import { ControlledTreeEnvironment, Tree } from 'react-complex-tree';
import { HiChevronDown, HiChevronRight, HiOutlineTrash, HiPlus, HiX } from 'react-icons/hi';
import { MdOutlineDifference, MdOutlinePublic, MdOutlineRefresh, MdOutlineSearch, MdUndo } from 'react-icons/md';
import { BiCollapseVertical, BiExpandVertical } from 'react-icons/bi';
import { TbPencilOff } from 'react-icons/tb';
import { RiRobot2Line } from 'react-icons/ri';
import { VscFileCode } from 'react-icons/vsc';
import { FaGitSquare } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useDebounce, useLocalStorage } from '@reactuses/core';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { UpdatedFilesDiffModal } from './UpdatedFilesDiffModal';

import { Tooltip } from '@/components/ui/Tooltip';
import { Input } from '@/components/common/Input';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useOS } from '@/hooks/useOS';
import { useApi } from '@/contexts/ApiContext';

import './ContextFiles.css';

interface TreeItem {
  index: string | number;
  isFolder?: boolean;
  children?: (string | number)[];
  data: string;
  file?: ContextFile;
}

const normalizePath = (path: string): string => {
  return path.replace(/\\/g, '/');
};

const createFileTree = (files: ContextFile[], rootId = 'root') => {
  const tree: Record<string, TreeItem> = {
    [rootId]: { index: rootId, children: [], isFolder: true, data: rootId },
  };

  files.forEach((file) => {
    const pathParts = file.path.split(/[\\/]/);

    let currentNode = tree[rootId];
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
        // Ensure file data is updated if it exists
        tree[nodeId].file = file;
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
  taskId: string;
  allFiles: string[];
  contextFiles: ContextFile[];
  showFileDialog: () => void;
  tokensInfo?: TokensInfoData | null;
  refreshAllFiles: (useGit?: boolean) => Promise<void>;
  mode: Mode;
};

type EmptyContextInfoProps = {
  mode: Mode;
};

const EmptyContextInfo = ({ mode }: EmptyContextInfoProps) => {
  const { t } = useTranslation();
  const isAiderMode = AIDER_MODES.includes(mode);

  return (
    <div className="absolute inset-0 flex items-center justify-center p-4">
      <div className="text-center text-text-muted text-2xs max-w-[280px] space-y-2">
        <p className="font-medium text-text-secondary">{t('contextFiles.empty.title')}</p>
        {isAiderMode ? (
          <>
            <p>{t('contextFiles.empty.aiderMode.description')}</p>
            <p className="text-text-tertiary italic">{t('contextFiles.empty.aiderMode.hint')}</p>
          </>
        ) : (
          <>
            <p>{t('contextFiles.empty.agentMode.description')}</p>
            <p className="mt-1">{t('contextFiles.empty.agentMode.includeContextFiles')}</p>
            <p className="text-text-tertiary italic">{t('contextFiles.empty.agentMode.hint')}</p>
          </>
        )}
      </div>
    </div>
  );
};

type SectionType = 'updated' | 'project' | 'context' | 'rules';

export const ContextFiles = ({ baseDir, taskId, allFiles, contextFiles, showFileDialog, tokensInfo, refreshAllFiles, mode }: Props) => {
  const { t } = useTranslation();
  const os = useOS();
  const api = useApi();

  const [activeSection, setActiveSection] = useLocalStorage<SectionType>(`context-files-active-section-${baseDir}`, 'context');

  // Separate expanded items for each tree
  const [projectExpandedItems, setProjectExpandedItems] = useState<string[]>([]);
  const [contextExpandedItems, setContextExpandedItems] = useState<string[]>([]);
  const [rulesExpandedItems, setRulesExpandedItems] = useState<string[]>([]);

  const [isDragging, setIsDragging] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 50);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [useGit, setUseGit] = useLocalStorage(`context-files-use-git-${baseDir}`, true);

  // Updated files state
  const [updatedFiles, setUpdatedFiles] = useState<UpdatedFile[]>([]);
  const [updatedExpandedItems, setUpdatedExpandedItems] = useState<string[]>([]);
  const [isRefreshingUpdated, setIsRefreshingUpdated] = useState(false);
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [diffModalFileIndex, setDiffModalFileIndex] = useState(0);

  const sortedUpdatedFiles = useMemo(() => {
    return [...updatedFiles].sort((a, b) => a.path.localeCompare(b.path));
  }, [updatedFiles]);

  // Calculate total additions and deletions for updated files
  const totalStats = useMemo(() => {
    return updatedFiles.reduce(
      (acc, file) => ({
        additions: acc.additions + file.additions,
        deletions: acc.deletions + file.deletions,
      }),
      { additions: 0, deletions: 0 },
    );
  }, [updatedFiles]);

  // Fetch updated files on mount and when baseDir/taskId changes
  const fetchUpdatedFiles = useCallback(async () => {
    try {
      const files = await api.getUpdatedFiles(baseDir, taskId);
      setUpdatedFiles(files);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch updated files:', error);
    }
  }, [api, baseDir, taskId]);

  useEffect(() => {
    void fetchUpdatedFiles();
  }, [fetchUpdatedFiles]);

  // Listen for updated files updates
  useEffect(() => {
    const unsubscribe = api.addUpdatedFilesUpdatedListener(baseDir, taskId, (data) => {
      setUpdatedFiles(data.files);
    });
    return () => {
      unsubscribe();
    };
  }, [api, baseDir, taskId]);

  const handleRefreshUpdatedFiles = useCallback(async () => {
    setIsRefreshingUpdated(true);
    try {
      await fetchUpdatedFiles();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to refresh updated files:', error);
    } finally {
      setIsRefreshingUpdated(false);
    }
  }, [fetchUpdatedFiles]);

  const handleFileDiffClick = useCallback(
    (file: UpdatedFile) => {
      const index = sortedUpdatedFiles.findIndex((f) => f.path === file.path);
      if (index !== -1) {
        setDiffModalFileIndex(index);
        setDiffModalOpen(true);
      }
    },
    [sortedUpdatedFiles],
  );

  const [fileToRevert, setFileToRevert] = useState<string | null>(null);
  const [isRevertingFile, setIsRevertingFile] = useState(false);

  const handleRevertFile = useCallback((filePath: string) => {
    setFileToRevert(filePath);
  }, []);

  const handleRevertConfirm = useCallback(async () => {
    if (!fileToRevert) {
      return;
    }

    setIsRevertingFile(true);
    try {
      await api.restoreFile(baseDir, taskId, fileToRevert);
      await fetchUpdatedFiles();
      setFileToRevert(null);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to revert file:', error);
    } finally {
      setIsRevertingFile(false);
    }
  }, [api, baseDir, taskId, fileToRevert, fetchUpdatedFiles]);

  const handleRevertCancel = useCallback(() => {
    setFileToRevert(null);
  }, []);

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

          const isInsideProject = filePath.startsWith(baseDir + '/') || filePath.startsWith(baseDir + '\\') || filePath === baseDir;
          if (isInsideProject) {
            filePath = filePath.slice(baseDir.length + 1);
          }
          api.addFile(baseDir, taskId, filePath, !isInsideProject);
        }
      }
    },
    [api, baseDir, taskId],
  );

  const { rulesFiles, userContextFiles } = useMemo(() => {
    const rules: ContextFile[] = [];
    const user: ContextFile[] = [];
    contextFiles.forEach((file) => {
      if (file.source === 'global-rule' || file.source === 'project-rule' || file.source === 'agent-rule') {
        rules.push(file);
      } else {
        user.push(file);
      }
    });
    return { rulesFiles: rules, userContextFiles: user };
  }, [contextFiles]);

  const sortedUserFiles = useMemo(() => {
    return [...userContextFiles].sort((a, b) => a.path.localeCompare(b.path));
  }, [userContextFiles]);

  const sortedRulesFiles = useMemo(() => {
    return [...rulesFiles].sort((a, b) => a.path.localeCompare(b.path));
  }, [rulesFiles]);

  const sortedAllFiles = useMemo(() => {
    return [...allFiles]
      .filter((file) => {
        if (!debouncedSearchQuery.trim()) {
          return true;
        }
        const searchText = debouncedSearchQuery.toLowerCase();
        return file.toLowerCase().includes(searchText);
      })
      .sort((a, b) => a.localeCompare(b));
  }, [allFiles, debouncedSearchQuery]);

  // Tree Data Generators
  const projectTreeData = useMemo(() => {
    const allFileObjects: ContextFile[] = sortedAllFiles.map((path) => ({
      path,
      // Check if readOnly in context files
      readOnly: contextFiles.find((file) => normalizePath(file.path) === normalizePath(path))?.readOnly,
      source: contextFiles.find((file) => normalizePath(file.path) === normalizePath(path))?.source,
    }));
    return createFileTree(allFileObjects, 'root');
  }, [sortedAllFiles, contextFiles]);

  const contextTreeData = useMemo(() => {
    return createFileTree(sortedUserFiles, 'root');
  }, [sortedUserFiles]);

  const rulesTreeData = useMemo(() => {
    return createFileTree(sortedRulesFiles, 'root');
  }, [sortedRulesFiles]);

  const updatedTreeData = useMemo(() => {
    const allFileObjects: ContextFile[] = updatedFiles.map((f) => ({
      path: f.path,
    }));
    return createFileTree(allFileObjects, 'root');
  }, [updatedFiles]);

  // Expand logic for Context Tree (auto-expand folders with files)
  useEffect(() => {
    const expandFolders = (treeData: Record<string, TreeItem>, files: ContextFile[], currentExpanded: string[], setExpanded: (items: string[]) => void) => {
      const foldersToExpand = Object.keys(treeData).filter((key) => {
        const node = treeData[key];
        if (!node.isFolder) {
          return false;
        }

        const checkChild = (childKey: string | number) => {
          const childNode = treeData[String(childKey)];
          if (!childNode) {
            return false;
          }
          if (!childNode.isFolder) {
            return files.some((f) => normalizePath(f.path) === normalizePath(childNode.file?.path || ''));
          }
          return childNode.children?.some(checkChild) || false;
        };
        return node.children?.some(checkChild) || false;
      });

      setExpanded(Array.from(new Set([...currentExpanded, ...foldersToExpand])));
    };

    // Only auto-expand context and rules trees
    expandFolders(contextTreeData, userContextFiles, contextExpandedItems, setContextExpandedItems);
    expandFolders(rulesTreeData, rulesFiles, rulesExpandedItems, setRulesExpandedItems);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextTreeData, rulesTreeData, userContextFiles, rulesFiles]);

  // Expand all folders in updated tree by default
  useEffect(() => {
    if (Object.keys(updatedTreeData).length > 1) {
      const allFolders = Object.keys(updatedTreeData).filter((key) => updatedTreeData[key].isFolder);
      setUpdatedExpandedItems(Array.from(new Set([...updatedExpandedItems, ...allFolders])));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updatedTreeData]);

  const handleDropAllFiles = () => {
    api.runCommand(baseDir, taskId, 'drop');
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleSearchToggle = () => {
    setIsSearchVisible(!isSearchVisible);
    if (isSearchVisible) {
      setSearchQuery('');
    }
  };

  const handleRefreshFiles = async (useGit: boolean) => {
    setIsRefreshing(true);
    try {
      await refreshAllFiles(useGit);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to refresh files:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleUseGit = () => {
    setUseGit(!useGit);
    void handleRefreshFiles(!useGit);
  };

  const handleSearchClose = () => {
    setIsSearchVisible(false);
    setSearchQuery('');
  };

  const dropFile = (item: TreeItem) => (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const file = item.file;
    if (file) {
      let pathToDrop = file.path;
      if (pathToDrop.startsWith(baseDir + '/') || pathToDrop.startsWith(baseDir + '\\') || pathToDrop === baseDir) {
        pathToDrop = pathToDrop.slice(baseDir.length + 1);
      }
      api.dropFile(baseDir, taskId, pathToDrop);
    } else if (item.isFolder) {
      api.dropFile(baseDir, taskId, String(item.index));
    }
  };

  const addFile = (item: TreeItem) => (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const shouldBeReadOnly = event.ctrlKey || event.metaKey;
    const pathToAdd = item.file ? item.file.path : item.index;

    if (shouldBeReadOnly) {
      api.addFile(baseDir, taskId, String(pathToAdd), true);
    } else {
      api.addFile(baseDir, taskId, String(pathToAdd));
    }
  };

  const getFileTokenTooltip = useCallback(
    (item: TreeItem): string => {
      if (!tokensInfo?.files || item.isFolder) {
        return '';
      }
      const fileTokenInfo = tokensInfo.files[item.index];
      if (!fileTokenInfo) {
        return '';
      }
      return `${fileTokenInfo.tokens || 0} ${t('usageDashboard.charts.tokens')}, $${(fileTokenInfo.cost || 0).toFixed(5)}`;
    },
    [tokensInfo, t],
  );

  const renderTreeItem = (
    { item, title, children }: { item: TreeItem; title: React.ReactNode; children: React.ReactNode; context: unknown },
    type: SectionType,
    _treeData: Record<string, TreeItem>,
    expandedItems: string[],
    setExpandedItems: (items: string[]) => void,
  ) => {
    const treeItem = item as TreeItem;
    const source = treeItem.file?.source;
    const isRuleFile = source === 'global-rule' || source === 'project-rule' || source === 'agent-rule';
    const filePath = treeItem.file?.path;
    const isContextFile = filePath ? contextFiles.some((f) => normalizePath(f.path) === normalizePath(filePath)) : false;

    // Get line stats for updated files section
    const updatedFile = type === 'updated' ? updatedFiles.find((f) => normalizePath(f.path) === normalizePath(treeItem.file?.path || '')) : undefined;

    // Actions logic
    const showAdd = type === 'project' && !isContextFile && !isRuleFile;
    const showRemove = (type === 'context' || (type === 'project' && isContextFile)) && !isRuleFile;
    const showRevert = type === 'updated' && updatedFile && !treeItem.isFolder;

    const fileTokenTooltip = getFileTokenTooltip(treeItem);

    // Helper functions
    const toggleFolder = () => {
      const isExpanded = expandedItems.includes(String(treeItem.index));
      if (isExpanded) {
        setExpandedItems(expandedItems.filter((id) => id !== String(treeItem.index)));
      } else {
        setExpandedItems([...expandedItems, String(treeItem.index)]);
      }
    };

    const renderChevron = () => {
      if (!treeItem.isFolder) {
        return <span className="w-3 h-3 inline-block" />;
      }
      return (
        <span className="flex items-center justify-center cursor-pointer" onClick={toggleFolder}>
          {expandedItems.includes(String(treeItem.index)) ? (
            <HiChevronDown className="w-3 h-3 text-text-muted-dark" />
          ) : (
            <HiChevronRight className="w-3 h-3 text-text-muted-dark" />
          )}
        </span>
      );
    };

    const renderTitle = () => {
      const className = twMerge(
        'select-none text-2xs overflow-hidden whitespace-nowrap overflow-ellipsis',
        treeItem.isFolder ? 'context-dimmed' : type === 'project' && !isContextFile ? 'context-dimmed' : 'text-text-primary',
        type === 'updated' && !treeItem.isFolder && 'cursor-pointer hover:text-text-tertiary',
      );

      if (fileTokenTooltip) {
        return (
          <Tooltip content={fileTokenTooltip}>
            <span className={className}>{title}</span>
          </Tooltip>
        );
      }

      // Show line stats for updated files with click handler
      if (updatedFile && !treeItem.isFolder) {
        return (
          <div className="flex items-center gap-2 min-w-0 cursor-pointer hover:text-text-tertiary" onClick={() => handleFileDiffClick(updatedFile)}>
            <span className={className}>{title}</span>
            <span className="text-4xs text-text-muted-dark flex-shrink-0 flex items-center gap-0.5 mt-0.5">
              {updatedFile.additions > 0 && <span className="text-success">+{updatedFile.additions}</span>}
              {updatedFile.deletions > 0 && <span className="text-error">-{updatedFile.deletions}</span>}
            </span>
          </div>
        );
      }

      return <span className={className}>{title}</span>;
    };

    return (
      <>
        <div className="flex space-between items-center w-full pr-1 h-6 group/item">
          <div className="flex items-center flex-grow min-w-0">
            {renderChevron()}
            {renderTitle()}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0 group">
            {isRuleFile && (
              <>
                {source === 'global-rule' && (
                  <Tooltip content={t('contextFiles.globalRule')}>
                    <MdOutlinePublic className="w-4 h-4 text-text-muted-light mr-1" />
                  </Tooltip>
                )}
                {source === 'project-rule' && (
                  <Tooltip content={t('contextFiles.projectRule')}>
                    <VscFileCode className="w-4 h-4 text-text-muted-light mr-1" />
                  </Tooltip>
                )}
                {source === 'agent-rule' && (
                  <Tooltip content={t('contextFiles.agentRule')}>
                    <RiRobot2Line className="w-4 h-4 text-text-muted-light mr-1" />
                  </Tooltip>
                )}
              </>
            )}

            {treeItem.file?.readOnly && !isRuleFile && (
              <Tooltip content={t('contextFiles.readOnly')}>
                <TbPencilOff className="w-4 h-4 text-text-muted-light" />
              </Tooltip>
            )}

            {showRemove && (
              <button onClick={dropFile(treeItem)} className="px-1 py-1 rounded hover:bg-bg-primary-light text-text-muted hover:text-error-dark">
                <HiX className="w-4 h-4" />
              </button>
            )}

            {showAdd && (
              <Tooltip content={os === OS.MacOS ? t('contextFiles.addFileTooltip.cmd') : t('contextFiles.addFileTooltip.ctrl')}>
                <button onClick={addFile(treeItem)} className="px-1 py-1 rounded hover:bg-bg-primary-light text-text-muted hover:text-text-primary">
                  <HiPlus className="w-4 h-4" />
                </button>
              </Tooltip>
            )}

            {showRevert && (
              <Tooltip content={t('contextFiles.revertFile')}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRevertFile(updatedFile.path);
                  }}
                  className="px-1 py-1 rounded hover:bg-bg-primary-light text-text-muted hover:text-text-primary"
                >
                  <MdUndo className="w-4 h-4" />
                </button>
              </Tooltip>
            )}
          </div>
        </div>
        {children}
      </>
    );
  };

  const renderSection = (
    section: SectionType,
    title: string,
    count: number,
    treeData: Record<string, TreeItem>,
    expandedItems: string[],
    setExpandedItems: React.Dispatch<React.SetStateAction<string[]>>,
    actions?: React.ReactNode,
    isFirst?: boolean,
    _isLast?: boolean,
    searchField?: React.ReactNode,
    emptyContent?: React.ReactNode,
  ) => {
    const isOpen = activeSection === section;
    const treeId = `tree-${section}`;

    return (
      <motion.div
        className={clsx('flex flex-col flex-grow overflow-hidden', !isFirst && 'border-t border-border-dark-light')}
        initial={false}
        animate={{
          flexGrow: isOpen ? 1 : 0,
          flexShrink: isOpen ? 1 : 0,
          minHeight: isOpen ? 0 : 40,
        }}
        transition={{
          duration: 0.3,
          ease: 'easeIn',
        }}
      >
        <div
          className={clsx(
            'flex items-center px-2 select-none h-[40px] shrink-0 bg-bg-primary-light',
            !isOpen && 'cursor-pointer',
            isOpen && !searchField && 'border-b border-border-dark-light',
          )}
          onClick={() => setActiveSection(section)}
        >
          <motion.div initial={false} animate={{ rotate: isOpen ? 0 : -90 }} transition={{ duration: 0.1 }} className="mr-1">
            <HiChevronDown className="w-4 h-4 text-text-muted" />
          </motion.div>

          <span className="text-xs font-semibold uppercase flex-grow text-text-secondary">{title}</span>

          {section === 'updated' ? (
            <span className="text-2xs mr-2 bg-bg-secondary-light px-1.5 rounded-full">
              <span className="text-success">+{totalStats.additions}</span>
              <span className="ml-0.5 text-error">-{totalStats.deletions}</span>
            </span>
          ) : (
            !isOpen && <span className="text-2xs text-text-tertiary mr-2 bg-bg-secondary-light px-1.5 rounded-full">{count}</span>
          )}

          {isOpen && (
            <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
              {actions}
            </div>
          )}
        </div>

        {/* Search Field */}
        {isOpen && searchField && (
          <div className="px-2 py-2 border-b border-border-dark-light bg-bg-primary-light" onClick={(e) => e.stopPropagation()}>
            {searchField}
          </div>
        )}

        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              className="flex-grow w-full overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-bg-tertiary scrollbar-track-bg-primary-light scrollbar-rounded pl-1 py-1 bg-bg-primary-light-strong relative"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              {Object.keys(treeData).length > 1 ? (
                <ControlledTreeEnvironment
                  key={objectHash(treeData)} // Force re-render if data structure changes drastically
                  items={treeData}
                  getItemTitle={(item) => item.data}
                  renderItemTitle={({ title }) => title}
                  viewState={{
                    [treeId]: {
                      expandedItems,
                    },
                  }}
                  onExpandItem={(item) => setExpandedItems([...expandedItems, String(item.index)])}
                  onCollapseItem={(item) => setExpandedItems(expandedItems.filter((id) => id !== String(item.index)))}
                  renderItem={(props) => renderTreeItem(props, section, treeData, expandedItems, setExpandedItems)}
                  canDragAndDrop={false}
                  canDropOnFolder={false}
                  canReorderItems={false}
                >
                  <Tree treeId={treeId} rootItem="root" />
                </ControlledTreeEnvironment>
              ) : emptyContent ? (
                emptyContent
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-center text-text-muted text-2xs">{t('common.noFiles')}</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <div
      className={`context-files-root flex-grow w-full h-full flex flex-col overflow-hidden bg-bg-primary-light-strong ${isDragging ? 'drag-over' : ''}`}
      onDrop={handleFileDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Context Files Section */}
      {renderSection(
        'context',
        t('contextFiles.title'),
        userContextFiles.length,
        contextTreeData,
        contextExpandedItems,
        setContextExpandedItems,
        <>
          <Tooltip content={t('contextFiles.dropAll')}>
            <button
              onClick={handleDropAllFiles}
              className="p-1.5 hover:bg-bg-tertiary rounded-md text-text-muted hover:text-error transition-colors disabled:opacity-50"
              disabled={userContextFiles.length === 0}
            >
              <HiOutlineTrash className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip content={t('contextFiles.add')}>
            <button onClick={showFileDialog} className="p-1 hover:bg-bg-tertiary rounded-md text-text-muted hover:text-text-primary transition-colors">
              <HiPlus className="w-5 h-5" />
            </button>
          </Tooltip>
        </>,
        true,
        false,
        undefined,
        <EmptyContextInfo mode={mode} />,
      )}

      {/* Updated Files Section */}
      {renderSection(
        'updated',
        t('contextFiles.updatedFiles'),
        updatedFiles.length,
        updatedTreeData,
        updatedExpandedItems,
        setUpdatedExpandedItems,
        <>
          <Tooltip content={t('contextFiles.viewChanges')}>
            <button
              className="p-1.5 rounded-md hover:bg-bg-tertiary transition-colors disabled:opacity-50"
              onClick={() => {
                setDiffModalFileIndex(0);
                setDiffModalOpen(true);
              }}
              disabled={updatedFiles.length === 0}
            >
              <MdOutlineDifference className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip content={t('contextFiles.refresh')}>
            <button className="p-1.5 rounded-md hover:bg-bg-tertiary transition-colors" onClick={handleRefreshUpdatedFiles} disabled={isRefreshingUpdated}>
              <MdOutlineRefresh className={`w-4 h-4 ${isRefreshingUpdated ? 'animate-spin' : ''}`} />
            </button>
          </Tooltip>
        </>,
        false,
        false,
      )}

      {/* Project Files Section */}
      {renderSection(
        'project',
        t('contextFiles.projectFiles'),
        allFiles.length,
        projectTreeData,
        projectExpandedItems,
        setProjectExpandedItems,
        <>
          <Tooltip content={useGit ? t('contextFiles.useGitEnabled') : t('contextFiles.useGitDisabled')}>
            <button onClick={toggleUseGit} className="p-1.5 rounded-md hover:bg-bg-tertiary transition-colors">
              <FaGitSquare className={clsx('w-4 h-4', useGit ? 'text-text-primary' : 'text-text-muted')} />
            </button>
          </Tooltip>
          <Tooltip content={t('contextFiles.expandAll')}>
            <button
              onClick={() => setProjectExpandedItems(Object.keys(projectTreeData))}
              className="p-1.5 hover:bg-bg-tertiary rounded-md text-text-muted hover:text-text-primary transition-colors"
            >
              <BiExpandVertical className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip content={t('contextFiles.collapseAll')}>
            <button
              onClick={() => setProjectExpandedItems(['root'])}
              className="p-1.5 hover:bg-bg-tertiary rounded-md text-text-muted hover:text-text-primary transition-colors"
            >
              <BiCollapseVertical className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip content={t('contextFiles.search')}>
            <button className="p-1 rounded-md hover:bg-bg-tertiary transition-colors" onClick={handleSearchToggle}>
              <MdOutlineSearch className="w-5 h-5 text-text-primary" />
            </button>
          </Tooltip>
          <Tooltip content={t('contextFiles.refresh')}>
            <button className="p-1 rounded-md hover:bg-bg-tertiary transition-colors" onClick={() => handleRefreshFiles(useGit!)} disabled={isRefreshing}>
              <MdOutlineRefresh className={`w-5 h-5 text-text-primary ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </Tooltip>
        </>,
        false,
        false,
        isSearchVisible ? (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.05 }}
              className="relative"
            >
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('contextFiles.searchPlaceholder')}
                size="sm"
                className="pr-8"
                autoFocus={true}
              />
              <button
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded-md hover:bg-bg-tertiary transition-colors"
                onClick={handleSearchClose}
              >
                <HiX className="w-4 h-4 text-text-muted hover:text-text-primary" />
              </button>
            </motion.div>
          </AnimatePresence>
        ) : null,
      )}

      {/* Rules Section */}
      {renderSection('rules', t('contextFiles.rules'), rulesFiles.length, rulesTreeData, rulesExpandedItems, setRulesExpandedItems, undefined, false, true)}

      {/* Diff Modal */}
      {diffModalOpen && (
        <UpdatedFilesDiffModal
          files={sortedUpdatedFiles}
          initialFileIndex={diffModalFileIndex}
          onClose={() => setDiffModalOpen(false)}
          baseDir={baseDir}
          taskId={taskId}
        />
      )}

      {/* Revert Confirmation Dialog */}
      {fileToRevert && (
        <ConfirmDialog
          title={t('contextFiles.confirmRevertTitle')}
          onConfirm={handleRevertConfirm}
          onCancel={handleRevertCancel}
          confirmButtonText={t('contextFiles.revert')}
          disabled={isRevertingFile}
          closeOnEscape
        >
          <p className="text-sm mb-3">{t('contextFiles.confirmRevertMessage')}</p>
          <p className="text-xs text-text-muted font-mono">{fileToRevert}</p>
        </ConfirmDialog>
      )}
    </div>
  );
};
