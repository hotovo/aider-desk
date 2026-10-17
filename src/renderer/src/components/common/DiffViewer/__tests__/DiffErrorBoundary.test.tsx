import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { DiffErrorBoundary } from '../DiffErrorBoundary';
import { DiffFallback } from '../DiffFallback';

const ThrowingDiff = () => {
  throw new Error('Unexpected child render failure');
};

afterEach(() => vi.restoreAllMocks());

describe('DiffErrorBoundary', () => {
  it('isolates a failed diff and preserves the source without affecting siblings', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(
      <div>
        <span>Conversation still available</span>
        <DiffErrorBoundary resetKeys={['patch']} fallback={<DiffFallback udiff={'  raw patch\n'} />}>
          <ThrowingDiff />
        </DiffErrorBoundary>
      </div>,
    );
    expect(screen.getByText('Conversation still available')).toBeInTheDocument();
    expect(container.querySelector('pre')?.textContent).toBe('  raw patch\n');
  });

  it('keeps the fallback for unchanged keys and retries after input or view mode changes', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = render(
      <DiffErrorBoundary resetKeys={['original', 'compact']} fallback={<span>Fallback</span>}>
        <ThrowingDiff />
      </DiffErrorBoundary>,
    );
    rerender(
      <DiffErrorBoundary resetKeys={['original', 'compact']} fallback={<span>Fallback</span>}>
        <span>Recovered</span>
      </DiffErrorBoundary>,
    );
    expect(screen.getByText('Fallback')).toBeInTheDocument();
    rerender(
      <DiffErrorBoundary resetKeys={['updated', 'compact']} fallback={<span>Fallback</span>}>
        <span>Recovered input</span>
      </DiffErrorBoundary>,
    );
    expect(screen.getByText('Recovered input')).toBeInTheDocument();
    rerender(
      <DiffErrorBoundary resetKeys={['updated', 'compact']} fallback={<span>Fallback</span>}>
        <ThrowingDiff />
      </DiffErrorBoundary>,
    );
    expect(screen.getByText('Fallback')).toBeInTheDocument();
    rerender(
      <DiffErrorBoundary resetKeys={['updated', 'unified']} fallback={<span>Fallback</span>}>
        <span>Recovered view</span>
      </DiffErrorBoundary>,
    );
    expect(screen.getByText('Recovered view')).toBeInTheDocument();
  });
});
