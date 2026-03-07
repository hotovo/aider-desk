import { ProjectData } from '@common/types';
import { CSS } from '@dnd-kit/utilities';
import { MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Tab, TabGroup, TabList, Listbox, ListboxButton, ListboxOption, ListboxOptions, Transition } from '@headlessui/react';
import { clsx } from 'clsx';
import { CgSpinner } from 'react-icons/cg';
import { MdAdd, MdClose, MdChevronLeft, MdChevronRight } from 'react-icons/md';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, arrayMove, useSortable, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { useTranslation } from 'react-i18next';
import { HiChevronDown, HiCheck } from 'react-icons/hi2';

import type { DragEndEvent } from '@dnd-kit/core';

import { MenuOption, useContextMenu } from '@/contexts/ContextMenuContext';
import { useProjectProcessingState } from '@/stores/projectStore';
import { useResponsive } from '@/hooks/useResponsive';

type Props = {
  openProjects: ProjectData[];
  activeProject: string | undefined;
  onAddProject: () => void;
  onSetActiveProject: (baseDir: string) => void;
  onCloseProject: (baseDir: string) => void;
  onCloseOtherProjects: (baseDir: string) => void;
  onCloseAllProjects: () => void;
  onReorderProjects: (projects: ProjectData[]) => void;
};

export const ProjectTabs = ({
  openProjects,
  activeProject,
  onAddProject,
  onSetActiveProject,
  onCloseOtherProjects,
  onCloseProject,
  onCloseAllProjects,
  onReorderProjects,
}: Props) => {
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftScrollButton, setShowLeftScrollButton] = useState(false);
  const [showRightScrollButton, setShowRightScrollButton] = useState(false);
  const [dragging, setDragging] = useState(false);
  const { isMobile } = useResponsive();

  const checkScrollButtonsVisibility = () => {
    const container = tabsContainerRef.current;
    if (container) {
      const { scrollWidth, clientWidth, scrollLeft } = container;
      setShowLeftScrollButton(scrollLeft > 0);
      setShowRightScrollButton(scrollLeft + clientWidth < scrollWidth);
    }
  };

  const handleScroll = () => {
    checkScrollButtonsVisibility();
  };

  const handleScrollLeft = () => {
    if (tabsContainerRef.current) {
      tabsContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    if (tabsContainerRef.current) {
      tabsContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    checkScrollButtonsVisibility();

    const container = tabsContainerRef.current;
    if (!container) {
      return;
    }
    const resizeObserver = new ResizeObserver(checkScrollButtonsVisibility);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [openProjects, activeProject]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 300,
        distance: 0,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = openProjects.findIndex((p) => p.baseDir === active.id);
      const newIndex = openProjects.findIndex((p) => p.baseDir === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        onReorderProjects(arrayMove(openProjects, oldIndex, newIndex));
      }
    }

    event.activatorEvent.preventDefault();
    event.activatorEvent.stopPropagation();
    setTimeout(() => {
      setDragging(false);
    }, 0);
  };

  // useMemo for project IDs to prevent SortableContext from re-rendering unnecessarily
  const projectIds = useMemo(() => openProjects.map((p) => p.baseDir), [openProjects]);

  if (isMobile) {
    const selectedProject = openProjects.find((p) => p.baseDir === activeProject);

    return (
      <div className="flex items-center gap-2 px-2 py-2 min-w-0 flex-1">
        {activeProject && (
          <Listbox value={activeProject} onChange={onSetActiveProject}>
            <div className="relative flex-1 min-w-0">
              <ListboxButton className="flex w-full items-center justify-between gap-2 px-2 py-1 text-sm text-text-primary focus:outline-none">
                <span className="flex-1 min-w-0 truncate text-left">{selectedProject?.baseDir.split(/[\\/]/).pop()}</span>
                <HiChevronDown className="h-4 w-4 flex-shrink-0 text-text-muted" aria-hidden="true" />
              </ListboxButton>
              <Transition
                as="div"
                leave="transition ease-in duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
                className="absolute left-0 top-full z-50 mt-2"
              >
                <ListboxOptions className="max-h-60 max-w-[300px] overflow-auto rounded-sm bg-bg-primary py-1 shadow-lg ring-1 ring-border-default focus:outline-none">
                  {openProjects.map((project) => (
                    <MobileTabItem key={project.baseDir} project={project} />
                  ))}
                </ListboxOptions>
              </Transition>
            </div>
          </Listbox>
        )}
        <button
          className="flex-shrink-0 rounded-md px-3 py-2 text-text-muted hover:text-text-secondary hover:bg-bg-secondary-light transition-colors duration-200"
          onClick={onAddProject}
        >
          <MdAdd className="h-5 w-5" />
        </button>
      </div>
    );
  }

  return (
    <TabGroup
      className="overflow-x-hidden flex-1"
      selectedIndex={openProjects.findIndex((p) => p.baseDir === activeProject)}
      onChange={(index) => {
        if (openProjects[index] && !dragging) {
          onSetActiveProject(openProjects[index].baseDir);
        }
      }}
    >
      <TabList className="flex items-center relative overflow-hidden">
        {showLeftScrollButton && (
          <button
            className="absolute left-0 z-10 h-full flex items-center px-2 bg-bg-primary-light hover:bg-bg-secondary transition-colors duration-200"
            onClick={handleScrollLeft}
          >
            <MdChevronLeft className="h-5 w-5 text-text-muted-light" />
          </button>
        )}
        <div ref={tabsContainerRef} className="flex items-center overflow-x-hidden overflox-y-hidden scroll-smooth scrollbar-none" onScroll={handleScroll}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={() => setDragging(true)} onDragEnd={handleDragEnd}>
            <SortableContext items={projectIds} strategy={horizontalListSortingStrategy}>
              {openProjects.map((project) => (
                <SortableTabItem
                  key={project.baseDir}
                  project={project}
                  isActive={activeProject === project.baseDir}
                  onCloseProject={onCloseProject}
                  onCloseOtherProjects={onCloseOtherProjects}
                  onCloseAllProjects={onCloseAllProjects}
                  openProjectsNumber={openProjects.length}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
        {showRightScrollButton && (
          <button
            className="absolute right-[52px] z-10 h-full flex items-center px-2 bg-bg-primary-light hover:bg-bg-secondary transition-colors duration-200"
            onClick={handleScrollRight}
          >
            <MdChevronRight className="h-5 w-5 text-text-muted-light" />
          </button>
        )}
        <button
          className="px-4 py-2 text-text-muted-light hover:text-text-secondary hover:bg-bg-secondary transition-colors duration-200 flex items-center justify-center"
          onClick={onAddProject}
        >
          <MdAdd className="h-5 w-5" />
        </button>
      </TabList>
    </TabGroup>
  );
};

type MobileTabItemProps = {
  project: ProjectData;
};

const MobileTabItem = ({ project }: MobileTabItemProps) => {
  const isProcessing = useProjectProcessingState(project.baseDir);

  return (
    <ListboxOption
      value={project.baseDir}
      className={({ focus, selected }) =>
        clsx(
          'relative cursor-pointer select-none py-2 pl-9 pr-3 text-sm transition-colors',
          focus ? 'bg-bg-secondary-light text-text-primary' : 'text-text-muted',
          selected && 'text-text-primary font-medium',
        )
      }
    >
      {({ selected }) => (
        <>
          <div className="flex items-center gap-2">
            <span className="block truncate">{project.baseDir.split(/[\\/]/).pop()}</span>
            {isProcessing && <CgSpinner className="h-3 w-3 animate-spin text-text-primary flex-shrink-0" />}
          </div>
          {selected && (
            <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-text-tertiary">
              <HiCheck className="h-3 w-3" aria-hidden="true" />
            </span>
          )}
        </>
      )}
    </ListboxOption>
  );
};

type SortableTabItemProps = {
  project: ProjectData;
  isActive: boolean;
  onCloseProject: (baseDir: string) => void;
  onCloseOtherProjects: (baseDir: string) => void;
  onCloseAllProjects: () => void;
  openProjectsNumber: number;
};

const SortableTabItem = ({ project, isActive, onCloseProject, onCloseOtherProjects, onCloseAllProjects, openProjectsNumber }: SortableTabItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.baseDir });
  const { showMenu } = useContextMenu();
  const { t } = useTranslation();
  const isProcessing = useProjectProcessingState(project.baseDir);

  const handleRightClick = (event: MouseEvent) => {
    event.preventDefault();

    const options: MenuOption[] = [
      {
        label: t('contextMenu.close'),
        action: () => onCloseProject(project.baseDir),
      },
    ];

    if (openProjectsNumber > 1) {
      options.push(
        {
          label: t('contextMenu.closeOtherTabs'),
          action: () => onCloseOtherProjects(project.baseDir),
        },
        {
          label: t('contextMenu.closeAllTabs'),
          action: () => onCloseAllProjects(),
        },
      );
    }

    showMenu(event.clientX, event.clientY, options, event.target as Element);
  };

  const style = {
    transform: CSS.Transform.toString({
      x: transform ? transform.x : 0,
      y: transform ? transform.y : 0,
      scaleX: 1,
      scaleY: 1,
    }),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none">
      <Tab
        onContextMenu={handleRightClick}
        className={({ selected }) =>
          clsx(
            'text-sm pl-3 py-2 pr-1 border-r border-border-dark-light transition-all duration-200 ease-in-out flex items-center gap-3 relative whitespace-nowrap focus:outline-none',
            selected
              ? 'bg-gradient-to-b from-bg-secondary-light to-bg-secondary-light text-text-primary font-medium'
              : 'bg-gradient-to-b from-bg-primary to-bg-primary-light text-text-muted hover:bg-bg-secondary-light-strongest hover:text-text-tertiary',
          )
        }
      >
        {project.baseDir.split(/[\\/]/).pop()}
        <div
          className={clsx(
            'flex items-center justify-center rounded-full p-1 transition-colors duration-200 z-10',
            isActive ? 'hover:bg-bg-fourth' : 'hover:bg-bg-tertiary-strong',
            isProcessing ? 'cursor-default' : '',
          )}
          onClick={(e) => {
            if (isProcessing) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            e.preventDefault();
            e.stopPropagation(); // Prevent tab selection/drag initiation
            onCloseProject(project.baseDir);
          }}
        >
          {isProcessing ? (
            <CgSpinner className="h-3.5 w-3.5 animate-spin text-text-primary" />
          ) : (
            <MdClose className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100 transition-opacity duration-200" />
          )}
        </div>
      </Tab>
    </div>
  );
};
