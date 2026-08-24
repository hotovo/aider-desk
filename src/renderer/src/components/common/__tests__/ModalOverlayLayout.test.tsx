import { ReactNode } from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';

import { ModalOverlayLayout } from '../ModalOverlayLayout';

import { useOverlayFocusRestore } from '@/hooks/useOverlayFocusRestore';
import { useOverlayStore } from '@/stores/overlayStore';
import { createMockApi } from '@/__tests__/mocks/api';
import { useApi } from '@/contexts/ApiContext';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock useApi
vi.mock('@/contexts/ApiContext', () => ({
  useApi: vi.fn(),
}));

interface IconButtonProps {
  onClick?: () => void;
  icon: ReactNode;
  tooltip?: string;
  'data-testid'?: string;
}

// Mock IconButton as it might use tooltips or other things
vi.mock('../IconButton', () => ({
  IconButton: ({ onClick, icon, tooltip, 'data-testid': dataTestId }: IconButtonProps) => (
    <button onClick={onClick} title={tooltip} data-testid={dataTestId}>
      {icon}
    </button>
  ),
}));

type Props = { focus: () => void };

const FocusRestoreConsumer = ({ focus }: Props) => {
  useOverlayFocusRestore(focus, true);
  return <div>Prompt field placeholder</div>;
};

describe('ModalOverlayLayout', () => {
  const mockApi = createMockApi();

  beforeEach(() => {
    vi.mocked(useApi).mockReturnValue(mockApi);
    useOverlayStore.setState({ openOverlays: new Set(), focusRequest: 0 });
  });

  it('renders with title and children', () => {
    const title = 'Overlay Title';
    const content = 'Overlay Content';
    render(
      <ModalOverlayLayout title={title}>
        <div>{content}</div>
      </ModalOverlayLayout>,
    );

    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText(content)).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <ModalOverlayLayout title="Test" onClose={onClose}>
        <div>Content</div>
      </ModalOverlayLayout>,
    );

    fireEvent.click(screen.getByTestId('close-modal'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render close button when onClose is not provided', () => {
    render(
      <ModalOverlayLayout title="Test">
        <div>Content</div>
      </ModalOverlayLayout>,
    );

    expect(screen.queryByTestId('close-modal')).not.toBeInTheDocument();
  });

  it('registers itself while mounted and requests focus restore on unmount', async () => {
    const focus = vi.fn();
    render(<FocusRestoreConsumer focus={focus} />);
    const { unmount } = render(
      <ModalOverlayLayout title="Overlay">
        <div>Content</div>
      </ModalOverlayLayout>,
    );

    expect(useOverlayStore.getState().openOverlays.size).toBe(1);
    expect(useOverlayStore.getState().focusRequest).toBe(0);

    unmount();

    expect(useOverlayStore.getState().openOverlays.size).toBe(0);
    expect(useOverlayStore.getState().focusRequest).toBe(1);

    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    });
    expect(focus).toHaveBeenCalledOnce();
  });

  it('does not request focus restore while another overlay remains open', () => {
    const focus = vi.fn();
    render(<FocusRestoreConsumer focus={focus} />);
    render(
      <ModalOverlayLayout title="Remaining">
        <div>Remaining content</div>
      </ModalOverlayLayout>,
    );
    const { unmount } = render(
      <ModalOverlayLayout title="Closing">
        <div>Closing content</div>
      </ModalOverlayLayout>,
    );

    expect(useOverlayStore.getState().openOverlays.size).toBe(2);

    unmount();

    expect(useOverlayStore.getState().openOverlays.size).toBe(1);
    expect(useOverlayStore.getState().focusRequest).toBe(0);
  });
});
