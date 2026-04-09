import { ContextFile, OS, TokensInfoData, UpdatedFile } from '@common/types';
import React, { Activity, useCallback, useEffect, useMemo, useState } from 'react';
import { MdOutlineDifference, MdOutlineRefresh } from 'react-icons/md';
import { useTranslation } from 'react-i18next';

import { UpdatedFilesDiffModal } from './UpdatedFilesDiffModal';
import { ContextFilesSection } from './ContextFilesSection';
import { normalizePath, createFileTree } from './types';

import type { TreeItem } from './types';

import { Tooltip } from '@/components/ui/Tooltip';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useApi } from '@/contexts/ApiContext';

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
};

export const UpdatedFilesSection = ({ baseDir, taskId, isOpen, tokensInfo, os, contextFilesMap, visitedSections, onToggle, onFilePreviewClick }: Props) => {
  const { t } = useTranslation();
  const api = useApi();

  const [updatedFiles, setUpdatedFiles] = useState<UpdatedFile[]>([]);
  const [updatedExpandedItems, setUpdatedExpandedItems] = useState<string[]>([]);
  const [isRefreshingUpdated, setIsRefreshingUpdated] = useState(false);
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [diffModalFileIndex, setDiffModalFileIndex] = useState(0);
  const [fileToRevert, setFileToRevert] = useState<string | null>(null);
  const [isRevertingFile, setIsRevertingFile] = useState(false);

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

  const updatedTreeData = useMemo(() => {
    if (!visitedSections.has('updated')) {
      return { root: { index: 'root', children: [], isFolder: true, data: 'root' } as TreeItem };
    }
    const allFileObjects: ContextFile[] = updatedFiles.map((f) => ({
      path: f.path,
    }));
    return createFileTree(allFileObjects, 'root');
  }, [visitedSections, updatedFiles]);

  useEffect(() => {
    if (Object.keys(updatedTreeData).length > 1) {
      const allFolders = Object.keys(updatedTreeData).filter((key) => updatedTreeData[key].isFolder);
      setUpdatedExpandedItems(Array.from(new Set([...updatedExpandedItems, ...allFolders])));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updatedTreeData]);

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
      </>
    ),
    [t, updatedFiles.length, handleRefreshUpdatedFiles, isRefreshingUpdated],
  );

  return (
    <>
      <ContextFilesSection
        section="updated"
        title={t('contextFiles.updatedFiles')}
        count={updatedFiles.length}
        isOpen={isOpen}
        totalStats={totalStats}
        treeData={updatedTreeData}
        expandedItems={updatedExpandedItems}
        setExpandedItems={setUpdatedExpandedItems}
        contextFilesMap={contextFilesMap}
        updatedFiles={updatedFiles}
        tokensInfo={tokensInfo}
        os={os}
        actions={updatedActions}
        showBorderTop
        onToggle={onToggle}
        onFileDiffClick={handleFileDiffClick}
        onFilePreviewClick={onFilePreviewClick}
        onRevertFile={handleRevertFile}
        onDropFile={dropFile}
        onAddFile={addFile}
      />

      <Activity mode={diffModalOpen ? 'visible' : 'hidden'}>
        <UpdatedFilesDiffModal
          key={taskId}
          files={sortedUpdatedFiles}
          initialFileIndex={diffModalFileIndex}
          onClose={() => setDiffModalOpen(false)}
          baseDir={baseDir}
          taskId={taskId}
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
