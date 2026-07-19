import { ContextFile, Mode, OS, TokensCost } from '@common/types';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { HiOutlineTrash, HiPlus } from 'react-icons/hi';
import { useTranslation } from 'react-i18next';

import { WorkspaceSection } from './WorkspaceSection';
import { EmptyContextInfo } from './EmptyContextInfo';
import { FileViewerModal } from './FileViewerModal';
import { createFileTree } from './types';

import type { TreeItem } from './types';

import { Tooltip } from '@/components/ui/Tooltip';

type Props = {
  mode: Mode;
  baseDir: string;
  taskId: string;
  userContextFiles: ContextFile[];
  isOpen: boolean;
  totalStats: { additions: number; deletions: number };
  fileTokensInfo?: Record<string, TokensCost> | null;
  os: OS | null;
  contextFilesMap: Map<string, ContextFile>;
  showFileDialog: () => void;
  onDropAllFiles: () => void;
  onToggle: () => void;
  onFilePreviewClick?: (filePath: string) => void;
  onDropFile: (item: TreeItem) => (e: React.MouseEvent<HTMLButtonElement>) => void;
  editMode?: boolean;
  isHidden?: boolean;
  onToggleHidden?: () => void;
  showBorderTop?: boolean;
};

export const ContextFilesSection = ({
  mode,
  baseDir,
  taskId,
  userContextFiles,
  isOpen,
  totalStats,
  fileTokensInfo,
  os,
  contextFilesMap,
  showFileDialog,
  onDropAllFiles,
  onToggle,
  onFilePreviewClick,
  onDropFile,
  editMode,
  isHidden,
  onToggleHidden,
  showBorderTop,
}: Props) => {
  const { t } = useTranslation();

  const [contextExpandedItems, setContextExpandedItems] = useState<string[]>([]);
  const [previewFilePath, setPreviewFilePath] = useState<string | null>(null);

  const sortedUserFiles = useMemo(() => {
    return [...userContextFiles].sort((a, b) => a.path.localeCompare(b.path));
  }, [userContextFiles]);

  const contextTreeData = useMemo(() => {
    return createFileTree(sortedUserFiles, 'root');
  }, [sortedUserFiles]);

  useEffect(() => {
    const expandFolders = (treeData: Record<string, TreeItem>, files: ContextFile[]) => {
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
            return files.some((f) => f.path === (childNode.file?.path || ''));
          }
          return childNode.children?.some(checkChild) || false;
        };
        return node.children?.some(checkChild) || false;
      });

      setContextExpandedItems((prevState) => Array.from(new Set([...prevState, ...foldersToExpand])));
    };

    expandFolders(contextTreeData, userContextFiles);
  }, [contextTreeData, userContextFiles]);

  const addFile = useCallback((_item: TreeItem) => (_event: React.MouseEvent<HTMLButtonElement>) => {}, []);

  const contextActions = useMemo(
    () => (
      <>
        <Tooltip content={t('contextFiles.dropAll')}>
          <button
            onClick={onDropAllFiles}
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
    [t, onDropAllFiles, userContextFiles.length, showFileDialog],
  );

  return (
    <>
      <WorkspaceSection
        section="context"
        title={t('contextFiles.title')}
        count={userContextFiles.length}
        isOpen={isOpen}
        totalStats={totalStats}
        treeData={contextTreeData}
        expandedItems={contextExpandedItems}
        setExpandedItems={setContextExpandedItems}
        contextFilesMap={contextFilesMap}
        updatedFiles={[]}
        fileTokensInfo={fileTokensInfo}
        os={os}
        actions={contextActions}
        emptyContent={<EmptyContextInfo mode={mode} />}
        onToggle={onToggle}
        onFileDiffClick={() => {}}
        onFilePreviewClick={(filePath: string) => {
          if (onFilePreviewClick) {
            onFilePreviewClick(filePath);
          } else {
            setPreviewFilePath(filePath);
          }
        }}
        onRevertFile={() => {}}
        onDropFile={onDropFile}
        onAddFile={addFile}
        editMode={editMode}
        isHidden={isHidden}
        onToggleHidden={onToggleHidden}
        showBorderTop={showBorderTop}
      />

      {previewFilePath && <FileViewerModal filePath={previewFilePath} baseDir={baseDir} taskId={taskId} onClose={() => setPreviewFilePath(null)} />}
    </>
  );
};
