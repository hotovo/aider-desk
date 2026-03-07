import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { ModeSelector } from '../ModeSelector';

// Mock useCustomModes hook
vi.mock('@/hooks/useCustomModes', () => ({
  useCustomModes: () => [],
}));

// Mock ItemSelector component
vi.mock('../../common/ItemSelector', () => ({
  ItemSelector: ({
    items,
    selectedValue,
    onChange,
  }: {
    items: Array<{ value: string; labelKey: string }>;
    selectedValue: string;
    onChange: (value: string) => void;
  }) => (
    <div data-testid="item-selector">
      {items.map((item) => (
        <button
          key={item.value}
          data-testid={`mode-${item.value}`}
          onClick={() => onChange(item.value)}
          className={selectedValue === item.value ? 'active' : ''}
        >
          {item.labelKey}
        </button>
      ))}
    </div>
  ),
}));

describe('ModeSelector', () => {
  const mockOnModeChange = vi.fn();

  beforeEach(() => {
    mockOnModeChange.mockClear();
  });

  it('renders BMAD mode alongside other modes', () => {
    render(<ModeSelector mode="code" onModeChange={mockOnModeChange} baseDir="/test/project" />);

    // Verify all modes are rendered including BMAD
    expect(screen.getByTestId('mode-code')).toBeInTheDocument();
    expect(screen.getByTestId('mode-agent')).toBeInTheDocument();
    expect(screen.getByTestId('mode-ask')).toBeInTheDocument();
    expect(screen.getByTestId('mode-architect')).toBeInTheDocument();
    expect(screen.getByTestId('mode-context')).toBeInTheDocument();
    expect(screen.getByTestId('mode-bmad')).toBeInTheDocument();
  });

  it('calls onModeChange when BMAD mode is clicked', () => {
    render(<ModeSelector mode="code" onModeChange={mockOnModeChange} baseDir="/test/project" />);

    const bmadButton = screen.getByTestId('mode-bmad');
    fireEvent.click(bmadButton);

    expect(mockOnModeChange).toHaveBeenCalledWith('bmad');
  });

  it('uses i18n translation key for BMAD mode label', () => {
    render(<ModeSelector mode="bmad" onModeChange={mockOnModeChange} baseDir="/test/project" />);

    const bmadButton = screen.getByTestId('mode-bmad');
    expect(bmadButton.textContent).toBe('mode.bmad');
  });

  it('highlights BMAD mode when selected', () => {
    render(<ModeSelector mode="bmad" onModeChange={mockOnModeChange} baseDir="/test/project" />);

    const bmadButton = screen.getByTestId('mode-bmad');
    expect(bmadButton.className).toContain('active');
  });

  it('does not highlight BMAD mode when another mode is selected', () => {
    render(<ModeSelector mode="code" onModeChange={mockOnModeChange} baseDir="/test/project" />);

    const bmadButton = screen.getByTestId('mode-bmad');
    expect(bmadButton.className).not.toContain('active');
  });

  it('renders all modes in correct order', () => {
    const { container } = render(<ModeSelector mode="code" onModeChange={mockOnModeChange} baseDir="/test/project" />);

    const buttons = container.querySelectorAll('[data-testid^="mode-"]');
    const modeOrder = Array.from(buttons).map((btn) => btn.getAttribute('data-testid')?.replace('mode-', ''));

    // Verify bmad is included in the list
    expect(modeOrder).toContain('bmad');

    // Verify all expected modes are present
    expect(modeOrder).toEqual(expect.arrayContaining(['code', 'agent', 'ask', 'architect', 'context', 'bmad']));
  });

  it('supports switching between all modes including BMAD', () => {
    const { rerender } = render(<ModeSelector mode="code" onModeChange={mockOnModeChange} baseDir="/test/project" />);

    // Click BMAD mode
    fireEvent.click(screen.getByTestId('mode-bmad'));
    expect(mockOnModeChange).toHaveBeenCalledWith('bmad');

    // Rerender with BMAD mode selected
    rerender(<ModeSelector mode="bmad" onModeChange={mockOnModeChange} baseDir="/test/project" />);
    expect(screen.getByTestId('mode-bmad').className).toContain('active');

    // Click another mode
    fireEvent.click(screen.getByTestId('mode-agent'));
    expect(mockOnModeChange).toHaveBeenCalledWith('agent');
  });
});
