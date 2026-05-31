(props) => {
  const { useState, useEffect, useCallback, useMemo } = React;
  const { Button, ModalOverlayLayout, Tooltip } = props.ui;
  const { kanban: kanbanLib } = props.libraries;
  const { FiColumns } = props.icons.Fi;
  const projectDir = props.projectDir;
  const activateTask = props.activateTask;
  const tasks = props.data?.tasks || [];

  const COLUMNS = [
    { id: 'TODO', emoji: '📋', label: 'Todo' },
    { id: 'READY_FOR_IMPLEMENTATION', emoji: '🚀', label: 'Ready for Implementation' },
    { id: 'IN_PROGRESS', emoji: '⚙️', label: 'In Progress' },
    { id: 'MORE_INFO_NEEDED', emoji: '💬', label: 'More Info Needed' },
    { id: 'INTERRUPTED', emoji: '⏸️', label: 'Interrupted' },
    { id: 'DELEGATED', emoji: '🔄', label: 'Delegated' },
    { id: 'READY_FOR_REVIEW', emoji: '👀', label: 'Ready for Review' },
    { id: 'DONE', emoji: '✅', label: 'Done' }
  ];

  const [showModal, setShowModal] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!kanbanLib && !loadError) {
      const timer = setTimeout(() => setLoadError(true), 15000);
      return () => clearTimeout(timer);
    }
    setLoadError(false);
  }, [kanbanLib, loadError]);

  const handleOpen = () => setShowModal(true);
  const handleClose = () => setShowModal(false);

  const handleTaskClick = useCallback((taskId) => {
    handleClose();
    activateTask?.(taskId);
  }, [activateTask]);

  const boardData = useMemo(() => {
    const data = {
      root: { id: 'root', title: 'Root', parentId: null, children: COLUMNS.map((c) => c.id), totalChildrenCount: COLUMNS.length }
    };

    COLUMNS.forEach((col) => {
      const columnTasks = tasks.filter((t) => t.state === col.id || (!t.state && col.id === 'TODO'));
      const taskIds = columnTasks.map((t) => `task-${t.id}`);
      data[col.id] = {
        id: col.id,
        title: `${col.emoji} ${col.label}`,
        parentId: 'root',
        children: taskIds,
        totalChildrenCount: taskIds.length,
        totalItemsCount: taskIds.length
      };
      columnTasks.forEach((t) => {
        data[`task-${t.id}`] = {
          id: `task-${t.id}`,
          title: t.name,
          parentId: col.id,
          children: [],
          totalChildrenCount: 0,
          type: 'task',
          taskId: t.id,
          taskName: t.name,
          taskState: t.state,
          taskModel: t.model
        };
      });
    });

    return data;
  }, [tasks]);

  const configMap = useMemo(() => ({
    task: {
      render: ({ data: taskItem }) => (
        <div
          className="px-2.5 py-2 bg-bg-primary-light rounded-md border border-border-dark-light hover:bg-bg-primary-light-strong transition-colors cursor-pointer"
          onClick={(e) => { e.stopPropagation(); handleTaskClick(taskItem.taskId); }}
        >
          <span className="text-xs text-text-primary leading-snug line-clamp-2">{taskItem.taskName}</span>
          {taskItem.taskModel && (
            <span className="block mt-1 text-text-muted text-2xs truncate">{taskItem.taskModel}</span>
          )}
        </div>
      ),
      isDraggable: false
    }
  }), [handleTaskClick]);

  const renderColumnHeader = useCallback((column) => {
    const colDef = COLUMNS.find((c) => c.id === column.id);
    const count = column.totalChildrenCount;
    return (
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="text-2xs font-medium text-text-secondary uppercase">
          {colDef ? `${colDef.emoji} ${colDef.label}` : column.title}
        </span>
        {count > 0 && (
          <span className="text-3xs text-text-muted bg-bg-tertiary-emphasis px-1.5 py-0.5 rounded-full">{count}</span>
        )}
      </div>
    );
  }, []);

  const rootStyle = { backgroundColor: 'transparent', padding: '0', height: '100%' };
  const columnWrapperStyle = () => ({
    backgroundColor: 'var(--color-bg-secondary, #f0f0f0)',
    border: '1px solid var(--color-border-dark-light, #e0e0e0)',
    borderRadius: '8px',
    padding: '8px'
  });
  const columnStyle = () => ({ backgroundColor: 'transparent', minHeight: '60px' });
  const columnHeaderStyle = () => ({ backgroundColor: 'transparent', padding: '8px 4px 0 4px', borderBottom: 'none' });
  const columnListContentStyle = () => ({
    padding: '4px',
    scrollbarWidth: 'thin',
    scrollbarColor: 'var(--color-bg-secondary-light, #ccc) var(--color-bg-primary-light, #f0f0f0)'
  });

  if (!showModal) {
    const totalTasks = tasks.length;
    return (
      <Tooltip content={`Kanban Board${totalTasks > 0 ? ` — ${totalTasks} tasks` : ''}`}>
        <button
          className="p-1.5 rounded-md hover:bg-bg-tertiary transition-colors"
          onClick={handleOpen}
        >
          <FiColumns className="w-4 h-4 text-text-primary" />
        </button>
      </Tooltip>
    );
  }

  if (loadError && !kanbanLib) {
    return (
      <ModalOverlayLayout title="Kanban Board" onClose={handleClose} closeOnEscape={true}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-3">
            <p className="text-error text-sm">Failed to load the Kanban library.</p>
            <p className="text-text-muted text-xs">Check the console for details and verify your internet connection.</p>
            <Button onClick={handleClose} size="sm">Close</Button>
          </div>
        </div>
      </ModalOverlayLayout>
    );
  }

  if (!kanbanLib) {
    return (
      <ModalOverlayLayout title="Kanban Board" onClose={handleClose} closeOnEscape={true}>
        <div className="flex items-center justify-center h-full">
          <div className="flex items-center gap-2">
            <div className="animate-spin h-4 w-4 border-2 border-accent-primary border-t-transparent rounded-full"></div>
            <span className="text-text-secondary text-sm">Loading Kanban library...</span>
          </div>
        </div>
      </ModalOverlayLayout>
    );
  }

  const Kanban = kanbanLib.Kanban;

  return (
    <ModalOverlayLayout title="Kanban Board" onClose={handleClose} closeOnEscape={true}>
      <div className="flex-1 overflow-hidden p-3 h-full">
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center space-y-2">
              <p className="text-text-muted text-sm">No tasks found in this project.</p>
              <p className="text-text-muted text-xs">Create tasks in the sidebar to see them here.</p>
            </div>
          </div>
        ) : (
          <Kanban
            dataSource={boardData}
            configMap={configMap}
            renderColumnHeader={renderColumnHeader}
            rootStyle={rootStyle}
            rootClassName="scrollbar-thin scrollbar-thumb-bg-secondary-light scrollbar-track-bg-primary-light"
            columnWrapperStyle={columnWrapperStyle}
            columnStyle={columnStyle}
            columnHeaderStyle={columnHeaderStyle}
            columnListContentStyle={columnListContentStyle}
            cardsGap={4}
          />
        )}
      </div>
    </ModalOverlayLayout>
  );
};
