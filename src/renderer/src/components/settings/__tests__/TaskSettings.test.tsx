import { fireEvent, render, screen, within } from '@testing-library/react';
import { ChangeEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ContextCompactionType, Model, SettingsData } from '@common/types';

import { TaskSettings } from '../TaskSettings';

vi.mock('@/hooks/useModes', () => ({ useModes: () => [] }));
vi.mock('@/components/common/InfoIcon', () => ({ InfoIcon: () => null }));
vi.mock('@/components/common/ModelSelectorWrapper', () => ({
  ModelSelectorWrapper: ({
    selectedModelId,
    onChange,
    labelOnNull,
  }: {
    selectedModelId: string | null;
    onChange: (model: Model | null) => void;
    labelOnNull: string;
  }) => {
    const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
      onChange(event.target.value ? { providerId: 'local', id: event.target.value.split('/').slice(1).join('/') } : null);
    };
    return (
      <select aria-label={labelOnNull} value={selectedModelId || ''} onChange={handleChange}>
        <option value="">{labelOnNull}</option>
        <option value="local/compact">Compact model</option>
        <option value="local/handoff">Handoff model</option>
      </select>
    );
  },
}));

const createSettings = (contextCompactionType = ContextCompactionType.Compact): SettingsData =>
  ({
    taskSettings: {
      smartTaskState: false,
      autoGenerateTaskName: false,
      showTaskStateActions: true,
      worktreeSymlinkFolders: [],
      contextCompactingThreshold: { percentage: 90, tokens: 100000 },
      contextCompactionType,
      defaultWorkingMode: 'local',
      worktreeBranchPrefix: 'task/',
      renameBranchOnNameGeneration: true,
      compactionModel: 'local/compact',
      handoffModel: 'local/handoff',
    },
  }) as unknown as SettingsData;

describe('TaskSettings context models', () => {
  it.each([
    [ContextCompactionType.Compact, 'compactionModel', 'local/compact'],
    [ContextCompactionType.Handoff, 'handoffModel', 'local/handoff'],
  ])('shows only the model for %s inside Context Management', (type, label, modelId) => {
    const { container } = render(<TaskSettings settings={createSettings(type)} setSettings={vi.fn()} />);
    const context = within(container.querySelector('#context') as HTMLElement);
    expect(context.getByText(`settings.tasks.${label}`)).toBeInTheDocument();
    expect(context.getByRole('combobox')).toHaveValue(modelId);
    expect(context.queryByText(`settings.tasks.${label === 'compactionModel' ? 'handoffModel' : 'compactionModel'}`)).not.toBeInTheDocument();
  });

  it('keeps both overrides when switching types and hides the selector for Smart', () => {
    const setSettings = vi.fn<(settings: SettingsData) => void>();
    const settings = createSettings();
    const { container, rerender } = render(<TaskSettings settings={settings} setSettings={setSettings} />);
    const changeType = (type: ContextCompactionType) => {
      fireEvent.click(screen.getByRole('button', { name: `settings.tasks.contextCompactionType${type[0].toUpperCase()}${type.slice(1)}` }));
      const updated = setSettings.mock.lastCall![0];
      expect(updated.taskSettings.compactionModel).toBe('local/compact');
      expect(updated.taskSettings.handoffModel).toBe('local/handoff');
      rerender(<TaskSettings settings={updated} setSettings={setSettings} />);
    };

    changeType(ContextCompactionType.Handoff);
    expect(within(container.querySelector('#context') as HTMLElement).getByRole('combobox')).toHaveValue('local/handoff');
    changeType(ContextCompactionType.Smart);
    expect(within(container.querySelector('#context') as HTMLElement).queryByRole('combobox')).not.toBeInTheDocument();
    changeType(ContextCompactionType.Compact);
    expect(within(container.querySelector('#context') as HTMLElement).getByRole('combobox')).toHaveValue('local/compact');
  });

  it.each([ContextCompactionType.Compact, ContextCompactionType.Handoff])('updates and clears only the %s override', (type) => {
    const setSettings = vi.fn<(settings: SettingsData) => void>();
    const settings = createSettings(type);
    const { rerender } = render(<TaskSettings settings={settings} setSettings={setSettings} />);
    const key = type === ContextCompactionType.Handoff ? 'handoffModel' : 'compactionModel';
    const otherKey = type === ContextCompactionType.Handoff ? 'compactionModel' : 'handoffModel';
    const selector = screen.getByRole('combobox', { name: 'settings.tasks.useCurrentTaskModel' });

    fireEvent.change(selector, { target: { value: '' } });
    const cleared = setSettings.mock.lastCall![0];
    expect(cleared.taskSettings[key]).toBeNull();
    expect(cleared.taskSettings[otherKey]).toBe(settings.taskSettings[otherKey]);
    rerender(<TaskSettings settings={cleared} setSettings={setSettings} />);
    expect(selector).toHaveValue('');

    fireEvent.change(selector, { target: { value: 'local/compact' } });
    expect(setSettings.mock.lastCall![0].taskSettings[key]).toBe('local/compact');
    expect(setSettings.mock.lastCall![0].taskSettings[otherKey]).toBe(settings.taskSettings[otherKey]);
  });

  it('uses the current-task-model option when no override is saved', () => {
    const settings = createSettings();
    delete settings.taskSettings.compactionModel;
    render(<TaskSettings settings={settings} setSettings={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: 'settings.tasks.useCurrentTaskModel' })).toHaveValue('');
  });
});
