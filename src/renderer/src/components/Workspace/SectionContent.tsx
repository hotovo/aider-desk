import { ContextFile, OS, TokensInfoData, UpdatedFile } from '@common/types';
import React, { useCallback } from 'react';
import { ControlledTreeEnvironment, Tree } from 'react-complex-tree';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { TreeItemRenderer } from './TreeItemRenderer';

import type { SectionType, TreeItem } from './types';

type Props = {
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
  disabledRuleFiles?: string[];
  onToggleRuleFile?: (filePaths: string[], disabled: boolean) => void;
  onFileDiffClick: (file: UpdatedFile) => void;
  onFilePreviewClick?: (filePath: string) => void;
  onRevertFile: (filePath: string) => void;
  onDropFile: (item: TreeItem) => (e: React.MouseEvent<HTMLButtonElement>) => void;
  onAddFile: (item: TreeItem) => (event: React.MouseEvent<HTMLButtonElement>) => void;
};

export const SectionContent = ({
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
  disabledRuleFiles,
  onToggleRuleFile,
  onFileDiffClick,
  onFilePreviewClick,
  onRevertFile,
  onDropFile,
  onAddFile,
}: Props) => {
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
        disabledRuleFiles={disabledRuleFiles}
        onToggleRuleFile={onToggleRuleFile}
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
      disabledRuleFiles,
      onToggleRuleFile,
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
