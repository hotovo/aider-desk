import { ContextFile, OS, TokensCost, UpdatedFile } from '@common/types';
import { memo, MouseEvent, useCallback, useMemo } from 'react';
import { HiChevronDown, HiChevronRight, HiPlus, HiX } from 'react-icons/hi';
import { MdUndo, MdOutlinePublic } from 'react-icons/md';
import { TbPencilOff } from 'react-icons/tb';
import { RiAlertLine, RiRobot2Line } from 'react-icons/ri';
import { VscFileCode } from 'react-icons/vsc';
import { useTranslation } from 'react-i18next';
import { twMerge } from 'tailwind-merge';

import { INDENT_PX, normalizePath } from './types';

import type { SectionType, TreeItem } from './types';

import { Tooltip } from '@/components/ui/Tooltip';
import { TriState, TriStateCheckbox } from '@/components/common/TriStateCheckbox';

type Props = {
  item: TreeItem;
  title: string;
  level: number;
  isExpanded: boolean;
  onToggleFolder: (itemId: string | number) => void;
  type: SectionType;
  treeData: Record<string, TreeItem>;
  contextFilesMap: Map<string, ContextFile>;
  updatedFiles: UpdatedFile[];
  fileTokensInfo?: Record<string, TokensCost> | null;
  os: OS | null;
  disabledRuleFiles?: string[];
  onToggleRuleFile?: (filePaths: string[], disabled: boolean) => void;
  onFileDiffClick: (file: UpdatedFile) => void;
  onFilePreviewClick?: (filePath: string) => void;
  onAddFileToGit?: (filePath: string) => void;
  addingFilesToGit?: Set<string>;
  onRevertFile: (filePath: string) => void;
  onDropFile: (item: TreeItem) => (e: MouseEvent<HTMLButtonElement>) => void;
  onAddFile: (item: TreeItem) => (event: MouseEvent<HTMLButtonElement>) => void;
};

const getDescendantRuleFilesLocal = (treeData: Record<string, TreeItem>, nodeId: string | number): string[] => {
  const node = treeData[String(nodeId)];
  if (!node?.children) {
    return [];
  }
  const result: string[] = [];
  for (const childId of node.children) {
    const child = treeData[String(childId)];
    if (!child) {
      continue;
    }
    if (child.isFolder) {
      result.push(...getDescendantRuleFilesLocal(treeData, childId));
    } else if (child.file?.path) {
      result.push(child.file.path);
    }
  }
  return result;
};

export const TreeItemRenderer = ({
  item,
  title,
  level,
  isExpanded,
  onToggleFolder,
  type,
  treeData,
  contextFilesMap,
  updatedFiles,
  fileTokensInfo,
  disabledRuleFiles,
  onToggleRuleFile,
  onFileDiffClick,
  onFilePreviewClick,
  onAddFileToGit,
  addingFilesToGit,
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

  const folderRuleFiles = useMemo(() => {
    if (!showFolderCheckbox) {
      return [];
    }
    return getDescendantRuleFilesLocal(treeData, item.index);
  }, [showFolderCheckbox, treeData, item.index]);

  const folderCheckState = useMemo((): TriState => {
    if (!showFolderCheckbox || folderRuleFiles.length === 0) {
      return 'unchecked';
    }
    const disabled = disabledRuleFiles ?? [];
    const enabledCount = folderRuleFiles.filter((p) => !disabled.includes(p)).length;
    if (enabledCount === 0) {
      return 'unchecked';
    }
    if (enabledCount === folderRuleFiles.length) {
      return 'checked';
    }
    return 'indeterminate';
  }, [showFolderCheckbox, folderRuleFiles, disabledRuleFiles]);

  const handleFileCheckboxToggle = useCallback(() => {
    if (filePath && onToggleRuleFile) {
      onToggleRuleFile([filePath], !isRuleDisabled);
    }
  }, [filePath, onToggleRuleFile, isRuleDisabled]);

  const handleFolderCheckboxToggle = useCallback(() => {
    if (!onToggleRuleFile || folderRuleFiles.length === 0) {
      return;
    }
    const newState = folderCheckState === 'checked';
    onToggleRuleFile(folderRuleFiles, newState);
  }, [onToggleRuleFile, folderCheckState, folderRuleFiles]);

  const updatedFile = type === 'updated' ? updatedFiles.find((f) => normalizePath(f.path) === normalizePath(item.file?.path || '')) : undefined;

  const showAdd = type === 'project' && !isContextFile && !isRuleFile;
  const showRemove = (type === 'context' || (type === 'project' && isContextFile)) && !isRuleFile;
  const showAddToGit = type === 'updated' && updatedFile?.isUntracked && !item.isFolder && !updatedFile.commitHash && onAddFileToGit;
  const showRevert = type === 'updated' && updatedFile && !item.isFolder && !updatedFile.commitHash && !updatedFile.isUntracked;
  const showConflictWarning = type === 'updated' && updatedFile?.hasConflicts && !item.isFolder;
  const isAddingToGit = updatedFile ? addingFilesToGit?.has(updatedFile.path) : false;

  const fileTokenInfo = fileTokensInfo?.[item.index];
  const fileTokenTooltip = fileTokenInfo ? `${fileTokenInfo.tokens || 0} ${t('usageDashboard.charts.tokens')}, $${(fileTokenInfo.cost || 0).toFixed(5)}` : '';

  const toggleFolder = useCallback(() => {
    onToggleFolder(item.index);
  }, [item.index, onToggleFolder]);

  const handleChevronClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      toggleFolder();
    },
    [toggleFolder],
  );

  const handleTitleClick = useCallback(
    (e: MouseEvent) => {
      if (item.isFolder) {
        e.stopPropagation();
        toggleFolder();
      } else if (filePath && (type === 'project' || type === 'context') && onFilePreviewClick) {
        e.stopPropagation();
        onFilePreviewClick(filePath);
      }
    },
    [item.isFolder, toggleFolder, type, filePath, onFilePreviewClick],
  );

  const handleUpdatedFileClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      if (updatedFile) {
        onFileDiffClick(updatedFile);
      }
    },
    [updatedFile, onFileDiffClick],
  );

  const handleAddToGitClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      if (updatedFile && onAddFileToGit) {
        onAddFileToGit(updatedFile.path);
      }
    },
    [updatedFile, onAddFileToGit],
  );

  const handleRevertClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      if (updatedFile) {
        onRevertFile(updatedFile.path);
      }
    },
    [updatedFile, onRevertFile],
  );

  const renderChevron = () => {
    if (!item.isFolder) {
      return <span className="w-3 h-3 inline-block flex-shrink-0" />;
    }
    return (
      <span className="flex items-center justify-center cursor-pointer" onClick={handleChevronClick}>
        {isExpanded ? <HiChevronDown className="w-3 h-3 text-text-muted-dark" /> : <HiChevronRight className="w-3 h-3 text-text-muted-dark" />}
      </span>
    );
  };

  const renderTitle = () => {
    const className = twMerge(
      'select-none text-2xs overflow-hidden whitespace-nowrap overflow-ellipsis',
      item.isFolder
        ? 'context-dimmed'
        : type === 'updated' && updatedFile?.isUntracked
          ? 'text-text-muted-light'
          : type === 'project' && !isContextFile
            ? 'context-dimmed'
            : 'text-text-primary',
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

      if ((type === 'project' || type === 'context') && !item.isFolder && filePath) {
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
    <div className="flex space-between items-center w-full pr-1 h-6 group/item" style={{ paddingLeft: `${level * INDENT_PX}px` }}>
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
        {showFolderCheckbox && folderRuleFiles.length > 0 && <TriStateCheckbox state={folderCheckState} onChange={handleFolderCheckboxToggle} />}
        {showRuleCheckbox && <TriStateCheckbox state={isRuleDisabled ? 'unchecked' : 'checked'} onChange={handleFileCheckboxToggle} />}
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
        {showAddToGit && (
          <Tooltip content={t('contextFiles.addFileToGit')}>
            <button
              onClick={handleAddToGitClick}
              disabled={isAddingToGit}
              className="px-1 py-1 rounded hover:bg-bg-primary-light text-text-muted-light hover:text-text-primary disabled:opacity-50"
            >
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
  );
};

export const MemoizedTreeItemRenderer = memo(TreeItemRenderer);
