import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { DiffLineCommentPanel } from '../DiffLineCommentPanel';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'diffViewer.lineComment.placeholder': 'Describe the changes you want to make to this code...',
        'common.cancel': 'Cancel',
        'common.submit': 'Submit',
      };
      return translations[key] || key;
    },
  }),
}));

describe('DiffLineCommentPanel', () => {
  const mockPosition = { top: 100, left: 50 };

  const defaultProps = {
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    position: mockPosition,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with textarea and buttons', () => {
    render(<DiffLineCommentPanel {...defaultProps} />);

    expect(screen.getByPlaceholderText('Describe the changes you want to make to this code...')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Submit')).toBeInTheDocument();
  });

  it('calls onCancel when Cancel button is clicked', () => {
    render(<DiffLineCommentPanel {...defaultProps} />);

    fireEvent.click(screen.getByText('Cancel'));

    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables Submit button when comment is empty', () => {
    render(<DiffLineCommentPanel {...defaultProps} />);

    const submitButton = screen.getByText('Submit');
    expect(submitButton).toBeDisabled();
  });

  it('enables Submit button when comment has content', () => {
    render(<DiffLineCommentPanel {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('Describe the changes you want to make to this code...');
    fireEvent.change(textarea, { target: { value: 'Add error handling' } });

    const submitButton = screen.getByText('Submit');
    expect(submitButton).not.toBeDisabled();
  });

  it('calls onSubmit with trimmed comment when Submit is clicked', async () => {
    render(<DiffLineCommentPanel {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('Describe the changes you want to make to this code...');
    fireEvent.change(textarea, { target: { value: '  Add error handling here  ' } });

    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(defaultProps.onSubmit).toHaveBeenCalledTimes(1);
      expect(defaultProps.onSubmit).toHaveBeenCalledWith('Add error handling here');
    });
  });

  it('calls onCancel when Escape key is pressed in textarea', () => {
    render(<DiffLineCommentPanel {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('Describe the changes you want to make to this code...');
    fireEvent.keyDown(textarea, { key: 'Escape' });

    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onSubmit when Enter is pressed in textarea', async () => {
    render(<DiffLineCommentPanel {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('Describe the changes you want to make to this code...');
    fireEvent.change(textarea, { target: { value: 'Quick submit' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    await waitFor(() => {
      expect(defaultProps.onSubmit).toHaveBeenCalledWith('Quick submit');
    });
  });

  it('does not submit when Shift+Enter is pressed in textarea', async () => {
    render(<DiffLineCommentPanel {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('Describe the changes you want to make to this code...');
    fireEvent.change(textarea, { target: { value: 'Some comment' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });
});
