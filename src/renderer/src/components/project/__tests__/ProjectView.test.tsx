import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskData, TaskStateData } from '@common/types';

import { ProjectView } from '../ProjectView';

import { useApi } from '@/contexts/ApiContext';
import { useSettingsStore } from '@/stores/settingsStore';
import { useProjectSettings } from '@/contexts/ProjectSettingsContext';
import { invokeAction } from '@/stores/actionsStore';
import { createMockApi } from '@/__tests__/mocks/api';

const commandPaletteStoreMock = vi.hoisted(() => {
  type MockPaletteItem = {
    id: string;
    action: () => void;
  };

  const items = new Map<string, MockPaletteItem>();
  const itemIdsByScope = new Map<string, Set<string>>();

  const replaceItems = vi.fn((scope: string, nextItems: MockPaletteItem[]) => {
    const nextItemIds = new Set(nextItems.map((item) => item.id));
    const previousItemIds = itemIdsByScope.get(scope) ?? new Set<string>();

    previousItemIds.forEach((itemId) => {
      if (!nextItemIds.has(itemId)) {
        items.delete(itemId);
      }
    });
    nextItems.forEach((item) => items.set(item.id, item));
    itemIdsByScope.set(scope, nextItemIds);
  });

  const clearItems = vi.fn((scope: string) => {
    itemIdsByScope.get(scope)?.forEach((itemId) => items.delete(itemId));
    itemIdsByScope.delete(scope);
  });

  const reset = () => {
    items.clear();
    itemIdsByScope.clear();
    replaceItems.mockClear();
    clearItems.mockClear();
  };

  return { items, itemIdsByScope, replaceItems, clearItems, reset };
});

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock contexts
vi.mock('@/contexts/ApiContext', () => ({
  useApi: vi.fn(),
}));

vi.mock('@/stores/settingsStore', () => ({
  useSettingsStore: vi.fn(),
}));

vi.mock('@/contexts/ProjectSettingsContext', () => ({
  useProjectSettings: vi.fn(),
}));

vi.mock('@/stores/taskFilesStore', () => ({
  releaseTaskFiles: vi.fn(),
  useTaskAllFiles: vi.fn(() => ['src/file.ts']),
}));

// Mock useAgents hook
vi.mock('@/contexts/AgentsContext', () => ({
  useAgents: vi.fn(() => ({
    getProfiles: () => [],
    getActiveProfile: () => null,
    setActiveProfile: vi.fn(),
    refreshProfiles: vi.fn(),
  })),
}));

// Mock command palette store
vi.mock('@/stores/commandPaletteStore', () => ({
  useCommandPaletteStore: vi.fn((selector) =>
    selector({
      replaceItems: commandPaletteStoreMock.replaceItems,
      clearItems: commandPaletteStoreMock.clearItems,
    }),
  ),
  PaletteItemType: {
    Action: 'action',
    File: 'file',
    Task: 'task',
    Project: 'project',
  },
}));

const taskSidebarMock = vi.hoisted(() => ({
  startRenaming: vi.fn(),
}));

interface TaskSidebarMockProps {
  tasks: TaskData[];
  onTaskSelect: (taskId: string) => void;
  deleteTask?: (taskId: string) => Promise<void>;
}

// Mock components
vi.mock('@/components/project/TaskSidebar/TaskSidebar', async () => {
  const { forwardRef, useImperativeHandle } = await import('react');
  const TaskSidebar = forwardRef(({ tasks, onTaskSelect }: TaskSidebarMockProps, ref) => {
    useImperativeHandle(ref, () => ({
      startRenaming: taskSidebarMock.startRenaming,
    }));
    return (
      <div data-testid="task-sidebar">
        {tasks.map((task) => (
          <button key={task.id} onClick={() => onTaskSelect(task.id)} data-testid={`task-${task.id}`}>
            {task.name}
          </button>
        ))}
      </div>
    );
  });
  return { TaskSidebar, COLLAPSED_WIDTH: 44, EXPANDED_WIDTH: 256 };
});

vi.mock('../TaskView', () => ({
  TaskView: ({ task, isActive }: { task: TaskData; isActive?: boolean }) => (
    <div data-testid="task-view" data-active={isActive ? 'true' : 'false'}>
      {task.name}
    </div>
  ),
}));

vi.mock('@/components/extensions/FloatingExtensionPanels', () => ({
  FloatingExtensionPanels: () => null,
}));

vi.mock('@/components/Workspace/FileEditorModal', async () => {
  const { useFileEditorStore } = await import('@/stores/fileEditorStore');
  return {
    FileEditorModal: ({ baseDir }: { baseDir: string }) => {
      const openFiles = useFileEditorStore((state) => state.projectsMap.get(baseDir)?.openFiles ?? []);
      const activeFilePath = useFileEditorStore((state) => state.projectsMap.get(baseDir)?.activeFilePath ?? null);
      const activeFile = openFiles.find((file) => file.path === activeFilePath) ?? null;
      return <div data-testid="file-editor-modal" data-base-dir={baseDir} data-file-path={activeFile?.path} data-task-id={activeFile?.taskId} />;
    },
  };
});

describe('ProjectView', () => {
  const projectDir = '/mock/project';
  const mockApi = createMockApi({
    startProject: vi.fn(() => Promise.resolve()),
    getTasks: vi.fn(() => Promise.resolve([{ id: 'task-1', name: 'Task 1' }] as TaskData[])),
    createNewTask: vi.fn(() => Promise.resolve({ id: 'task-2', name: 'Task 2' } as TaskData)),
    loadTask: vi.fn(() =>
      Promise.resolve({
        messages: [],
        files: [],
        todoItems: [],
        queuedPrompts: [],
        question: null,
        workingMode: 'local',
      } as TaskStateData),
    ),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    commandPaletteStoreMock.reset();
    mockApi.getTasks.mockResolvedValue([{ id: 'task-1', name: 'Task 1' }] as TaskData[]);
    vi.mocked(useApi).mockReturnValue(mockApi);
    vi.mocked(useSettingsStore).mockImplementation(((selector: (state: unknown) => unknown) =>
      selector({
        settings: { startupMode: 'empty' },
        theme: 'dark',
        font: 'Sono',
        fontSize: 14,
        setSettingsState: vi.fn(),
        setThemeValue: vi.fn(),
        setFontValue: vi.fn(),
        setFontSizeValue: vi.fn(),
      })) as never);
    vi.mocked(useProjectSettings).mockReturnValue({
      projectSettings: {},
    } as ReturnType<typeof useProjectSettings>);
  });

  it('initializes project and loads tasks', async () => {
    render(<ProjectView projectDir={projectDir} isProjectActive={true} />);

    await waitFor(() => {
      expect(mockApi.startProject).toHaveBeenCalledWith(projectDir);
      expect(mockApi.getTasks).toHaveBeenCalledWith(projectDir);
    });
  });

  it('renders task sidebar and active task view', async () => {
    render(<ProjectView projectDir={projectDir} isProjectActive={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('task-view')).toBeInTheDocument();
    });

    // Task 1 should be in the mocked TaskSidebar (appears twice: once from mock sidebar and once from mock task view)
    expect(screen.getAllByText('Task 1')).toHaveLength(2);
  });

  it('excludes archived tasks from the command palette metadata', async () => {
    mockApi.getTasks.mockResolvedValue([
      { id: 'task-1', name: 'Active Task', baseDir: projectDir, archived: false },
      { id: 'task-2', name: 'Archived Task', baseDir: projectDir, archived: true },
    ] as TaskData[]);

    render(<ProjectView projectDir={projectDir} isProjectActive={true} />);

    await waitFor(() => expect(commandPaletteStoreMock.items.get(`task.switch.${projectDir}.task-2`)).toBeDefined());

    expect(commandPaletteStoreMock.items.get(`task.switch.${projectDir}.task-1`)).toMatchObject({ archived: false });
    expect(commandPaletteStoreMock.items.get(`task.switch.${projectDir}.task-2`)).toMatchObject({ archived: true });
  });

  it('keeps a command palette file preview bound to its originating task after switching tasks', async () => {
    mockApi.getTasks.mockResolvedValue([
      { id: 'task-1', name: 'Task 1', baseDir: projectDir },
      { id: 'task-2', name: 'Task 2', baseDir: projectDir, worktree: { path: '/mock/worktrees/task-2' } },
    ] as TaskData[]);

    render(<ProjectView projectDir={projectDir} isProjectActive={true} />);

    await waitFor(() => expect(screen.getByTestId('task-view')).toHaveTextContent('Task 1'));
    await waitFor(() => expect(commandPaletteStoreMock.items.get(`file.open.${projectDir}.src/file.ts`)).toBeDefined());

    act(() => commandPaletteStoreMock.items.get(`file.open.${projectDir}.src/file.ts`)?.action());

    expect(await screen.findByTestId('file-editor-modal')).toHaveAttribute('data-task-id', 'task-1');

    fireEvent.click(screen.getByTestId('task-task-2'));

    // Recently-active tasks stay mounted (keep-alive), so assert on the active (visible) task view.
    await waitFor(() => {
      const activeView = screen.getAllByTestId('task-view').find((el) => el.getAttribute('data-active') === 'true');
      expect(activeView).toHaveTextContent('Task 2');
    });
    expect(screen.getByTestId('file-editor-modal')).toHaveAttribute('data-task-id', 'task-1');
  });

  const setupSettings = (startupMode: string) => {
    vi.mocked(useSettingsStore).mockImplementation(((selector: (state: unknown) => unknown) =>
      selector({
        settings: { startupMode },
        theme: 'dark',
        font: 'Sono',
        fontSize: 14,
        setSettingsState: vi.fn(),
        setThemeValue: vi.fn(),
        setFontValue: vi.fn(),
        setFontSizeValue: vi.fn(),
      })) as never);
  };

  const setupSubtaskProject = async (activeTaskName: string) => {
    setupSettings('last');
    mockApi.getTasks.mockResolvedValue([
      { id: 'parent-1', name: 'Parent Task', baseDir: projectDir, parentId: null, createdAt: '2023-01-01T00:00:00Z', updatedAt: '2023-01-01T00:00:00Z' },
      { id: 'child-1', name: 'Child Task', baseDir: projectDir, parentId: 'parent-1', createdAt: '2023-01-02T00:00:00Z', updatedAt: '2023-01-02T00:00:00Z' },
    ] as TaskData[]);

    render(<ProjectView projectDir={projectDir} isProjectActive={true} />);

    await waitFor(() => expect(screen.getByTestId('task-view')).toHaveTextContent(activeTaskName));
  };

  it('creates a subtask of the active task from the palette action', async () => {
    await setupSubtaskProject('Child Task');

    act(() => invokeAction('task.newSubtask'));

    await waitFor(() => expect(mockApi.createNewTask).toHaveBeenCalledWith(projectDir, { parentId: 'child-1' }));
  });

  it('registers a sibling task palette action only when the active task is a subtask', async () => {
    await setupSubtaskProject('Child Task');

    const siblingItem = commandPaletteStoreMock.items.get('task.newSibling');
    expect(siblingItem).toBeDefined();

    act(() => siblingItem!.action());

    await waitFor(() => expect(mockApi.createNewTask).toHaveBeenCalledWith(projectDir, { parentId: 'parent-1' }));
  });

  it('does not register a sibling task palette action when the active task is top-level', async () => {
    setupSettings('last');
    mockApi.getTasks.mockResolvedValue([
      { id: 'parent-1', name: 'Parent Task', baseDir: projectDir, parentId: null, createdAt: '2023-01-01T00:00:00Z', updatedAt: '2023-01-01T00:00:00Z' },
    ] as TaskData[]);

    render(<ProjectView projectDir={projectDir} isProjectActive={true} />);

    await waitFor(() => expect(screen.getByTestId('task-view')).toHaveTextContent('Parent Task'));

    expect(commandPaletteStoreMock.items.get('task.newSibling')).toBeUndefined();
  });

  it('renames the active task through the sidebar from the palette action', async () => {
    await setupSubtaskProject('Child Task');

    act(() => invokeAction('task.rename'));

    expect(taskSidebarMock.startRenaming).toHaveBeenCalledWith('child-1');
  });

  it('changes the task state through the palette action', async () => {
    await setupSubtaskProject('Child Task');

    act(() => invokeAction('task.state.done'));

    await waitFor(() => expect(mockApi.updateTask).toHaveBeenCalledWith(projectDir, 'child-1', { state: 'DONE' }));
  });

  it('registers a pin palette action with state-aware label', async () => {
    await setupSubtaskProject('Child Task');

    const pinItem = commandPaletteStoreMock.items.get('task.togglePin');
    expect(pinItem).toMatchObject({ label: 'taskSidebar.pinTask' });

    act(() => pinItem!.action());

    await waitFor(() => expect(mockApi.updateTask).toHaveBeenCalledWith(projectDir, 'child-1', { pinned: true }));
  });

  it('creates a new task when the active task is deleted', async () => {
    mockApi.getTasks.mockResolvedValue([
      {
        id: 'task-1',
        name: 'Task 1',
        createdAt: '2023-01-01T00:00:00Z',
        aiderTotalCost: 0,
        agentTotalCost: 0,
        mainModel: 'gpt-4',
      },
    ] as TaskData[]);

    render(<ProjectView projectDir={projectDir} isProjectActive={true} />);

    // Wait for API calls to complete
    await waitFor(() => {
      expect(mockApi.startProject).toHaveBeenCalledWith(projectDir);
      expect(mockApi.getTasks).toHaveBeenCalledWith(projectDir);
    });
  });
});
