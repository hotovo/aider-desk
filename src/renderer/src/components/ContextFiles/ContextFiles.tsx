import { ContextFile, Mode, TokensInfoData } from '@common/types';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalStorage } from '@reactuses/core';
import { RiMenuUnfold4Line, RiListSettingsLine } from 'react-icons/ri';
import { closestCenter, DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { clsx } from 'clsx';
import { MdDone } from 'react-icons/md';
import { AnimatePresence } from 'framer-motion';

import { UserContextFilesSection } from './UserContextFilesSection';
import { UpdatedFilesSection } from './UpdatedFilesSection';
import { ProjectFilesSection } from './ProjectFilesSection';
import { RulesSection } from './RulesSection';
import { SkillsSection } from './SkillsSection';
import { normalizePath } from './types';

import type { SectionType, TreeItem } from './types';

import { Tooltip } from '@/components/ui/Tooltip';
import { useOS } from '@/hooks/useOS';
import { useApi } from '@/contexts/ApiContext';
import { useProjectSettings } from '@/contexts/ProjectSettingsContext';

import './ContextFiles.css';

const ALL_SECTIONS: SectionType[] = ['context', 'updated', 'project', 'rules', 'skills'];

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
  taskName?: string;
};

type SortableSectionWrapperProps = {
  id: SectionType;
  editMode: boolean;
  isHidden: boolean;
  children: React.ReactNode;
};

const SortableSectionWrapper = ({ id, editMode, isHidden, children }: SortableSectionWrapperProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !editMode });

  const style = editMode
    ? {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 1 : isHidden ? 0.5 : 1,
      }
    : undefined;

  if (!editMode && isHidden) {
    return null;
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(editMode ? { ...attributes, ...listeners } : {})}
      className={clsx('flex flex-col shrink-0 min-h-0', editMode && 'touch-none')}
    >
      {children}
    </div>
  );
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
  taskName,
}: Props) => {
  const { t } = useTranslation();
  const os = useOS();
  const api = useApi();
  const { projectSettings, saveProjectSettings } = useProjectSettings();

  const [activeSection, setActiveSection] = useLocalStorage<SectionType>(`context-files-active-section-${baseDir}`, 'context');
  const [visitedSections, setVisitedSections] = useState<Set<SectionType>>(new Set(['context']));
  const [isDragging, setIsDragging] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const sectionsOrder = useMemo(() => projectSettings?.contextSidebarSectionsOrder ?? [], [projectSettings?.contextSidebarSectionsOrder]);
  const sectionsHidden = useMemo(() => new Set(projectSettings?.contextSidebarSectionsHidden ?? []), [projectSettings?.contextSidebarSectionsHidden]);

  const orderedSections = useMemo(() => {
    if (sectionsOrder.length === 0) {
      return ALL_SECTIONS;
    }
    const ordered = [...sectionsOrder].filter((s) => ALL_SECTIONS.includes(s as SectionType)) as SectionType[];
    for (const s of ALL_SECTIONS) {
      if (!ordered.includes(s)) {
        ordered.push(s);
      }
    }
    return ordered;
  }, [sectionsOrder]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor));

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

  const handleSectionDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }
      const oldIndex = orderedSections.indexOf(active.id as SectionType);
      const newIndex = orderedSections.indexOf(over.id as SectionType);
      if (oldIndex === -1 || newIndex === -1) {
        return;
      }
      const reordered = [...orderedSections];
      reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, active.id as SectionType);
      void saveProjectSettings({ contextSidebarSectionsOrder: reordered });
    },
    [orderedSections, saveProjectSettings],
  );

  const handleToggleSectionHidden = useCallback(
    (section: SectionType) => {
      const newHidden = new Set(sectionsHidden);
      if (newHidden.has(section)) {
        newHidden.delete(section);
      } else {
        newHidden.add(section);
      }
      void saveProjectSettings({
        contextSidebarSectionsHidden: Array.from(newHidden),
      });
    },
    [sectionsHidden, saveProjectSettings],
  );

  const handleEnterEditMode = useCallback(() => {
    setEditMode(true);
  }, []);

  const handleExitEditMode = useCallback(() => {
    setEditMode(false);
  }, []);

  const sectionProps = useMemo(
    () => ({
      editMode,
      isHidden: (section: SectionType) => sectionsHidden.has(section),
      onToggleHidden: handleToggleSectionHidden,
    }),
    [editMode, sectionsHidden, handleToggleSectionHidden],
  );

  const renderSection = (section: SectionType) => {
    switch (section) {
      case 'context':
        return (
          <UserContextFilesSection
            mode={mode}
            userContextFiles={userContextFiles}
            isOpen={activeSection === 'context' && !editMode}
            totalStats={totalStats}
            tokensInfo={tokensInfo}
            os={os}
            contextFilesMap={contextFilesMap}
            showFileDialog={showFileDialog}
            onDropAllFiles={handleDropAllFiles}
            onToggle={() => setActiveSection('context')}
            onDropFile={dropFile}
            editMode={editMode}
            isHidden={sectionProps.isHidden('context')}
            onToggleHidden={() => sectionProps.onToggleHidden('context')}
            showBorderTop={section !== orderedSections[0]}
          />
        );
      case 'updated':
        return (
          <UpdatedFilesSection
            baseDir={baseDir}
            taskId={taskId}
            isOpen={activeSection === 'updated' && !editMode}
            tokensInfo={tokensInfo}
            os={os}
            contextFilesMap={contextFilesMap}
            visitedSections={visitedSections}
            onToggle={() => setActiveSection('updated')}
            taskName={taskName}
            editMode={editMode}
            isHidden={sectionProps.isHidden('updated')}
            onToggleHidden={() => sectionProps.onToggleHidden('updated')}
            showBorderTop={section !== orderedSections[0]}
          />
        );
      case 'project':
        return (
          <ProjectFilesSection
            baseDir={baseDir}
            taskId={taskId}
            allFiles={allFiles}
            isOpen={activeSection === 'project' && !editMode}
            totalStats={totalStats}
            tokensInfo={tokensInfo}
            os={os}
            contextFilesMap={contextFilesMap}
            visitedSections={visitedSections}
            refreshAllFiles={refreshAllFiles}
            onToggle={() => setActiveSection('project')}
            onDropFile={dropFile}
            onAddFile={addFile}
            editMode={editMode}
            isHidden={sectionProps.isHidden('project')}
            onToggleHidden={() => sectionProps.onToggleHidden('project')}
            showBorderTop={section !== orderedSections[0]}
          />
        );
      case 'rules':
        return (
          <RulesSection
            rulesFiles={rulesFiles}
            isOpen={activeSection === 'rules' && !editMode}
            totalStats={totalStats}
            visitedSections={visitedSections}
            onToggle={() => setActiveSection('rules')}
            editMode={editMode}
            isHidden={sectionProps.isHidden('rules')}
            onToggleHidden={() => sectionProps.onToggleHidden('rules')}
            showBorderTop={section !== orderedSections[0]}
          />
        );
      case 'skills':
        return (
          <SkillsSection
            baseDir={baseDir}
            taskId={taskId}
            isOpen={activeSection === 'skills' && !editMode}
            totalStats={totalStats}
            visitedSections={visitedSections}
            onToggle={() => setActiveSection('skills')}
            editMode={editMode}
            isHidden={sectionProps.isHidden('skills')}
            onToggleHidden={() => sectionProps.onToggleHidden('skills')}
            showBorderTop={section !== orderedSections[0]}
          />
        );
    }
  };

  return (
    <div
      className={`context-files-root flex-grow w-full h-full flex flex-col overflow-hidden bg-bg-primary-light-strong ${isDragging ? 'drag-over' : ''}`}
      onDrop={handleFileDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="bg-bg-primary-light border-b border-border-dark-light shrink-0">
        <div className="flex items-center justify-between pl-1 pr-2 h-10">
          <AnimatePresence mode="wait">
            {editMode ? (
              <div className="flex items-center justify-between w-full pl-2">
                <span className="text-sm font-semibold uppercase text-text-secondary">{t('contextFiles.editSections')}</span>
                <Tooltip content={t('contextFiles.done')}>
                  <button onClick={handleExitEditMode} className="p-1 hover:bg-bg-tertiary rounded transition-colors">
                    <MdDone className="w-4 h-4 text-success" />
                  </button>
                </Tooltip>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1">
                  {onToggleFilesSidebarCollapse && (
                    <Tooltip content={t('common.collapse')}>
                      <button onClick={onToggleFilesSidebarCollapse} className="p-1 rounded-md hover:bg-bg-tertiary transition-colors">
                        <RiMenuUnfold4Line className="w-5 h-5 text-text-primary rotate-180" />
                      </button>
                    </Tooltip>
                  )}
                  <h3 className="text-sm font-semibold uppercase text-text-secondary">{t('contextFiles.workspaceTitle')}</h3>
                </div>
                <Tooltip content={t('contextFiles.editSections')}>
                  <button onClick={handleEnterEditMode} className="p-1 rounded-md hover:bg-bg-tertiary transition-colors">
                    <RiListSettingsLine className="w-4 h-4 text-text-primary" />
                  </button>
                </Tooltip>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
      {editMode ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
          <SortableContext items={orderedSections} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col flex-grow overflow-hidden">
              {orderedSections.map((section) => (
                <SortableSectionWrapper key={section} id={section} editMode={editMode} isHidden={sectionsHidden.has(section)}>
                  {renderSection(section)}
                </SortableSectionWrapper>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <>{orderedSections.map((section) => (sectionsHidden.has(section) ? null : <React.Fragment key={section}>{renderSection(section)}</React.Fragment>))}</>
      )}
    </div>
  );
};
