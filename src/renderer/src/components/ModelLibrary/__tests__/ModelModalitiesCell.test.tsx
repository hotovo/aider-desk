import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ModelModality } from '@common/types';

import { ModelModalitiesCell } from '../ModelModalitiesCell';

import { render } from '@/__tests__/render';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('ModelModalitiesCell', () => {
  it('shows an accessible unknown indicator when metadata is absent', () => {
    render(<ModelModalitiesCell value={undefined} />);
    expect(screen.getByRole('img', { name: 'modelLibrary.modalities.unknown' })).toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });

  it('distinguishes explicitly empty modalities from unknown capabilities', () => {
    render(<ModelModalitiesCell value={{ input: [], output: [] }} />);
    expect(screen.queryByRole('img', { name: 'modelLibrary.modalities.unknown' })).not.toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('shows known modalities instead of the unknown indicator', () => {
    const { container } = render(<ModelModalitiesCell value={{ input: [ModelModality.Text, ModelModality.Image], output: [ModelModality.Text] }} />);
    expect(screen.queryByRole('img', { name: 'modelLibrary.modalities.unknown' })).not.toBeInTheDocument();
    expect(container.querySelectorAll('svg')).toHaveLength(4);
  });
});
