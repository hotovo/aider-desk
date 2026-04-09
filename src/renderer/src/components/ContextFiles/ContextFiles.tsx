import { ContextFile, Mode, TokensInfoData } from '@common/types';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalStorage } from '@reactuses/core';
import { RiMenuUnfold4Line } from 'react-icons/ri';

import { UserContextFilesSection } from './UserContextFilesSection';
import { UpdatedFilesSection } from './UpdatedFilesSection';
import { ProjectFilesSection } from './ProjectFilesSection';
import { RulesSection } from './RulesSection';
import { FilePreviewModal } from './FilePreviewModal';
import { normalizePath } from './types';

import type { SectionType, TreeItem } from './types';

import { Tooltip } from '@/components/ui/Tooltip';
import { useOS } from '@/hooks/useOS';
import { useApi } from '@/contexts/ApiContext';

import './ContextFiles.css';

type Props = {
  baseDir: string;
  taskId: string;
  allFiles: string[];
  contextFiles: ContextFile[];
  showFileDialog: () => void;
  tokensInfo?: TokensInfoData | null;
  refreshAllFiles: (useGit?: boolean) => Promise<void>;
  mode: Mode;
  onToggleFilesSidebarCollapse?: () => void;
};

export const ContextFiles = ({
  baseDir,
  taskId,
  allFiles,
  contextFiles,
  showFileDialog,
  tokensInfo,
  refreshAllFiles,
  mode,
  onToggleFilesSidebarCollapse,
}: Props) => {
  const { t } = useTranslation();
  const os = useOS();
  const api = useApi();

  const [activeSection, setActiveSection] = useLocalStorage<SectionType>(`context-files-active-section-${baseDir}`, 'context');
  const [visitedSections, setVisitedSections] = useState<Set<SectionType>>(new Set(['context']));
  const [isDragging, setIsDragging] = useState(false);
  const [previewFilePath, setPreviewFilePath] = useState<string | null>(null);

  useEffect(() => {
    if (activeSection) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisitedSections((prev) => {
        if (prev.has(activeSection)) {
          return prev;
        }
        return new Set(prev).add(activeSection);
      });
    }
  }, [activeSection]);

  const contextFilesMap = useMemo(() => {
    const map = new Map<string, ContextFile>();
    contextFiles.forEach((file) => {
      map.set(normalizePath(file.path), file);
    });
    return map;
  }, [contextFiles]);

  const { rulesFiles, userContextFiles } = useMemo(() => {
    const rules: ContextFile[] = [];
    const user: ContextFile[] = [];
    contextFiles.forEach((file) => {
      if (file.source === 'global-rule' || file.source === 'project-rule' || file.source === 'agent-rule') {
        rules.push(file);
      } else {
        user.push(file);
      }
    });
    return { rulesFiles: rules, userContextFiles: user };
  }, [contextFiles]);

  const totalStats = useMemo(() => ({ additions: 0, deletions: 0 }), []);

  const handleDropAllFiles = useCallback(() => {
    api.runCommand(baseDir, taskId, 'drop');
  }, [api, baseDir, taskId]);

  const handleFilePreviewClick = useCallback((filePath: string) => {
    setPreviewFilePath(filePath);
  }, []);

  const handleClosePreviewModal = useCallback(() => {
    setPreviewFilePath(null);
  }, []);

  const dropFile = useCallback(
    (item: TreeItem) => (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      const file = item.file;
      if (file) {
        let pathToDrop = file.path;
        if (pathToDrop.startsWith(baseDir + '/') || pathToDrop.startsWith(baseDir + '\\') || pathToDrop === baseDir) {
          pathToDrop = pathToDrop.slice(baseDir.length + 1);
        }
        api.dropFile(baseDir, taskId, pathToDrop);
      } else if (item.isFolder) {
        api.dropFile(baseDir, taskId, String(item.index));
      }
    },
    [api, baseDir, taskId],
  );

  const addFile = useCallback(
    (item: TreeItem) => (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      const shouldBeReadOnly = event.ctrlKey || event.metaKey;
      const pathToAdd = item.file ? item.file.path : item.index;

      if (shouldBeReadOnly) {
        api.addFile(baseDir, taskId, String(pathToAdd), true);
      } else {
        api.addFile(baseDir, taskId, String(pathToAdd));
      }
    },
    [api, baseDir, taskId],
  );

  const handleFileDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);

      if (event.dataTransfer?.files) {
        const files = Array.from(event.dataTransfer.files);
        const droppedFilePaths = files.map((file) => api.getPathForFile(file));
        for (let filePath of droppedFilePaths) {
          const isValid = await api.isValidPath(baseDir, filePath);
          if (!isValid) {
            continue;
          }

          const isInsideProject = filePath.startsWith(baseDir + '/') || filePath.startsWith(baseDir + '\\') || filePath === baseDir;
          if (isInsideProject) {
            filePath = filePath.slice(baseDir.length + 1);
          }
          api.addFile(baseDir, taskId, filePath, !isInsideProject);
        }
      }
    },
    [api, baseDir, taskId],
  );

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const collapseButton = useMemo(
    () =>
      onToggleFilesSidebarCollapse ? (
        <Tooltip content={t('common.collapse')}>
          <button onClick={onToggleFilesSidebarCollapse} className="p-1.5 hover:bg-bg-tertiary rounded-md transition-colors">
            <RiMenuUnfold4Line className="w-4 h-4 rotate-180" />
          </button>
        </Tooltip>
      ) : undefined,
    [t, onToggleFilesSidebarCollapse],
  );

  return (
    <div
      className={`context-files-root flex-grow w-full h-full flex flex-col overflow-hidden bg-bg-primary-light-strong ${isDragging ? 'drag-over' : ''}`}
      onDrop={handleFileDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <UserContextFilesSection
        mode={mode}
        userContextFiles={userContextFiles}
        isOpen={activeSection === 'context'}
        totalStats={totalStats}
        tokensInfo={tokensInfo}
        os={os}
        contextFilesMap={contextFilesMap}
        showFileDialog={showFileDialog}
        onDropAllFiles={handleDropAllFiles}
        collapseButton={collapseButton}
        onToggle={() => setActiveSection('context')}
        onFilePreviewClick={handleFilePreviewClick}
        onDropFile={dropFile}
      />

      <UpdatedFilesSection
        baseDir={baseDir}
        taskId={taskId}
        isOpen={activeSection === 'updated'}
        tokensInfo={tokensInfo}
        os={os}
        contextFilesMap={contextFilesMap}
        visitedSections={visitedSections}
        onToggle={() => setActiveSection('updated')}
        onFilePreviewClick={handleFilePreviewClick}
      />

      <ProjectFilesSection
        baseDir={baseDir}
        allFiles={allFiles}
        isOpen={activeSection === 'project'}
        totalStats={totalStats}
        tokensInfo={tokensInfo}
        os={os}
        contextFilesMap={contextFilesMap}
        visitedSections={visitedSections}
        refreshAllFiles={refreshAllFiles}
        onToggle={() => setActiveSection('project')}
        onFilePreviewClick={handleFilePreviewClick}
        onDropFile={dropFile}
        onAddFile={addFile}
      />

      <RulesSection
        rulesFiles={rulesFiles}
        isOpen={activeSection === 'rules'}
        totalStats={totalStats}
        tokensInfo={tokensInfo}
        os={os}
        contextFilesMap={contextFilesMap}
        visitedSections={visitedSections}
        onToggle={() => setActiveSection('rules')}
      />

      {previewFilePath && <FilePreviewModal filePath={previewFilePath} baseDir={baseDir} onClose={handleClosePreviewModal} />}
    </div>
  );
};
