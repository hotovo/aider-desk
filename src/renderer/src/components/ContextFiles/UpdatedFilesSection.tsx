import { ContextFile, OS, TokensInfoData, UpdatedFile, UpdatedFilesGroupMode } from '@common/types';
import React, { Activity, useCallback, useEffect, useMemo, useState } from 'react';
import { HiChevronDown } from 'react-icons/hi';
import { MdOutlineDifference, MdOutlineRefresh } from 'react-icons/md';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { TbGitCommit, TbGitPullRequestDraft } from 'react-icons/tb';

import { createFileTree } from './types';
import { SectionContent } from './SectionContent';
import { UpdatedFilesDiffModal } from './UpdatedFilesDiffModal';
import { groupFilesByCommit, UNCOMMITTED_GROUP_ID } from './group-files';

import type { DiffModalGroup } from './UpdatedFilesDiffModal';
import type { SectionType, TreeItem } from './types';

import { Tooltip } from '@/components/ui/Tooltip';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useApi } from '@/contexts/ApiContext';
import { useProjectSettings } from '@/contexts/ProjectSettingsContext';
import { encodeBaseDir, ROUTES, URL_PARAMS } from '@/utils/routes';

interface CommitGroup {
  id: string;
  commitHash?: string;
  commitMessage?: string;
  files: UpdatedFile[];
  additions: number;
  deletions: number;
}

type Props = {
  baseDir: string;
  taskId: string;
  isOpen: boolean;
  tokensInfo?: TokensInfoData | null;
  os: OS | null;
  contextFilesMap: Map<string, ContextFile>;
  visitedSections: Set<'updated' | 'project' | 'context' | 'rules'>;
  onToggle: () => void;
  onFilePreviewClick: (filePath: string) => void;
  taskName?: string;
};

export const UpdatedFilesSection = ({
  baseDir,
  taskId,
  isOpen,
  tokensInfo,
  os,
  contextFilesMap,
  visitedSections,
  onToggle,
  onFilePreviewClick,
  taskName,
}: Props) => {
  const { t } = useTranslation();
  const api = useApi();
  const { projectSettings, saveProjectSettings } = useProjectSettings();

  const [updatedFiles, setUpdatedFiles] = useState<UpdatedFile[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [groupExpandedItems, setGroupExpandedItems] = useState<Record<string, string[]>>({});
  const [flatExpandedItems, setFlatExpandedItems] = useState<string[]>([]);
  const [isRefreshingUpdated, setIsRefreshingUpdated] = useState(false);
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [diffModalSelectedFile, setDiffModalSelectedFile] = useState<UpdatedFile | null>(null);
  const [fileToRevert, setFileToRevert] = useState<string | null>(null);
  const [isRevertingFile, setIsRevertingFile] = useState(false);

  const groupMode = projectSettings?.updatedFilesGroupMode ?? UpdatedFilesGroupMode.Flat;
  const isGrouped = groupMode === UpdatedFilesGroupMode.Grouped;

  // Group files by commit hash; preserve commit order from backend (newest first in array),
  // then reverse for display (oldest first). Uncommitted always last.
  const diffModalGroups: DiffModalGroup[] = useMemo(() => {
    if (isGrouped) {
      return groupFilesByCommit(updatedFiles);
    }
    return [{ id: '__flat__', files: updatedFiles }];
  }, [updatedFiles, isGrouped]);

  // Extend DiffModalGroup with per-group stats for the section's tree/header UI
  const commitGroups = useMemo((): CommitGroup[] => {
    if (!isGrouped) {
      return [];
    }

    return diffModalGroups.map((group) => ({
      id: group.id ?? UNCOMMITTED_GROUP_ID,
      commitHash: group.commitHash,
      commitMessage: group.commitMessage,
      files: group.files,
      additions: group.files.reduce((sum, f) => sum + f.additions, 0),
      deletions: group.files.reduce((sum, f) => sum + f.deletions, 0),
    }));
  }, [diffModalGroups, isGrouped]);

  const totalStats = useMemo(() => {
    return updatedFiles.reduce(
      (acc, file) => ({
        additions: acc.additions + file.additions,
        deletions: acc.deletions + file.deletions,
      }),
      { additions: 0, deletions: 0 },
    );
  }, [updatedFiles]);

  // Build tree data for each group — use 'root' as root key since SectionContent expects it
  const groupTreeData = useMemo(() => {
    if (!visitedSections.has('updated')) {
      return {};
    }

    const trees: Record<string, Record<string, TreeItem>> = {};

    for (const group of commitGroups) {
      const allFileObjects: ContextFile[] = group.files.map((f) => ({
        path: f.path,
      }));
      trees[group.id] = createFileTree(allFileObjects, 'root');
    }

    return trees;
  }, [commitGroups, visitedSections]);

  // Build tree data for flat mode
  const flatTreeData = useMemo(() => {
    if (!visitedSections.has('updated') || isGrouped) {
      return undefined;
    }
    const allFileObjects: ContextFile[] = updatedFiles.map((f) => ({
      path: f.path,
    }));
    return createFileTree(allFileObjects, 'root');
  }, [updatedFiles, visitedSections, isGrouped]);

  // Auto-expand folder items in each group's tree when tree data changes
  useEffect(() => {
    setGroupExpandedItems((prev) => {
      const next: Record<string, string[]> = {};

      for (const group of commitGroups) {
        const tree = groupTreeData[group.id];
        if (!tree) {
          continue;
        }

        const allFolders = Object.keys(tree).filter((key) => tree[key].isFolder);
        const existing = prev[group.id] || [];
        next[group.id] = Array.from(new Set([...existing, ...allFolders]));
      }

      return next;
    });
  }, [groupTreeData, commitGroups]);

  // Auto-expand folders in flat tree when tree data changes
  useEffect(() => {
    if (!flatTreeData) {
      return;
    }

    const allFolders = Object.keys(flatTreeData).filter((key) => flatTreeData[key].isFolder);
    setFlatExpandedItems((prev) => Array.from(new Set([...prev, ...allFolders])));
  }, [flatTreeData]);

  // Default: only the bottom-most (last) group is expanded.
  // Only re-run when group count changes, not on every file refresh,
  // to preserve user's manual expand/collapse choices between refreshes.
  useEffect(() => {
    if (commitGroups.length > 0) {
      setExpandedGroups([commitGroups[commitGroups.length - 1].id]);
    } else {
      setExpandedGroups([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commitGroups.length]);

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

  const handleToggleGroupMode = useCallback(async () => {
    const newMode = isGrouped ? UpdatedFilesGroupMode.Flat : UpdatedFilesGroupMode.Grouped;
    try {
      await saveProjectSettings({ updatedFilesGroupMode: newMode });
      await fetchUpdatedFiles();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to update group mode:', error);
    }
  }, [saveProjectSettings, isGrouped, fetchUpdatedFiles]);

  const handleFileDiffClick = useCallback((file: UpdatedFile) => {
    setDiffModalSelectedFile(file);
    setDiffModalOpen(true);
  }, []);

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

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => (prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]));
  }, []);

  const dropFile = useCallback(
    (_item: TreeItem) => (_e: React.MouseEvent<HTMLButtonElement>) => {
      _e.stopPropagation();
    },
    [],
  );

  const addFile = useCallback((_item: TreeItem) => (_event: React.MouseEvent<HTMLButtonElement>) => {}, []);

  const updatedActions = useMemo(
    () => (
      <>
        <Tooltip content={isGrouped ? t('contextFiles.flatView') : t('contextFiles.groupByCommit')}>
          <button className="p-1.5 rounded-md hover:bg-bg-tertiary transition-colors" onClick={handleToggleGroupMode}>
            {isGrouped ? <TbGitPullRequestDraft className="w-4 h-4" /> : <TbGitCommit className="w-4 h-4" />}
          </button>
        </Tooltip>
        <Tooltip content={t('contextFiles.viewChanges')}>
          <button
            className="p-1.5 rounded-md hover:bg-bg-tertiary transition-colors disabled:opacity-50"
            onClick={() => {
              setDiffModalSelectedFile(updatedFiles[0] || null);
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
      </>
    ),
    [isGrouped, t, handleToggleGroupMode, updatedFiles, handleRefreshUpdatedFiles, isRefreshingUpdated],
  );

  const renderCommitGroupHeader = useCallback(
    (group: CommitGroup, isExpanded: boolean) => {
      const isUncommitted = group.id === UNCOMMITTED_GROUP_ID;

      return (
        <div
          className="flex items-center px-2 select-none h-[28px] shrink-0 bg-bg-primary-light cursor-pointer border-t border-border-dark-light sticky top-0 z-10"
          onClick={() => toggleGroup(group.id)}
        >
          {isUncommitted ? (
            <span className="text-2xs font-normal text-text-secondary truncate mr-2 flex-grow">UNCOMMITTED</span>
          ) : (
            <Tooltip content={group.commitMessage || ''}>
              <span className="text-2xs font-normal text-text-secondary truncate mr-2 flex-grow">{group.commitHash?.slice(0, 7)}</span>
            </Tooltip>
          )}

          <span className="text-4xs text-text-muted bg-bg-secondary-light px-1.5 pt-0.5 rounded-full flex-shrink-0">{group.files.length}</span>

          <span className="text-4xs ml-1.5 bg-bg-secondary-light pl-1 pr-1.5 rounded-full flex-shrink-0 pt-0.5">
            <span className="text-success">+{group.additions}</span>
            <span className="ml-0.5 text-error">-{group.deletions}</span>
          </span>

          <motion.div initial={false} animate={{ rotate: isExpanded ? 0 : -90 }} transition={{ duration: 0.1 }} className="ml-1 flex-shrink-0">
            <HiChevronDown className="w-3 h-3 text-text-muted" />
          </motion.div>
        </div>
      );
    },
    [toggleGroup],
  );

  const hasAnyContent = (isGrouped ? commitGroups.length > 0 : updatedFiles.length > 0) && visitedSections.has('updated');

  return (
    <>
      <motion.div
        className={clsx('flex flex-col flex-grow overflow-hidden min-h-[40px]', 'border-t border-border-dark-light')}
        initial={false}
        animate={{
          flexGrow: isOpen ? 1 : 0,
          flexShrink: isOpen ? 1 : 0,
        }}
        transition={{ duration: 0.3, ease: 'easeIn' }}
      >
        {/* Outer section header */}
        <div
          className={clsx(
            'flex items-center px-2 select-none h-[40px] shrink-0 bg-bg-primary-light',
            !isOpen && 'cursor-pointer',
            isOpen && !updatedActions && 'border-b border-border-dark-light',
          )}
          onClick={onToggle}
        >
          <motion.div initial={false} animate={{ rotate: isOpen ? 0 : -90 }} transition={{ duration: 0.1 }} className="mr-1">
            <HiChevronDown className="w-4 h-4 text-text-muted" />
          </motion.div>

          <span className="text-xs font-semibold uppercase flex-grow text-text-secondary">{t('contextFiles.updatedFiles')}</span>

          <span className="text-2xs mr-2 bg-bg-secondary-light px-1.5 rounded-full">
            <span className="text-success">+{totalStats.additions}</span>
            <span className="ml-0.5 text-error">-{totalStats.deletions}</span>
          </span>

          <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
            {isOpen && updatedActions}
          </div>
        </div>

        {/* Content area */}
        <Activity mode={isOpen ? 'visible' : 'hidden'}>
          <div className="flex-grow w-full overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-bg-tertiary scrollbar-track-bg-primary-light scrollbar-rounded bg-bg-primary-light-strong relative">
            {hasAnyContent ? (
              <>
                {isGrouped
                  ? commitGroups.map((group) => {
                      const isGroupExpanded = expandedGroups.includes(group.id);
                      const tree = groupTreeData[group.id];
                      const expanded = groupExpandedItems[group.id] || [];
                      const isUncommitted = group.id === UNCOMMITTED_GROUP_ID;

                      return (
                        <div key={group.id}>
                          {renderCommitGroupHeader(group, isGroupExpanded)}

                          {isGroupExpanded && tree && (
                            <SectionContent
                              section={'updated' as SectionType}
                              treeData={tree}
                              expandedItems={expanded}
                              setExpandedItems={(items) =>
                                setGroupExpandedItems((prev) => ({
                                  ...prev,
                                  [group.id]: typeof items === 'function' ? items(prev[group.id] || []) : items,
                                }))
                              }
                              contextFilesMap={contextFilesMap}
                              updatedFiles={group.files}
                              tokensInfo={tokensInfo}
                              os={os}
                              onFileDiffClick={handleFileDiffClick}
                              onFilePreviewClick={onFilePreviewClick}
                              onRevertFile={(filePath) => {
                                if (isUncommitted) {
                                  handleRevertFile(filePath);
                                }
                              }}
                              onDropFile={dropFile}
                              onAddFile={addFile}
                            />
                          )}
                        </div>
                      );
                    })
                  : flatTreeData && (
                      <SectionContent
                        section={'updated' as SectionType}
                        treeData={flatTreeData}
                        expandedItems={flatExpandedItems}
                        setExpandedItems={(items) => setFlatExpandedItems(typeof items === 'function' ? items(flatExpandedItems) : items)}
                        contextFilesMap={contextFilesMap}
                        updatedFiles={updatedFiles}
                        tokensInfo={tokensInfo}
                        os={os}
                        onFileDiffClick={handleFileDiffClick}
                        onFilePreviewClick={onFilePreviewClick}
                        onRevertFile={handleRevertFile}
                        onDropFile={dropFile}
                        onAddFile={addFile}
                      />
                    )}
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-center text-text-muted text-2xs">{t('common.noFiles')}</div>
            )}
          </div>
        </Activity>
      </motion.div>

      <Activity mode={diffModalOpen ? 'visible' : 'hidden'}>
        <UpdatedFilesDiffModal
          key={`${taskId}-${diffModalSelectedFile?.path}-${diffModalSelectedFile?.commitHash}`}
          groups={diffModalGroups}
          initialFile={diffModalSelectedFile}
          onClose={() => setDiffModalOpen(false)}
          baseDir={baseDir}
          taskId={taskId}
          openInWindowUrl={`#${ROUTES.Diff}?${URL_PARAMS.PROJECT}=${encodeBaseDir(baseDir)}&${URL_PARAMS.TASK}=${taskId}`}
          openInWindowTitle={taskName ? t('contextFiles.updatedFilesWindowTitle', { name: taskName }) : undefined}
        />
      </Activity>

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
    </>
  );
};
