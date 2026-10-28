import { ReactNode } from 'react';
import { act, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AutonomyMode, DefaultTaskState, TaskExecutionMode, ToolMessage } from '@common/types';

import { RunPromptToolMessage } from '../RunPromptToolMessage';
import { CreateTaskToolMessage } from '../CreateTaskToolMessage';

import { setProjectTasks, useProjectStore } from '@/stores/projectStore';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/components/message/ExpandableMessageBlock', () => ({
  ExpandableMessageBlock: ({ title, content }: { title: ReactNode; content: ReactNode }) => (
    <div>
      <header>{title}</header>
      <section>{content}</section>
    </div>
  ),
}));

vi.mock('@/components/ui/Tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => children,
}));

const createMessage = (args: ToolMessage['args'] = {}, result: unknown = { state: DefaultTaskState.ReadyForReview }): ToolMessage => ({
  id: 'tool-call',
  type: 'tool',
  serverName: 'tasks',
  toolName: 'run_prompt',
  args,
  content: result === undefined ? '' : JSON.stringify(result),
});

const setTaskName = (baseDir: string, name: string) => {
  setProjectTasks(baseDir, [{ id: 'target', baseDir, name, aiderTotalCost: 0, agentTotalCost: 0, mainModel: 'test-model' }]);
};

const header = () => within(document.querySelector('header')!);

describe('RunPromptToolMessage', () => {
  beforeEach(() => {
    useProjectStore.setState({ projectTasksMap: new Map() });
  });

  it('shows the project-scoped task name in tertiary text, keeping the prompt in details', () => {
    setTaskName('/project', 'Implement feature');
    setTaskName('/other', 'Other project task');
    render(<RunPromptToolMessage baseDir="/project" message={createMessage({ taskId: 'target', prompt: 'Detailed instructions' })} />);

    expect(header().getByText('Implement feature')).toHaveClass('text-text-tertiary');
    expect(header().queryByText('Detailed instructions')).not.toBeInTheDocument();
    expect(screen.queryByText('Other project task')).not.toBeInTheDocument();
    expect(screen.getByText('Detailed instructions')).toBeInTheDocument();
  });

  it.each([undefined, ''])('omits the prompt box when prompt is %s and falls back to task ID', (prompt) => {
    const { container } = render(<RunPromptToolMessage baseDir="/project" message={createMessage({ taskId: 'target', prompt })} />);
    expect(header().getByText('target')).toBeInTheDocument();
    expect(header().getByText('toolMessage.tasks.runPrompt')).toBeInTheDocument();
    expect(container.querySelector('pre')).not.toBeInTheDocument();
  });

  it('updates the task name reactively in compact mode', () => {
    render(<RunPromptToolMessage baseDir="/project" message={createMessage({ taskId: 'target', prompt: 'Instructions' })} compact />);
    expect(screen.getByText('target')).toBeInTheDocument();
    act(() => setTaskName('/project', 'Renamed task'));
    expect(screen.getByText('Renamed task')).toHaveClass('text-text-tertiary');
    expect(screen.queryByText('Instructions')).not.toBeInTheDocument();
  });

  it.each([
    [{}, 'waitForFinish'],
    [{ executionMode: TaskExecutionMode.WaitForFinish }, 'waitForFinish'],
    [{ executionMode: TaskExecutionMode.RunInBackground }, 'runInBackground'],
    [{ executeAndWait: true }, 'waitForFinish'],
    [{ executeAndWait: false }, 'runInBackground'],
    [{ executionMode: TaskExecutionMode.WaitForFinish, executeAndWait: false }, 'waitForFinish'],
  ])('renders execution mode for %j', (args, label) => {
    render(<RunPromptToolMessage baseDir="/project" message={createMessage({ taskId: 'target', ...args })} />);
    expect(screen.getByText('toolMessage.tasks.executionMode:').parentElement).toHaveTextContent(`toolMessage.tasks.${label}`);
  });

  it.each([
    [AutonomyMode.Manual, 'common.autonomyManual'],
    [AutonomyMode.Guided, 'common.autonomyGuided'],
    [AutonomyMode.Autonomous, 'common.autonomyAutonomous'],
  ])('translates explicit autonomy %s without inventing an omitted autonomy setting', (autonomyMode, labelKey) => {
    const { rerender } = render(<RunPromptToolMessage baseDir="/project" message={createMessage({ taskId: 'target', autonomyMode })} />);
    expect(screen.getByText('toolMessage.tasks.autonomyMode:').parentElement).toHaveTextContent(labelKey);
    rerender(<RunPromptToolMessage baseDir="/project" message={createMessage({ taskId: 'target' })} />);
    expect(screen.queryByText('toolMessage.tasks.autonomyMode:')).not.toBeInTheDocument();
  });

  it.each([
    'Cannot run the current task from its own task tool',
    'Task target is already running',
    'Task target has no saved prompt or conversation to resume. Provide a prompt.',
    'Task with ID target not found',
    'Error running prompt on task: Failed',
  ])('renders execution failure as an error: %s', (result) => {
    const { container } = render(<RunPromptToolMessage baseDir="/project" message={createMessage({ taskId: 'target' }, result)} />);
    expect(screen.getByText(result)).toHaveClass('text-error');
    expect(container.querySelector('svg.text-error')).toBeInTheDocument();
    expect(container.querySelector('svg.text-success')).not.toBeInTheDocument();
  });

  it('keeps approval denial distinct from execution errors', () => {
    const { container } = render(
      <RunPromptToolMessage baseDir="/project" message={createMessage({}, 'Running prompt on task denied by user. Reason: Denied')} />,
    );
    expect(container.querySelector('svg.text-warning')).toBeInTheDocument();
    expect(container.querySelector('svg.text-error')).not.toBeInTheDocument();
  });
});

describe('CreateTaskToolMessage', () => {
  it('prefers the returned name and keeps the prompt in expanded details', () => {
    render(<CreateTaskToolMessage message={createMessage({ name: 'Supplied name', prompt: 'Full instructions' }, { id: 'target', name: 'Generated name' })} />);
    expect(header().getByText('Generated name')).toHaveClass('text-text-tertiary');
    expect(header().queryByText('Full instructions')).not.toBeInTheDocument();
    expect(screen.getByText('Full instructions')).toBeInTheDocument();
    expect(screen.queryByText('Supplied name')).not.toBeInTheDocument();
  });

  it.each([
    [{ name: 'Supplied name', prompt: 'Full instructions' }, '', 'Supplied name'],
    [{ name: 'Supplied name', prompt: 'Full instructions' }, { name: '' }, 'Supplied name'],
    [{ prompt: 'Full instructions' }, '', 'Full instructions'],
  ])('falls back to supplied name or prompt for %j', (args, result, expected) => {
    render(<CreateTaskToolMessage message={createMessage(args, result)} compact />);
    expect(screen.getByText(expected)).toHaveClass('text-text-tertiary');
  });

  it('shows the returned name in compact mode', () => {
    render(<CreateTaskToolMessage message={createMessage({ prompt: 'Full instructions' }, { name: 'Generated name' })} compact />);
    expect(screen.getByText('Generated name')).toHaveClass('text-text-tertiary');
    expect(screen.queryByText('Full instructions')).not.toBeInTheDocument();
  });
});
