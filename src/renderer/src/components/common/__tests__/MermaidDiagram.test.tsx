import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MermaidDiagram } from '../MermaidDiagram';

const mocks = vi.hoisted(() => ({
  detectType: vi.fn(),
  load: vi.fn(),
  mount: vi.fn(),
  update: vi.fn(),
  destroy: vi.fn(),
  refresh: vi.fn(),
  t: (key: string) => key,
}));

vi.mock('pele/lazy', () => ({ detectType: mocks.detectType, load: mocks.load, mount: mocks.mount }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: mocks.t }) }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.detectType.mockReturnValue('flowchart');
  mocks.load.mockResolvedValue(true);
  mocks.mount.mockImplementation((element: HTMLElement) => {
    element.innerHTML = '<svg class="pele"><text>Diagram</text></svg>';
    return { update: mocks.update, destroy: mocks.destroy, refresh: mocks.refresh };
  });
});

afterEach(cleanup);

describe('MermaidDiagram', () => {
  it('loads and mounts with safe options and translated zoom controls', async () => {
    const { container } = render(<MermaidDiagram code={'flowchart LR\nA --> B'} className="custom" />);
    await waitFor(() => expect(mocks.mount).toHaveBeenCalledTimes(1));
    expect(mocks.load).toHaveBeenCalledWith('flowchart');
    expect(mocks.mount).toHaveBeenCalledWith(expect.any(HTMLDivElement), 'flowchart LR\nA --> B', {
      fontSize: 14,
      images: false,
      links: false,
      autoDirection: false,
      zoom: { labels: { zoomIn: 'mermaid.zoomIn', zoomOut: 'mermaid.zoomOut', reset: 'mermaid.resetZoom' } },
    });
    expect(container.firstChild).toHaveClass('mermaid-diagram', 'custom');
    expect(screen.getByText('Diagram')).toBeInTheDocument();
  });

  it('updates the existing mount and loads a new diagram type', async () => {
    const { rerender, unmount } = render(<MermaidDiagram code={'flowchart LR\nA --> B'} isComplete={false} />);
    await waitFor(() => expect(mocks.mount).toHaveBeenCalledTimes(1));
    mocks.detectType.mockReturnValue('sequence');
    rerender(<MermaidDiagram code={'sequenceDiagram\nA->>B: Hello'} />);
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('sequenceDiagram\nA->>B: Hello', expect.any(Object)));
    expect(mocks.load).toHaveBeenLastCalledWith('sequence');
    expect(mocks.mount).toHaveBeenCalledTimes(1);
    unmount();
    expect(mocks.destroy).toHaveBeenCalledTimes(1);
  });

  it('discards stale loads and does not mount after unmount', async () => {
    let resolveLoad = () => {};
    mocks.load.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          resolveLoad = () => resolve(true);
        }),
    );
    const { rerender, unmount } = render(<MermaidDiagram code="old" />);
    rerender(<MermaidDiagram code="new" />);
    await waitFor(() => expect(mocks.mount).toHaveBeenCalledTimes(1));
    await act(async () => resolveLoad());
    expect(mocks.mount).toHaveBeenCalledTimes(1);
    expect(mocks.mount).toHaveBeenCalledWith(expect.anything(), 'new', expect.anything());
    unmount();

    mocks.load.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          resolveLoad = () => resolve(true);
        }),
    );
    const pending = render(<MermaidDiagram code="unmounted" />);
    pending.unmount();
    await act(async () => resolveLoad());
    expect(mocks.mount).toHaveBeenCalledTimes(1);
  });

  it('refreshes measurements when the font or theme changes and disconnects on unmount', async () => {
    const { unmount } = render(<MermaidDiagram code={'flowchart LR\nA --> B'} />);
    await waitFor(() => expect(mocks.mount).toHaveBeenCalledTimes(1));
    await act(async () => document.documentElement.style.setProperty('--font-family', 'monospace'));
    expect(mocks.refresh).toHaveBeenCalled();
    mocks.refresh.mockClear();
    await act(async () => document.body.classList.add('theme-light'));
    expect(mocks.refresh).toHaveBeenCalled();
    unmount();
    mocks.refresh.mockClear();
    await act(async () => {
      document.body.classList.remove('theme-light');
      document.documentElement.style.removeProperty('--font-family');
    });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('hides failures during streaming and safely displays them once complete', async () => {
    mocks.load.mockRejectedValue(new Error('<script>untrusted</script>'));
    const { container, rerender } = render(<MermaidDiagram code="invalid" isComplete={false} />);
    await waitFor(() => expect(mocks.load).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(container.firstChild).toHaveAttribute('data-streaming', 'true');
    rerender(<MermaidDiagram code="invalid" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('<script>untrusted</script>');
    expect(container.querySelector('script')).toBeNull();
    expect(container.firstChild).not.toHaveAttribute('data-streaming');
  });

  it('lets the mount handle incomplete syntax so the last valid diagram is retained', async () => {
    mocks.detectType.mockImplementation(() => {
      throw new Error('Incomplete syntax');
    });
    render(<MermaidDiagram code="flowchart" isComplete={false} />);
    await waitFor(() => expect(mocks.mount).toHaveBeenCalledTimes(1));
    expect(mocks.load).toHaveBeenCalledWith(null);
  });
});
