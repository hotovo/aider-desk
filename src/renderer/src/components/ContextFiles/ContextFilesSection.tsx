import { ContextFile, OS, TokensInfoData, UpdatedFile } from '@common/types';
import React, { Activity } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

import { SectionHeader } from './SectionHeader';
import { SectionContent } from './SectionContent';

import type { SectionType, TreeItem } from './types';

type Props = {
  section: SectionType;
  title: string;
  count: number;
  isOpen: boolean;
  totalStats: { additions: number; deletions: number };
  treeData: Record<string, TreeItem>;
  expandedItems: string[];
  setExpandedItems: React.Dispatch<React.SetStateAction<string[]>>;
  contextFilesMap: Map<string, ContextFile>;
  updatedFiles: UpdatedFile[];
  tokensInfo?: TokensInfoData | null;
  os: OS | null;
  actions?: React.ReactNode;
  alwaysVisibleActions?: React.ReactNode;
  searchField?: React.ReactNode;
  emptyContent?: React.ReactNode;
  showBorderTop?: boolean;
  onToggle: () => void;
  onFileDiffClick: (file: UpdatedFile) => void;
  onFilePreviewClick?: (filePath: string) => void;
  onRevertFile: (filePath: string) => void;
  onDropFile: (item: TreeItem) => (e: React.MouseEvent<HTMLButtonElement>) => void;
  onAddFile: (item: TreeItem) => (event: React.MouseEvent<HTMLButtonElement>) => void;
};

export const ContextFilesSection = ({
  section,
  title,
  count,
  isOpen,
  totalStats,
  treeData,
  expandedItems,
  setExpandedItems,
  contextFilesMap,
  updatedFiles,
  tokensInfo,
  os,
  actions,
  alwaysVisibleActions,
  searchField,
  emptyContent,
  showBorderTop = false,
  onToggle,
  onFileDiffClick,
  onFilePreviewClick,
  onRevertFile,
  onDropFile,
  onAddFile,
}: Props) => {
  return (
    <motion.div
      className={clsx('flex flex-col flex-grow overflow-hidden min-h-[40px]', showBorderTop && 'border-t border-border-dark-light')}
      initial={false}
      animate={{
        flexGrow: isOpen ? 1 : 0,
        flexShrink: isOpen ? 1 : 0,
      }}
      transition={{ duration: 0.3, ease: 'easeIn' }}
    >
      <SectionHeader
        section={section}
        title={title}
        count={count}
        isOpen={isOpen}
        totalStats={totalStats}
        actions={actions}
        alwaysVisibleActions={alwaysVisibleActions}
        onToggle={onToggle}
      />
      <Activity mode={isOpen ? 'visible' : 'hidden'}>
        <SectionContent
          section={section}
          treeData={treeData}
          expandedItems={expandedItems}
          setExpandedItems={setExpandedItems}
          contextFilesMap={contextFilesMap}
          updatedFiles={updatedFiles}
          tokensInfo={tokensInfo}
          os={os}
          searchField={searchField}
          emptyContent={emptyContent}
          onFileDiffClick={onFileDiffClick}
          onFilePreviewClick={onFilePreviewClick}
          onRevertFile={onRevertFile}
          onDropFile={onDropFile}
          onAddFile={onAddFile}
        />
      </Activity>
    </motion.div>
  );
};
