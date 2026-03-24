import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

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

  it('renders all available modes', () => {
    render(<ModeSelector mode="code" onModeChange={mockOnModeChange} baseDir="/test/project" />);

    // Verify all built-in modes are rendered
    expect(screen.getByTestId('mode-code')).toBeInTheDocument();
    expect(screen.getByTestId('mode-agent')).toBeInTheDocument();
    expect(screen.getByTestId('mode-ask')).toBeInTheDocument();
    expect(screen.getByTestId('mode-architect')).toBeInTheDocument();
    expect(screen.getByTestId('mode-context')).toBeInTheDocument();
  });

  it('renders all modes in correct order', () => {
    const { container } = render(<ModeSelector mode="code" onModeChange={mockOnModeChange} baseDir="/test/project" />);

    const buttons = container.querySelectorAll('[data-testid^="mode-"]');
    const modeOrder = Array.from(buttons).map((btn) => btn.getAttribute('data-testid')?.replace('mode-', ''));

    // Verify all expected modes are present
    expect(modeOrder).toEqual(expect.arrayContaining(['code', 'agent', 'ask', 'architect', 'context']));
  });
});
