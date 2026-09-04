import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { SearchableSelect } from '../SearchableSelect';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const options = [
  { label: 'main', value: 'main' },
  { label: 'feature/login', value: 'feature/login' },
  { label: 'feature/signup', value: 'feature/signup' },
];

const defaultProps = {
  options,
  value: 'main',
  onChange: vi.fn(),
};

describe('SearchableSelect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  const openDropdown = () => {
    const input = screen.getByDisplayValue('main');
    fireEvent.focus(input);
    return input;
  };

  it('renders the selected option in the field', () => {
    render(<SearchableSelect {...defaultProps} />);

    expect(screen.getByDisplayValue('main')).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows all options when the field is focused', () => {
    render(<SearchableSelect {...defaultProps} />);
    openDropdown();

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'main' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'feature/login' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'feature/signup' })).toBeInTheDocument();
  });

  it('filters options as the user types in the field', () => {
    render(<SearchableSelect {...defaultProps} />);
    const input = openDropdown();

    fireEvent.change(input, { target: { value: 'login' } });

    expect(screen.getByRole('option', { name: 'feature/login' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'feature/signup' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'main' })).not.toBeInTheDocument();
  });

  it('shows a no-matches message when nothing matches', () => {
    render(<SearchableSelect {...defaultProps} />);
    const input = openDropdown();

    fireEvent.change(input, { target: { value: 'zzz' } });

    expect(screen.getByText('select.noMatches')).toBeInTheDocument();
  });

  it('selects an option on click and closes the dropdown', () => {
    const onChange = vi.fn();
    render(<SearchableSelect {...defaultProps} onChange={onChange} />);
    openDropdown();

    fireEvent.click(screen.getByRole('option', { name: 'feature/login' }));

    expect(onChange).toHaveBeenCalledWith('feature/login');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('selects the first filtered option on Enter', () => {
    const onChange = vi.fn();
    render(<SearchableSelect {...defaultProps} onChange={onChange} />);
    const input = openDropdown();

    fireEvent.change(input, { target: { value: 'signup' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('feature/signup');
  });

  it('moves the highlight with arrow keys and selects with Enter', () => {
    const onChange = vi.fn();
    render(<SearchableSelect {...defaultProps} onChange={onChange} />);
    const input = openDropdown();

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('feature/login');
  });

  it('closes the dropdown on Escape and reverts the field to the selected option', () => {
    const onChange = vi.fn();
    render(<SearchableSelect {...defaultProps} onChange={onChange} />);
    const input = openDropdown();

    fireEvent.change(input, { target: { value: 'feature' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('main')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
