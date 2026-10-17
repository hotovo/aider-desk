import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiffViewMode } from '@common/types';

import { CodeBlock } from '../CodeBlock';

const { state } = vi.hoisted(() => ({ state: { diffViewMode: 'compact', shouldThrow: true } }));

vi.mock('@/stores/settingsStore', () => ({
  useSettingsStore: () => state.diffViewMode,
}));
vi.mock('@/contexts/ApiContext', () => ({ useApi: () => ({}) }));
vi.mock('@/utils/highlighter', () => ({ highlightWithLowlight: (value: string) => value }));
vi.mock('../MermaidDiagram', () => ({ MermaidDiagram: () => null }));
vi.mock('../IconButton', () => ({ IconButton: () => null }));
vi.mock('../../message/CopyMessageButton', () => ({ CopyMessageButton: () => null }));
vi.mock('@/components/common/DiffViewer', () => {
  const Viewer = () => {
    if (state.shouldThrow) {
      throw new Error('Diff render failed');
    }
    return <div>Rendered diff</div>;
  };
  return { CompactDiffViewer: Viewer, UDiffViewer: Viewer, DiffViewer: Viewer };
});

afterEach(() => {
  vi.restoreAllMocks();
  state.diffViewMode = DiffViewMode.Compact;
  state.shouldThrow = true;
});

describe('CodeBlock diff error isolation', () => {
  it.each([DiffViewMode.Compact, DiffViewMode.Unified, DiffViewMode.SideBySide])('contains %s viewer errors and recovers on new input', (mode) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    state.diffViewMode = mode;
    const patch = '--- a/x\n+++ b/x\n@@ -1 +1 @@\n-old\n+new\n';
    const { container, rerender } = render(
      <CodeBlock baseDir="/project" language="diff" isComplete={false}>
        {patch}
      </CodeBlock>,
    );
    expect(container.querySelector('pre')?.textContent).toBe(patch);
    state.shouldThrow = false;
    rerender(<CodeBlock baseDir="/project" language="diff" isComplete={false}>{`${patch}\n`}</CodeBlock>);
    expect(screen.getByText('Rendered diff')).toBeInTheDocument();
  });

  it('preserves both explicit values and retries on a view mode change', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container, rerender } = render(<CodeBlock baseDir="/project" language="text" oldValue="old" newValue="new" />);
    expect(Array.from(container.querySelectorAll('pre'), (pre) => pre.textContent)).toEqual(['old', 'new']);
    state.shouldThrow = false;
    state.diffViewMode = DiffViewMode.Unified;
    rerender(<CodeBlock baseDir="/project" language="text" oldValue="old" newValue="new" />);
    expect(screen.getByText('Rendered diff')).toBeInTheDocument();
  });
});
