import { ContextFile, OS, TokensInfoData } from '@common/types';
import React, { useCallback, useMemo, useState } from 'react';
import { HiX } from 'react-icons/hi';
import { BiCollapseVertical, BiExpandVertical } from 'react-icons/bi';
import { MdOutlineSearch, MdOutlineRefresh } from 'react-icons/md';
import { FaGitSquare } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useDebounce, useLocalStorage } from '@reactuses/core';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx } from 'clsx';
import { FileViewerModal } from 'src/renderer/src/components/ContextFiles/FileViewerModal';

import { ContextFilesSection } from './ContextFilesSection';
import { normalizePath, createFileTree } from './types';

import type { TreeItem } from './types';

import { Tooltip } from '@/components/ui/Tooltip';
import { Input } from '@/components/common/Input';

type Props = {
  baseDir: string;
  taskId: string;
  allFiles: string[];
  isOpen: boolean;
  totalStats: { additions: number; deletions: number };
  tokensInfo?: TokensInfoData | null;
  os: OS | null;
  contextFilesMap: Map<string, ContextFile>;
  visitedSections: Set<string>;
  refreshAllFiles: (useGit?: boolean) => Promise<void>;
  onToggle: () => void;
  onDropFile: (item: TreeItem) => (e: React.MouseEvent<HTMLButtonElement>) => void;
  onAddFile: (item: TreeItem) => (event: React.MouseEvent<HTMLButtonElement>) => void;
  editMode?: boolean;
  isHidden?: boolean;
  onToggleHidden?: () => void;
  showBorderTop?: boolean;
};

export const ProjectFilesSection = ({
  baseDir,
  taskId,
  allFiles,
  isOpen,
  totalStats,
  tokensInfo,
  os,
  contextFilesMap,
  visitedSections,
  refreshAllFiles,
  onToggle,
  onDropFile,
  onAddFile,
  editMode,
  isHidden,
  onToggleHidden,
  showBorderTop,
}: Props) => {
  const { t } = useTranslation();

  const [projectExpandedItems, setProjectExpandedItems] = useState<string[]>([]);
  const [previewFilePath, setPreviewFilePath] = useState<string | null>(null);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 50);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [useGit, setUseGit] = useLocalStorage(`context-files-use-git-${baseDir}`, true);

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

  const projectTreeData = useMemo(() => {
    if (!visitedSections.has('project')) {
      return { root: { index: 'root', children: [], isFolder: true, data: 'root' } as TreeItem };
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

  const handleExpandAll = useCallback(() => {
    setProjectExpandedItems(Object.keys(projectTreeData));
  }, [projectTreeData]);

  const handleCollapseAll = useCallback(() => {
    setProjectExpandedItems(['root']);
  }, []);

  const handleSearchToggle = useCallback(() => {
    setIsSearchVisible((prev) => {
      if (prev) {
        setSearchQuery('');
      }
      return !prev;
    });
  }, []);

  const handleSearchClose = useCallback(() => {
    setIsSearchVisible(false);
    setSearchQuery('');
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

  return (
    <>
      <ContextFilesSection
        section="project"
        title={t('contextFiles.projectFiles')}
        count={allFiles.length}
        isOpen={isOpen}
        totalStats={totalStats}
        treeData={projectTreeData}
        expandedItems={projectExpandedItems}
        setExpandedItems={setProjectExpandedItems}
        contextFilesMap={contextFilesMap}
        updatedFiles={[]}
        tokensInfo={tokensInfo}
        os={os}
        actions={projectActions}
        searchField={searchField}
        showBorderTop={showBorderTop}
        onToggle={onToggle}
        onFileDiffClick={() => {}}
        onFilePreviewClick={setPreviewFilePath}
        onRevertFile={() => {}}
        onDropFile={onDropFile}
        onAddFile={onAddFile}
        editMode={editMode}
        isHidden={isHidden}
        onToggleHidden={onToggleHidden}
      />

      {previewFilePath && <FileViewerModal filePath={previewFilePath} baseDir={baseDir} taskId={taskId} onClose={() => setPreviewFilePath(null)} />}
    </>
  );
};
