import { ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { ModalOverlayLayout } from '../ModalOverlayLayout';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

interface IconButtonProps {
  onClick?: () => void;
  icon: ReactNode;
  tooltip?: string;
}

// Mock IconButton as it might use tooltips or other things
vi.mock('../IconButton', () => ({
  IconButton: ({ onClick, icon, tooltip }: IconButtonProps) => (
    <button onClick={onClick} title={tooltip}>
      {icon}
    </button>
  ),
}));

describe('ModalOverlayLayout', () => {
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

    fireEvent.click(screen.getByTitle('common.close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render close button when onClose is not provided', () => {
    render(
      <ModalOverlayLayout title="Test">
        <div>Content</div>
      </ModalOverlayLayout>,
    );

    expect(screen.queryByTitle('common.close')).not.toBeInTheDocument();
  });
});
