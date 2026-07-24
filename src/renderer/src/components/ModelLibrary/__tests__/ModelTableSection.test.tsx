import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Model, ProviderProfile } from '@common/types';
import { ReactNode } from 'react';

import { ModelTableSection } from '../ModelTableSection';

import type { Column } from '@/components/common/Table';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-icons/fi', () => ({
  FiEdit2: () => <span data-testid="edit-icon" />,
  FiTrash2: () => <span />,
  FiPlus: () => <span />,
  FiEye: () => <span />,
  FiSliders: () => <span />,
  FiRefreshCw: () => <span />,
  FiChevronDown: () => <span />,
}));

vi.mock('react-icons/md', () => ({
  MdThermostat: () => <span />,
}));

vi.mock('@/components/common/VirtualTable', () => ({
  VirtualTable: ({ data, columns }: { data: Model[]; columns: Column<Model>[] }) => {
    const actionsColumn = columns[columns.length - 1];
    return <div>{actionsColumn.cell?.(undefined, data[0])}</div>;
  },
}));

vi.mock('@/components/common/IconButton', () => ({
  IconButton: ({ icon, onClick }: { icon: ReactNode; onClick?: () => void }) => <button onClick={onClick}>{icon}</button>,
}));

describe('ModelTableSection', () => {
  it('allows extension provider models to be edited', () => {
    const model: Model = {
      id: 'codex-mini',
      providerId: 'openai-codex',
    };
    const provider = {
      id: 'openai-codex',
      name: 'OpenAI Codex',
      provider: { name: 'openai-codex' },
      extensionId: 'openai-codex',
    } as ProviderProfile;
    const onEditModel = vi.fn();

    render(
      <ModelTableSection
        models={[model]}
        selectedProviderIds={[]}
        providers={[provider]}
        onAddModel={vi.fn()}
        onEditModel={onEditModel}
        onDeleteModel={vi.fn()}
        onToggleHidden={vi.fn()}
        onBulkToggleHidden={vi.fn()}
        onRefreshModels={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('edit-icon').closest('button')!);

    expect(onEditModel).toHaveBeenCalledWith(model);
  });
});
