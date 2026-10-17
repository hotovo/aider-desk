import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { formatLines } from 'unidiff';

import { CompactDiffViewer } from '../CompactDiffViewer';

vi.mock('@/hooks/useRefractorLanguage', () => ({ useRefractorLanguage: () => true }));
vi.mock('@/utils/highlighter', () => ({ highlightWithRefractor: (value: string) => value }));
vi.mock('unidiff', async (importOriginal) => ({
  ...(await importOriginal<typeof import('unidiff')>()),
  formatLines: vi.fn((await importOriginal<typeof import('unidiff')>()).formatLines),
}));

const patch = (header: string) => `diff --git a/x b/x\n--- a/x\n+++ b/x\n${header}\n-a\n+b\n`;

afterEach(() => vi.restoreAllMocks());

describe('CompactDiffViewer', () => {
  it.each(['@@ foo @@', '@@', '@@ +1,2 @@', '@@@ -1,2 -1,2 +1,3 @@@', '@@ -1'])('preserves malformed or incomplete input: %s', (header) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const udiff = patch(header);
    const { container } = render(<CompactDiffViewer udiff={udiff} />);
    expect(container.querySelector('pre')?.textContent).toBe(udiff);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it.each([
    'diff --git x\n--- a/x\n+++ b/x\n@@ -1 +1 @@\n-a\n+b\n',
    '--- a/x\n+++ b/x\n-a\n+b\n',
    '--- a/x\n+++ b/x\n@@ -1 +1 @@\n\\ No newline at end of file\n',
  ])('preserves input for other parser exceptions', (udiff) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = render(<CompactDiffViewer udiff={udiff} />);
    expect(container.querySelector('pre')?.textContent).toBe(udiff);
  });

  it.each(['cc', 'combined'])('preserves unsupported diff --%s content', (kind) => {
    const udiff = `diff --${kind} x\nindex 123,456..789\n--- a/x\n+++ b/x\n@@@ -1,2 -1,2 +1,3 @@@\n++merged\n`;
    const { container } = render(<CompactDiffViewer udiff={udiff} />);
    expect(container.querySelector('pre')?.textContent).toBe(udiff);
  });

  it('preserves the whole patch when ordinary and combined diffs are mixed', () => {
    const udiff = `${patch('@@ -1 +1 @@')}diff --cc y\n--- a/y\n+++ b/y\n@@@ -1 -1 +1 @@@\n++merged\n`;
    const { container } = render(<CompactDiffViewer udiff={udiff} />);
    expect(container.querySelector('pre')?.textContent).toBe(udiff);
  });

  it('renders valid diffs with or without a git header', () => {
    const { rerender } = render(<CompactDiffViewer udiff={patch('@@ -1 +1 @@')} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    rerender(<CompactDiffViewer udiff={patch('@@ -1 +1 @@').replace('diff --git a/x b/x\n', '')} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('does not reject properly prefixed diff examples', () => {
    const udiff = '--- a/x\n+++ b/x\n@@ -1 +1 @@\n-@@@ old\n+@@@ new\n';
    render(<CompactDiffViewer udiff={udiff} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('recovers when a streamed hunk header becomes valid', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { rerender, container } = render(<CompactDiffViewer udiff={patch('@@ -1')} />);
    expect(container.querySelector('pre')).toBeInTheDocument();
    rerender(<CompactDiffViewer udiff={patch('@@ -1 +1 @@')} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(container.querySelector('pre')).not.toBeInTheDocument();
  });

  it('preserves unrecognized nonempty input', () => {
    const { container } = render(<CompactDiffViewer udiff="not a diff" />);
    expect(container.querySelector('pre')?.textContent).toBe('not a diff');
  });

  it('preserves both values if diff generation fails', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(formatLines).mockImplementationOnce(() => {
      throw new Error('Generation failed');
    });
    const { container } = render(<CompactDiffViewer oldValue={'before\n'} newValue={'after\n'} />);
    expect(Array.from(container.querySelectorAll('pre'), (pre) => pre.textContent)).toEqual(['before\n', 'after\n']);
  });

  it('renders generated diffs and leaves empty input empty', () => {
    const { rerender, container } = render(<CompactDiffViewer oldValue={'before\n'} newValue={'after\n'} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    rerender(<CompactDiffViewer udiff="" />);
    expect(container).toBeEmptyDOMElement();
  });
});
