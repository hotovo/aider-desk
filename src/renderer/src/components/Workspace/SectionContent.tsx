import { ContextFile, OS, TokensCost, UpdatedFile } from '@common/types';
import { Dispatch, MouseEvent, ReactNode, RefObject, SetStateAction } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { Tree } from './Tree';
import { SectionLoading } from './SectionLoading';

import type { SectionType, TreeItem } from './types';

type Props = {
  section: SectionType;
  treeData: Record<string, TreeItem>;
  expandedItems: string[];
  setExpandedItems: Dispatch<SetStateAction<string[]>>;
  contextFilesMap: Map<string, ContextFile>;
  updatedFiles: UpdatedFile[];
  fileTokensInfo?: Record<string, TokensCost> | null;
  os: OS | null;
  searchField?: ReactNode;
  emptyContent?: ReactNode;
  isLoading?: boolean;
  disabledRuleFiles?: string[];
  onToggleRuleFile?: (filePaths: string[], disabled: boolean) => void;
  onFileDiffClick: (file: UpdatedFile) => void;
  onFilePreviewClick?: (filePath: string) => void;
  onAddFileToGit?: (filePath: string) => void;
  addingFilesToGit?: Set<string>;
  onRevertFile: (filePath: string) => void;
  onDropFile: (item: TreeItem) => (e: MouseEvent<HTMLButtonElement>) => void;
  onAddFile: (item: TreeItem) => (event: MouseEvent<HTMLButtonElement>) => void;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
};

export const SectionContent = ({ ...props }: Props) => {
  const { t } = useTranslation();
  const hasContent = Object.keys(props.treeData).length > 1;

  return (
    <>
      {props.searchField && (
        <div className="px-2 py-2 border-b border-border-dark-light bg-bg-primary-light" onClick={(e) => e.stopPropagation()}>
          {props.searchField}
        </div>
      )}

      <motion.div
        className="flex-grow w-full flex flex-col overflow-hidden scrollbar-thin scrollbar-thumb-bg-tertiary scrollbar-track-bg-primary-light scrollbar-rounded bg-bg-primary-light-strong relative"
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        {props.isLoading ? (
          <SectionLoading label={t('common.loadingFiles')} />
        ) : hasContent ? (
          <Tree
            section={props.section}
            treeData={props.treeData}
            expandedItems={props.expandedItems}
            setExpandedItems={props.setExpandedItems}
            contextFilesMap={props.contextFilesMap}
            updatedFiles={props.updatedFiles}
            fileTokensInfo={props.fileTokensInfo}
            os={props.os}
            disabledRuleFiles={props.disabledRuleFiles}
            onToggleRuleFile={props.onToggleRuleFile}
            onFileDiffClick={props.onFileDiffClick}
            onFilePreviewClick={props.onFilePreviewClick}
            onAddFileToGit={props.onAddFileToGit}
            addingFilesToGit={props.addingFilesToGit}
            onRevertFile={props.onRevertFile}
            onDropFile={props.onDropFile}
            onAddFile={props.onAddFile}
            scrollContainerRef={props.scrollContainerRef}
          />
        ) : props.emptyContent ? (
          props.emptyContent
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-center text-text-muted text-2xs">{t('common.noFiles')}</div>
        )}
      </motion.div>
    </>
  );
};
