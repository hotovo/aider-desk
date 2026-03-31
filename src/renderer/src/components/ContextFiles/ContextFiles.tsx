import { AIDER_MODES, ContextFile, Mode, OS, TokensInfoData, UpdatedFile } from '@common/types';
import React, { Activity, useCallback, useEffect, useMemo, useState } from 'react';
import { ControlledTreeEnvironment, Tree } from 'react-complex-tree';
import { HiChevronDown, HiChevronRight, HiOutlineTrash, HiPlus, HiX } from 'react-icons/hi';
import { MdOutlineDifference, MdOutlinePublic, MdOutlineRefresh, MdOutlineSearch, MdUndo } from 'react-icons/md';
import { BiCollapseVertical, BiExpandVertical } from 'react-icons/bi';
import { TbPencilOff } from 'react-icons/tb';
import { RiRobot2Line, RiMenuUnfold4Line } from 'react-icons/ri';
import { VscFileCode } from 'react-icons/vsc';
import { FaGitSquare } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useDebounce, useLocalStorage } from '@reactuses/core';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { UpdatedFilesDiffModal } from './UpdatedFilesDiffModal';
import { FilePreviewModal } from './FilePreviewModal';

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
        tree[nodeId].file = file;
      }

      currentNode = tree[nodeId];
    });
  });

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
  onToggleFilesSidebarCollapse?: () => void;
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

type TreeItemRendererProps = {
  item: TreeItem;
  title: React.ReactNode;
  children: React.ReactNode;
  type: SectionType;
  treeData: Record<string, TreeItem>;
  expandedItems: string[];
  setExpandedItems: (items: string[]) => void;
  contextFilesMap: Map<string, ContextFile>;
  updatedFiles: UpdatedFile[];
  tokensInfo?: TokensInfoData | null;
  os: OS | null;
  onFileDiffClick: (file: UpdatedFile) => void;
  onFilePreviewClick: (filePath: string) => void;
  onRevertFile: (filePath: string) => void;
  onDropFile: (item: TreeItem) => (e: React.MouseEvent<HTMLButtonElement>) => void;
  onAddFile: (item: TreeItem) => (event: React.MouseEvent<HTMLButtonElement>) => void;
};

const TreeItemRenderer = ({
  item,
  title,
  children,
  type,
  expandedItems,
  setExpandedItems,
  contextFilesMap,
  updatedFiles,
  tokensInfo,
  onFileDiffClick,
  onFilePreviewClick,
  onRevertFile,
  onDropFile,
  onAddFile,
}: TreeItemRendererProps) => {
  const { t } = useTranslation();

  const source = item.file?.source;
  const isRuleFile = source === 'global-rule' || source === 'project-rule' || source === 'agent-rule';
  const filePath = item.file?.path;
  const isContextFile = filePath ? contextFilesMap.has(normalizePath(filePath)) : false;

  const updatedFile = type === 'updated' ? updatedFiles.find((f) => normalizePath(f.path) === normalizePath(item.file?.path || '')) : undefined;

  const showAdd = type === 'project' && !isContextFile && !isRuleFile;
  const showRemove = (type === 'context' || (type === 'project' && isContextFile)) && !isRuleFile;
  const showRevert = type === 'updated' && updatedFile && !item.isFolder && !updatedFile.commitHash;

  const fileTokenInfo = tokensInfo?.files?.[item.index];
  const fileTokenTooltip = fileTokenInfo ? `${fileTokenInfo.tokens || 0} ${t('usageDashboard.charts.tokens')}, $${(fileTokenInfo.cost || 0).toFixed(5)}` : '';

  const toggleFolder = useCallback(() => {
    const isExpanded = expandedItems.includes(String(item.index));
    if (isExpanded) {
      setExpandedItems(expandedItems.filter((id) => id !== String(item.index)));
    } else {
      setExpandedItems([...expandedItems, String(item.index)]);
    }
  }, [expandedItems, item.index, setExpandedItems]);

  const handleChevronClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleFolder();
    },
    [toggleFolder],
  );

  const handleTitleClick = useCallback(() => {
    if (item.isFolder) {
      toggleFolder();
    } else if (type === 'project' && filePath) {
      onFilePreviewClick(filePath);
    }
  }, [item.isFolder, toggleFolder, type, filePath, onFilePreviewClick]);

  const handleUpdatedFileClick = useCallback(() => {
    if (updatedFile) {
      onFileDiffClick(updatedFile);
    }
  }, [updatedFile, onFileDiffClick]);

  const handleRevertClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (updatedFile) {
        onRevertFile(updatedFile.path);
      }
    },
    [updatedFile, onRevertFile],
  );

  const renderChevron = () => {
    if (!item.isFolder) {
      return <span className="w-3 h-3 inline-block" />;
    }
    return (
      <span className="flex items-center justify-center cursor-pointer" onClick={handleChevronClick}>
        {expandedItems.includes(String(item.index)) ? (
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
      item.isFolder ? 'context-dimmed' : type === 'project' && !isContextFile ? 'context-dimmed' : 'text-text-primary',
      type === 'updated' && !item.isFolder && 'cursor-pointer hover:text-text-tertiary',
    );

    const renderFile = () => {
      if (updatedFile && !item.isFolder) {
        return (
          <div className="flex items-center gap-2 min-w-0 cursor-pointer hover:text-text-tertiary" onClick={handleUpdatedFileClick}>
            <span className={className}>{title}</span>
            <span className="text-4xs text-text-muted-dark flex-shrink-0 flex items-center gap-0.5 mt-0.5">
              {updatedFile.additions > 0 && <span className="text-success">+{updatedFile.additions}</span>}
              {updatedFile.deletions > 0 && <span className="text-error">-{updatedFile.deletions}</span>}
            </span>
          </div>
        );
      }

      if (type === 'project' && !item.isFolder && filePath) {
        return (
          <span className={twMerge(className, 'cursor-pointer hover:text-text-tertiary')} onClick={handleTitleClick}>
            {title}
          </span>
        );
      }

      if (item.isFolder) {
        return (
          <span className={twMerge(className, 'cursor-pointer')} onClick={handleTitleClick}>
            {title}
          </span>
        );
      }

      return <span className={className}>{title}</span>;
    };

    if (fileTokenTooltip) {
      return <Tooltip content={fileTokenTooltip}>{renderFile()}</Tooltip>;
    }
    return renderFile();
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
          {item.file?.readOnly && !isRuleFile && (
            <Tooltip content={t('contextFiles.readOnly')}>
              <TbPencilOff className="w-4 h-4 text-text-muted-light" />
            </Tooltip>
          )}
          {showRemove && (
            <button onClick={onDropFile(item)} className="px-1 py-1 rounded hover:bg-bg-primary-light text-text-muted hover:text-error-dark">
              <HiX className="w-4 h-4" />
            </button>
          )}
          {showAdd && (
            <Tooltip content={t('contextFiles.addFileTooltip.cmd')}>
              <button onClick={onAddFile(item)} className="px-1 py-1 rounded hover:bg-bg-primary-light text-text-muted hover:text-text-primary">
                <HiPlus className="w-4 h-4" />
              </button>
            </Tooltip>
          )}
          {showRevert && (
            <Tooltip content={t('contextFiles.revertFile')}>
              <button onClick={handleRevertClick} className="px-1 py-1 rounded hover:bg-bg-primary-light text-text-muted hover:text-text-primary">
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

type SectionHeaderProps = {
  section: SectionType;
  title: string;
  count: number;
  isOpen: boolean;
  totalStats: { additions: number; deletions: number };
  actions?: React.ReactNode;
  alwaysVisibleActions?: React.ReactNode;
  onToggle: () => void;
};

const SectionHeader = ({ section, title, count, isOpen, totalStats, actions, alwaysVisibleActions, onToggle }: SectionHeaderProps) => {
  return (
    <div
      className={clsx(
        'flex items-center px-2 select-none h-[40px] shrink-0 bg-bg-primary-light',
        !isOpen && 'cursor-pointer',
        isOpen && !actions && 'border-b border-border-dark-light',
      )}
      onClick={onToggle}
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

      <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
        {isOpen && actions}
        {alwaysVisibleActions}
      </div>
    </div>
  );
};

type SectionContentProps = {
  section: SectionType;
  treeData: Record<string, TreeItem>;
  expandedItems: string[];
  setExpandedItems: React.Dispatch<React.SetStateAction<string[]>>;
  contextFilesMap: Map<string, ContextFile>;
  updatedFiles: UpdatedFile[];
  tokensInfo?: TokensInfoData | null;
  os: OS | null;
  searchField?: React.ReactNode;
  emptyContent?: React.ReactNode;
  onFileDiffClick: (file: UpdatedFile) => void;
  onFilePreviewClick: (filePath: string) => void;
  onRevertFile: (filePath: string) => void;
  onDropFile: (item: TreeItem) => (e: React.MouseEvent<HTMLButtonElement>) => void;
  onAddFile: (item: TreeItem) => (event: React.MouseEvent<HTMLButtonElement>) => void;
};

const SectionContent = ({
  section,
  treeData,
  expandedItems,
  setExpandedItems,
  contextFilesMap,
  updatedFiles,
  tokensInfo,
  os,
  searchField,
  emptyContent,
  onFileDiffClick,
  onFilePreviewClick,
  onRevertFile,
  onDropFile,
  onAddFile,
}: SectionContentProps) => {
  const { t } = useTranslation();
  const treeId = `tree-${section}`;

  const renderItem = useCallback(
    (props: { item: TreeItem; title: React.ReactNode; children: React.ReactNode; context: unknown }) => (
      <TreeItemRenderer
        item={props.item}
        title={props.title}
        type={section}
        treeData={treeData}
        expandedItems={expandedItems}
        setExpandedItems={setExpandedItems}
        contextFilesMap={contextFilesMap}
        updatedFiles={updatedFiles}
        tokensInfo={tokensInfo}
        os={os}
        onFileDiffClick={onFileDiffClick}
        onFilePreviewClick={onFilePreviewClick}
        onRevertFile={onRevertFile}
        onDropFile={onDropFile}
        onAddFile={onAddFile}
      >
        {props.children}
      </TreeItemRenderer>
    ),
    [
      section,
      treeData,
      expandedItems,
      setExpandedItems,
      contextFilesMap,
      updatedFiles,
      tokensInfo,
      os,
      onFileDiffClick,
      onFilePreviewClick,
      onRevertFile,
      onDropFile,
      onAddFile,
    ],
  );

  const handleExpandItem = useCallback((item: TreeItem) => setExpandedItems([...expandedItems, String(item.index)]), [expandedItems, setExpandedItems]);

  const handleCollapseItem = useCallback(
    (item: TreeItem) => setExpandedItems(expandedItems.filter((id) => id !== String(item.index))),
    [expandedItems, setExpandedItems],
  );

  const hasContent = Object.keys(treeData).length > 1;

  return (
    <>
      {searchField && (
        <div className="px-2 py-2 border-b border-border-dark-light bg-bg-primary-light" onClick={(e) => e.stopPropagation()}>
          {searchField}
        </div>
      )}

      <motion.div
        className="flex-grow w-full overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-bg-tertiary scrollbar-track-bg-primary-light scrollbar-rounded pl-1 py-1 bg-bg-primary-light-strong relative"
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        {hasContent ? (
          <ControlledTreeEnvironment
            items={treeData}
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
        ) : emptyContent ? (
          emptyContent
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-center text-text-muted text-2xs">{t('common.noFiles')}</div>
        )}
      </motion.div>
    </>
  );
};

export const ContextFiles = ({
  baseDir,
  taskId,
  allFiles,
  contextFiles,
  showFileDialog,
  tokensInfo,
  refreshAllFiles,
  mode,
  onToggleFilesSidebarCollapse,
}: Props) => {
  const { t } = useTranslation();
  const os = useOS();
  const api = useApi();

  const [activeSection, setActiveSection] = useLocalStorage<SectionType>(`context-files-active-section-${baseDir}`, 'context');
  const [visitedSections, setVisitedSections] = useState<Set<SectionType>>(new Set(['context']));

  // Track visited sections
  useEffect(() => {
    if (activeSection) {
      setVisitedSections((prev) => {
        if (prev.has(activeSection)) {
          return prev;
        }
        return new Set(prev).add(activeSection);
      });
    }
  }, [activeSection]);

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
  const [previewFilePath, setPreviewFilePath] = useState<string | null>(null);

  // O(1) lookup map for context files
  const contextFilesMap = useMemo(() => {
    const map = new Map<string, ContextFile>();
    contextFiles.forEach((file) => {
      map.set(normalizePath(file.path), file);
    });
    return map;
  }, [contextFiles]);

  const sortedUpdatedFiles = useMemo(() => {
    return [...updatedFiles].sort((a, b) => a.path.localeCompare(b.path));
  }, [updatedFiles]);

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
      const index = sortedUpdatedFiles.findIndex((f) => normalizePath(f.path) === normalizePath(file.path));
      if (index !== -1) {
        setDiffModalFileIndex(index);
        setDiffModalOpen(true);
      }
    },
    [sortedUpdatedFiles],
  );

  const handleFilePreviewClick = useCallback((filePath: string) => {
    setPreviewFilePath(filePath);
  }, []);

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

  // Lazy tree data computation - only compute for visited sections
  const projectTreeData = useMemo(() => {
    if (!visitedSections.has('project')) {
      return { root: { index: 'root', children: [], isFolder: true, data: 'root' } };
    }
    const allFileObjects: ContextFile[] = sortedAllFiles.map((path) => {
      const normalizedPath = normalizePath(path);
      const contextFile = contextFilesMap.get(normalizedPath);
      return {
        path,
        readOnly: contextFile?.readOnly,
        source: contextFile?.source,
      };
    });
    return createFileTree(allFileObjects, 'root');
  }, [visitedSections, sortedAllFiles, contextFilesMap]);

  const contextTreeData = useMemo(() => {
    return createFileTree(sortedUserFiles, 'root');
  }, [sortedUserFiles]);

  const rulesTreeData = useMemo(() => {
    if (!visitedSections.has('rules')) {
      return { root: { index: 'root', children: [], isFolder: true, data: 'root' } };
    }
    return createFileTree(sortedRulesFiles, 'root');
  }, [visitedSections, sortedRulesFiles]);

  const updatedTreeData = useMemo(() => {
    if (!visitedSections.has('updated')) {
      return { root: { index: 'root', children: [], isFolder: true, data: 'root' } };
    }
    const allFileObjects: ContextFile[] = updatedFiles.map((f) => ({
      path: f.path,
    }));
    return createFileTree(allFileObjects, 'root');
  }, [visitedSections, updatedFiles]);

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

  const handleDropAllFiles = useCallback(() => {
    api.runCommand(baseDir, taskId, 'drop');
  }, [api, baseDir, taskId]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const handleSearchToggle = useCallback(() => {
    setIsSearchVisible((prev) => {
      if (prev) {
        setSearchQuery('');
      }
      return !prev;
    });
  }, []);

  const handleRefreshFiles = useCallback(
    async (useGitValue: boolean) => {
      setIsRefreshing(true);
      try {
        await refreshAllFiles(useGitValue);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to refresh files:', error);
      } finally {
        setIsRefreshing(false);
      }
    },
    [refreshAllFiles],
  );

  const toggleUseGit = useCallback(() => {
    setUseGit((prev) => {
      const newValue = !prev;
      void handleRefreshFiles(newValue);
      return newValue;
    });
  }, [setUseGit, handleRefreshFiles]);

  const handleSearchClose = useCallback(() => {
    setIsSearchVisible(false);
    setSearchQuery('');
  }, []);

  const dropFile = useCallback(
    (item: TreeItem) => (e: React.MouseEvent<HTMLButtonElement>) => {
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
    },
    [api, baseDir, taskId],
  );

  const addFile = useCallback(
    (item: TreeItem) => (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      const shouldBeReadOnly = event.ctrlKey || event.metaKey;
      const pathToAdd = item.file ? item.file.path : item.index;

      if (shouldBeReadOnly) {
        api.addFile(baseDir, taskId, String(pathToAdd), true);
      } else {
        api.addFile(baseDir, taskId, String(pathToAdd));
      }
    },
    [api, baseDir, taskId],
  );

  // Section toggle handler
  const handleSectionToggle = useCallback(
    (section: SectionType) => {
      setActiveSection(section);
    },
    [setActiveSection],
  );

  // Expand/Collapse handlers for project section
  const handleExpandAll = useCallback(() => {
    setProjectExpandedItems(Object.keys(projectTreeData));
  }, [projectTreeData]);

  const handleCollapseAll = useCallback(() => {
    setProjectExpandedItems(['root']);
  }, []);

  // Modal handlers
  const handleOpenDiffModal = useCallback(() => {
    setDiffModalFileIndex(0);
    setDiffModalOpen(true);
  }, []);

  const handleCloseDiffModal = useCallback(() => {
    setDiffModalOpen(false);
  }, []);

  const handleClosePreviewModal = useCallback(() => {
    setPreviewFilePath(null);
  }, []);

  // Search field component
  const searchField = useMemo(() => {
    if (!isSearchVisible) {
      return null;
    }
    return (
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
    );
  }, [isSearchVisible, searchQuery, t, handleSearchClose]);

  // Action button components
  const contextActions = useMemo(
    () => (
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
      </>
    ),
    [t, handleDropAllFiles, userContextFiles.length, showFileDialog],
  );

  const collapseButton = useMemo(
    () =>
      onToggleFilesSidebarCollapse ? (
        <Tooltip content={t('common.collapse')}>
          <button onClick={onToggleFilesSidebarCollapse} className="p-1.5 hover:bg-bg-tertiary rounded-md transition-colors">
            <RiMenuUnfold4Line className="w-4 h-4 rotate-180" />
          </button>
        </Tooltip>
      ) : undefined,
    [t, onToggleFilesSidebarCollapse],
  );

  const updatedActions = useMemo(
    () => (
      <>
        <Tooltip content={t('contextFiles.viewChanges')}>
          <button
            className="p-1.5 rounded-md hover:bg-bg-tertiary transition-colors disabled:opacity-50"
            onClick={handleOpenDiffModal}
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
      </>
    ),
    [t, handleOpenDiffModal, updatedFiles.length, handleRefreshUpdatedFiles, isRefreshingUpdated],
  );

  const projectActions = useMemo(
    () => (
      <>
        <Tooltip content={useGit ? t('contextFiles.useGitEnabled') : t('contextFiles.useGitDisabled')}>
          <button onClick={toggleUseGit} className="p-1.5 rounded-md hover:bg-bg-tertiary transition-colors">
            <FaGitSquare className={clsx('w-4 h-4', useGit ? 'text-text-primary' : 'text-text-muted')} />
          </button>
        </Tooltip>
        <Tooltip content={t('contextFiles.expandAll')}>
          <button onClick={handleExpandAll} className="p-1.5 hover:bg-bg-tertiary rounded-md text-text-muted hover:text-text-primary transition-colors">
            <BiExpandVertical className="w-4 h-4" />
          </button>
        </Tooltip>
        <Tooltip content={t('contextFiles.collapseAll')}>
          <button onClick={handleCollapseAll} className="p-1.5 hover:bg-bg-tertiary rounded-md text-text-muted hover:text-text-primary transition-colors">
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
      </>
    ),
    [t, useGit, toggleUseGit, handleExpandAll, handleCollapseAll, handleSearchToggle, handleRefreshFiles, isRefreshing],
  );

  const commonContentProps = useMemo(
    () => ({
      contextFilesMap,
      updatedFiles,
      tokensInfo,
      os,
      onFileDiffClick: handleFileDiffClick,
      onFilePreviewClick: handleFilePreviewClick,
      onRevertFile: handleRevertFile,
      onDropFile: dropFile,
      onAddFile: addFile,
    }),
    [contextFilesMap, updatedFiles, tokensInfo, os, handleFileDiffClick, handleFilePreviewClick, handleRevertFile, dropFile, addFile],
  );

  return (
    <div
      className={`context-files-root flex-grow w-full h-full flex flex-col overflow-hidden bg-bg-primary-light-strong ${isDragging ? 'drag-over' : ''}`}
      onDrop={handleFileDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Context Files Section */}
      <motion.div
        className={clsx('flex flex-col flex-grow overflow-hidden min-h-[40px]')}
        initial={false}
        animate={{
          flexGrow: activeSection === 'context' ? 1 : 0,
          flexShrink: activeSection === 'context' ? 1 : 0,
        }}
        transition={{ duration: 0.3, ease: 'easeIn' }}
      >
        <SectionHeader
          section="context"
          title={t('contextFiles.title')}
          count={userContextFiles.length}
          isOpen={activeSection === 'context'}
          totalStats={totalStats}
          actions={contextActions}
          alwaysVisibleActions={collapseButton}
          onToggle={() => handleSectionToggle('context')}
        />
        <Activity mode={activeSection === 'context' ? 'visible' : 'hidden'}>
          <SectionContent
            section="context"
            treeData={contextTreeData}
            expandedItems={contextExpandedItems}
            setExpandedItems={setContextExpandedItems}
            emptyContent={<EmptyContextInfo mode={mode} />}
            {...commonContentProps}
          />
        </Activity>
      </motion.div>

      {/* Updated Files Section */}
      <motion.div
        className={clsx('flex flex-col flex-grow overflow-hidden border-t border-border-dark-light min-h-[40px]')}
        initial={false}
        animate={{
          flexGrow: activeSection === 'updated' ? 1 : 0,
          flexShrink: activeSection === 'updated' ? 1 : 0,
        }}
        transition={{ duration: 0.3, ease: 'easeIn' }}
      >
        <SectionHeader
          section="updated"
          title={t('contextFiles.updatedFiles')}
          count={updatedFiles.length}
          isOpen={activeSection === 'updated'}
          totalStats={totalStats}
          actions={updatedActions}
          onToggle={() => handleSectionToggle('updated')}
        />
        <Activity mode={activeSection === 'updated' ? 'visible' : 'hidden'}>
          <SectionContent
            section="updated"
            treeData={updatedTreeData}
            expandedItems={updatedExpandedItems}
            setExpandedItems={setUpdatedExpandedItems}
            {...commonContentProps}
          />
        </Activity>
      </motion.div>

      {/* Project Files Section */}
      <motion.div
        className={clsx('flex flex-col flex-grow overflow-hidden border-t border-border-dark-light min-h-[40px]')}
        initial={false}
        animate={{
          flexGrow: activeSection === 'project' ? 1 : 0,
          flexShrink: activeSection === 'project' ? 1 : 0,
        }}
        transition={{ duration: 0.3, ease: 'easeIn' }}
      >
        <SectionHeader
          section="project"
          title={t('contextFiles.projectFiles')}
          count={allFiles.length}
          isOpen={activeSection === 'project'}
          totalStats={totalStats}
          actions={projectActions}
          onToggle={() => handleSectionToggle('project')}
        />
        <Activity mode={activeSection === 'project' ? 'visible' : 'hidden'}>
          <SectionContent
            section="project"
            treeData={projectTreeData}
            expandedItems={projectExpandedItems}
            setExpandedItems={setProjectExpandedItems}
            searchField={searchField}
            {...commonContentProps}
          />
        </Activity>
      </motion.div>

      {/* Rules Section */}
      <motion.div
        className={clsx('flex flex-col flex-grow overflow-hidden border-t border-border-dark-light min-h-[40px]')}
        initial={false}
        animate={{
          flexGrow: activeSection === 'rules' ? 1 : 0,
          flexShrink: activeSection === 'rules' ? 1 : 0,
        }}
        transition={{ duration: 0.3, ease: 'easeIn' }}
      >
        <SectionHeader
          section="rules"
          title={t('contextFiles.rules')}
          count={rulesFiles.length}
          isOpen={activeSection === 'rules'}
          totalStats={totalStats}
          onToggle={() => handleSectionToggle('rules')}
        />
        <Activity mode={activeSection === 'rules' ? 'visible' : 'hidden'}>
          <SectionContent
            section="rules"
            treeData={rulesTreeData}
            expandedItems={rulesExpandedItems}
            setExpandedItems={setRulesExpandedItems}
            {...commonContentProps}
          />
        </Activity>
      </motion.div>

      {/* Diff Modal */}
      <Activity key={taskId} mode={diffModalOpen ? 'visible' : 'hidden'}>
        <UpdatedFilesDiffModal
          files={sortedUpdatedFiles}
          initialFileIndex={diffModalFileIndex}
          onClose={handleCloseDiffModal}
          baseDir={baseDir}
          taskId={taskId}
        />
      </Activity>

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

      {/* File Preview Modal */}
      {previewFilePath && <FilePreviewModal filePath={previewFilePath} baseDir={baseDir} onClose={handleClosePreviewModal} />}
    </div>
  );
};
