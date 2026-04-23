import { ContextFile, OS, TokensInfoData, UpdatedFile } from '@common/types';
import { useCallback, useMemo } from 'react';
import { HiChevronDown, HiChevronRight, HiPlus, HiX } from 'react-icons/hi';
import { MdUndo, MdOutlinePublic } from 'react-icons/md';
import { TbPencilOff } from 'react-icons/tb';
import { RiAlertLine, RiRobot2Line } from 'react-icons/ri';
import { VscFileCode } from 'react-icons/vsc';
import { useTranslation } from 'react-i18next';
import { twMerge } from 'tailwind-merge';

import { normalizePath } from './types';

import type { SectionType, TreeItem } from './types';

import { Tooltip } from '@/components/ui/Tooltip';
import { TriStateCheckbox } from '@/components/common/TriStateCheckbox';

type TriState = 'checked' | 'unchecked' | 'indeterminate';

type Props = {
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
  disabledRuleFiles?: string[];
  onToggleRuleFile?: (filePaths: string[], disabled: boolean) => void;
  onFileDiffClick: (file: UpdatedFile) => void;
  onFilePreviewClick?: (filePath: string) => void;
  onRevertFile: (filePath: string) => void;
  onDropFile: (item: TreeItem) => (e: React.MouseEvent<HTMLButtonElement>) => void;
  onAddFile: (item: TreeItem) => (event: React.MouseEvent<HTMLButtonElement>) => void;
};

export const TreeItemRenderer = ({
  item,
  title,
  children,
  type,
  treeData,
  expandedItems,
  setExpandedItems,
  contextFilesMap,
  updatedFiles,
  tokensInfo,
  disabledRuleFiles,
  onToggleRuleFile,
  onFileDiffClick,
  onFilePreviewClick,
  onRevertFile,
  onDropFile,
  onAddFile,
}: Props) => {
  const { t } = useTranslation();

  const source = item.file?.source;
  const isRuleFile = source === 'global-rule' || source === 'project-rule' || source === 'agent-rule';
  const filePath = item.file?.path;
  const isContextFile = filePath ? contextFilesMap.has(normalizePath(filePath)) : false;
  const showRuleCheckbox = type === 'rules' && isRuleFile && !item.isFolder && onToggleRuleFile;
  const isRuleDisabled = isRuleFile && filePath ? (disabledRuleFiles ?? []).includes(filePath) : false;
  const showFolderCheckbox = type === 'rules' && item.isFolder && onToggleRuleFile;

  const getDescendantRuleFiles = useCallback(
    (nodeId: string | number): string[] => {
      const node = treeData[String(nodeId)];
      if (!node?.children) return [];
      const result: string[] = [];
      for (const childId of node.children) {
        const child = treeData[String(childId)];
        if (!child) continue;
        if (child.isFolder) {
          result.push(...getDescendantRuleFiles(childId));
        } else if (child.file?.path) {
          result.push(child.file.path);
        }
      }
      return result;
    },
    [treeData],
  );

  const folderRuleFiles = useMemo(() => {
    if (!showFolderCheckbox) return [];
    return getDescendantRuleFiles(item.index);
  }, [showFolderCheckbox, getDescendantRuleFiles, item.index]);

  const folderCheckState = useMemo((): TriState => {
    if (!showFolderCheckbox || folderRuleFiles.length === 0) return 'unchecked';
    const disabled = disabledRuleFiles ?? [];
    const enabledCount = folderRuleFiles.filter((p) => !disabled.includes(p)).length;
    if (enabledCount === 0) return 'unchecked';
    if (enabledCount === folderRuleFiles.length) return 'checked';
    return 'indeterminate';
  }, [showFolderCheckbox, folderRuleFiles, disabledRuleFiles]);

  const handleFileCheckboxToggle = useCallback(() => {
    if (filePath && onToggleRuleFile) {
      onToggleRuleFile([filePath], !isRuleDisabled);
    }
  }, [filePath, onToggleRuleFile, isRuleDisabled]);

  const handleFolderCheckboxToggle = useCallback(() => {
    if (!onToggleRuleFile || folderRuleFiles.length === 0) return;
    const newState = folderCheckState === 'checked';
    onToggleRuleFile(folderRuleFiles, newState);
  }, [onToggleRuleFile, folderCheckState, folderRuleFiles]);

  const updatedFile = type === 'updated' ? updatedFiles.find((f) => normalizePath(f.path) === normalizePath(item.file?.path || '')) : undefined;

  const showAdd = type === 'project' && !isContextFile && !isRuleFile;
  const showRemove = (type === 'context' || (type === 'project' && isContextFile)) && !isRuleFile;
  const showRevert = type === 'updated' && updatedFile && !item.isFolder && !updatedFile.commitHash;
  const showConflictWarning = type === 'updated' && updatedFile?.hasConflicts && !item.isFolder;

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
    } else if (type === 'project' && filePath && onFilePreviewClick) {
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
          {showFolderCheckbox && folderRuleFiles.length > 0 && (
            <TriStateCheckbox state={folderCheckState} onChange={handleFolderCheckboxToggle} />
          )}
          {showRuleCheckbox && (
            <TriStateCheckbox
              state={isRuleDisabled ? 'unchecked' : 'checked'}
              onChange={handleFileCheckboxToggle}
            />
          )}
          {showConflictWarning && (
            <Tooltip content={t('contextFiles.fileHasConflicts')}>
              <RiAlertLine className="w-4 h-4 text-warning" />
            </Tooltip>
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
