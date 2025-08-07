import { ProjectData } from '@common/types';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Tab, TabGroup, TabList } from '@headlessui/react';
import clsx from 'clsx';
import { MdAdd, MdClose, MdChevronLeft, MdChevronRight } from 'react-icons/md';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, arrayMove, useSortable, horizontalListSortingStrategy } from '@dnd-kit/sortable';

import type { DragEndEvent } from '@dnd-kit/core';

type Props = {
  openProjects: ProjectData[];
  activeProject: ProjectData | undefined;
  onAddProject: () => void;
  onSetActiveProject: (baseDir: string) => void;
  onCloseProject: (projectBaseDir: string) => void;
  onReorderProjects: (projects: ProjectData[]) => void;
};

export const ProjectTabs = ({ openProjects, activeProject, onAddProject, onSetActiveProject, onCloseProject, onReorderProjects }: Props) => {
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftScrollButton, setShowLeftScrollButton] = useState(false);
  const [showRightScrollButton, setShowRightScrollButton] = useState(false);
  const [dragging, setDragging] = useState(false);

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

  return (
    <TabGroup
      className="overflow-x-hidden flex-1"
      selectedIndex={openProjects.findIndex((p) => p.baseDir === activeProject?.baseDir)}
      onChange={(index) => {
        if (openProjects[index] && !dragging) {
          onSetActiveProject(openProjects[index].baseDir);
        }
      }}
    >
      <TabList className="flex items-center relative overflow-hidden">
        {showLeftScrollButton && (
          <button
            className="absolute left-0 z-10 h-full flex items-center px-2 bg-bg-primaryLight hover:bg-bg-secondary transition-colors duration-200"
            onClick={handleScrollLeft}
          >
            <MdChevronLeft className="h-5 w-5 text-text-mutedLight" />
          </button>
        )}
        <div ref={tabsContainerRef} className="flex items-center overflow-x-hidden overflox-y-hidden scroll-smooth scrollbar-none" onScroll={handleScroll}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={() => setDragging(true)} onDragEnd={handleDragEnd}>
            <SortableContext items={projectIds} strategy={horizontalListSortingStrategy}>
              {openProjects.map((project) => (
                <SortableTabItem key={project.baseDir} project={project} activeProject={activeProject} onCloseProject={onCloseProject} />
              ))}
            </SortableContext>
          </DndContext>
        </div>
        {showRightScrollButton && (
          <button
            className="absolute right-[52px] z-10 h-full flex items-center px-2 bg-bg-primaryLight hover:bg-bg-secondary transition-colors duration-200"
            onClick={handleScrollRight}
          >
            <MdChevronRight className="h-5 w-5 text-text-mutedLight" />
          </button>
        )}
        <button
          className="px-4 py-2 text-text-mutedLight hover:text-text-secondary hover:bg-bg-secondary transition-colors duration-200 flex items-center justify-center"
          onClick={onAddProject}
        >
          <MdAdd className="h-5 w-5" />
        </button>
      </TabList>
    </TabGroup>
  );
};

type SortableTabItemProps = {
  project: ProjectData;
  activeProject: ProjectData | undefined;
  onCloseProject: (projectBaseDir: string) => void;
};

const SortableTabItem = ({ project, activeProject, onCloseProject }: SortableTabItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.baseDir });

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
        className={({ selected }) =>
          clsx(
            'text-sm pl-3 py-2 pr-1 border-r border-border-darkLight transition-all duration-200 ease-in-out flex items-center gap-3 relative whitespace-nowrap',
            selected
              ? 'bg-gradient-to-b from-bg-secondaryLight to-bg-secondaryLight text-text-primary font-medium'
              : 'bg-gradient-to-b from-bg-primary to-bg-primaryLight text-text-muted hover:bg-bg-secondaryLight80 hover:text-text-tertiary',
          )
        }
      >
        {project.baseDir.split(/[\\/]/).pop()}
        <div
          className={clsx(
            'flex items-center justify-center rounded-full p-1 transition-colors duration-200 z-10',
            activeProject?.baseDir === project.baseDir ? 'hover:bg-bg-fourth' : 'hover:bg-bg-tertiary50',
          )}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation(); // Prevent tab selection/drag initiation
            onCloseProject(project.baseDir);
          }}
        >
          <MdClose className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100 transition-opacity duration-200" />
        </div>
      </Tab>
    </div>
  );
};
