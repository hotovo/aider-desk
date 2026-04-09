import { ContextFile, Mode, OS, TokensInfoData } from '@common/types';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { HiOutlineTrash, HiPlus } from 'react-icons/hi';
import { useTranslation } from 'react-i18next';

import { ContextFilesSection } from './ContextFilesSection';
import { EmptyContextInfo } from './EmptyContextInfo';
import { createFileTree } from './types';

import type { TreeItem } from './types';

import { Tooltip } from '@/components/ui/Tooltip';

type Props = {
  mode: Mode;
  userContextFiles: ContextFile[];
  isOpen: boolean;
  totalStats: { additions: number; deletions: number };
  tokensInfo?: TokensInfoData | null;
  os: OS | null;
  contextFilesMap: Map<string, ContextFile>;
  showFileDialog: () => void;
  onDropAllFiles: () => void;
  collapseButton?: React.ReactNode;
  onToggle: () => void;
  onFilePreviewClick: (filePath: string) => void;
  onDropFile: (item: TreeItem) => (e: React.MouseEvent<HTMLButtonElement>) => void;
};

export const UserContextFilesSection = ({
  mode,
  userContextFiles,
  isOpen,
  totalStats,
  tokensInfo,
  os,
  contextFilesMap,
  showFileDialog,
  onDropAllFiles,
  collapseButton,
  onToggle,
  onFilePreviewClick,
  onDropFile,
}: Props) => {
  const { t } = useTranslation();

  const [contextExpandedItems, setContextExpandedItems] = useState<string[]>([]);

  const sortedUserFiles = useMemo(() => {
    return [...userContextFiles].sort((a, b) => a.path.localeCompare(b.path));
  }, [userContextFiles]);

  const contextTreeData = useMemo(() => {
    return createFileTree(sortedUserFiles, 'root');
  }, [sortedUserFiles]);

  useEffect(() => {
    const expandFolders = (treeData: Record<string, TreeItem>, files: ContextFile[], currentExpanded: string[]) => {
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

      setContextExpandedItems(Array.from(new Set([...currentExpanded, ...foldersToExpand])));
    };

    expandFolders(contextTreeData, userContextFiles, contextExpandedItems);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <ContextFilesSection
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
      tokensInfo={tokensInfo}
      os={os}
      actions={contextActions}
      alwaysVisibleActions={collapseButton}
      emptyContent={<EmptyContextInfo mode={mode} />}
      onToggle={onToggle}
      onFileDiffClick={() => {}}
      onFilePreviewClick={onFilePreviewClick}
      onRevertFile={() => {}}
      onDropFile={onDropFile}
      onAddFile={addFile}
    />
  );
};
