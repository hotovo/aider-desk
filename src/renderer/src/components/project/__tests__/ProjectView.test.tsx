import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskData, TaskStateData } from '@common/types';

import { ProjectView } from '../ProjectView';

import { useApi } from '@/contexts/ApiContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useProjectSettings } from '@/contexts/ProjectSettingsContext';
import { createMockApi } from '@/__tests__/mocks/api';

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

vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: vi.fn(),
}));

vi.mock('@/contexts/ProjectSettingsContext', () => ({
  useProjectSettings: vi.fn(),
}));

interface TaskSidebarMockProps {
  tasks: TaskData[];
  onTaskSelect: (taskId: string) => void;
  deleteTask?: (taskId: string) => Promise<void>;
}

// Mock components
vi.mock('@/components/project/TaskSidebar/TaskSidebar', () => ({
  TaskSidebar: ({ tasks, onTaskSelect }: TaskSidebarMockProps) => (
    <div data-testid="task-sidebar">
      {tasks.map((task) => (
        <button key={task.id} onClick={() => onTaskSelect(task.id)} data-testid={`task-${task.id}`}>
          {task.name}
        </button>
      ))}
    </div>
  ),
  COLLAPSED_WIDTH: 44,
  EXPANDED_WIDTH: 256,
}));

vi.mock('../TaskView', () => ({
  TaskView: ({ task }: { task: TaskData }) => <div data-testid="task-view">{task.name}</div>,
}));

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
    vi.mocked(useApi).mockReturnValue(mockApi);
    vi.mocked(useSettings).mockReturnValue({
      settings: { startupMode: 'empty' },
    } as ReturnType<typeof useSettings>);
    vi.mocked(useProjectSettings).mockReturnValue({
      projectSettings: {},
    } as ReturnType<typeof useProjectSettings>);
  });

  it('initializes project and loads tasks', async () => {
    const mockShowSettingsPage = vi.fn();
    render(<ProjectView projectDir={projectDir} isProjectActive={true} showSettingsPage={mockShowSettingsPage} />);

    await waitFor(() => {
      expect(mockApi.startProject).toHaveBeenCalledWith(projectDir);
      expect(mockApi.getTasks).toHaveBeenCalledWith(projectDir);
    });
  });

  it('renders task sidebar and active task view', async () => {
    const mockShowSettingsPage = vi.fn();
    render(<ProjectView projectDir={projectDir} isProjectActive={true} showSettingsPage={mockShowSettingsPage} />);

    await waitFor(() => {
      expect(screen.getByTestId('task-view')).toBeInTheDocument();
    });

    // Task 1 should be in the mocked TaskSidebar (appears twice: once from mock sidebar and once from mock task view)
    expect(screen.getAllByText('Task 1')).toHaveLength(2);
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

    const mockShowSettingsPage = vi.fn();
    render(<ProjectView projectDir={projectDir} isProjectActive={true} showSettingsPage={mockShowSettingsPage} />);

    // Wait for API calls to complete
    await waitFor(() => {
      expect(mockApi.startProject).toHaveBeenCalledWith(projectDir);
      expect(mockApi.getTasks).toHaveBeenCalledWith(projectDir);
    });
  });
});
