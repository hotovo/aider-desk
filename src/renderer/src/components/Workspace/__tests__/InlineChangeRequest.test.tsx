import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { InlineChangeRequest } from '../InlineChangeRequest';

describe('InlineChangeRequest', () => {
  it('opens editing with the inline request position', () => {
    const onEdit = vi.fn();
    const requestRect = new DOMRect(10, 20, 100, 30);
    const { container } = render(<InlineChangeRequest comment="Update this line" editLabel="Edit" deleteLabel="Delete" onEdit={onEdit} onRemove={vi.fn()} />);
    const request = container.querySelector('[data-file-editor-inline-request]');
    vi.spyOn(request!, 'getBoundingClientRect').mockReturnValue(requestRect);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(onEdit).toHaveBeenCalledWith(requestRect);
  });

  it('removes the inline request', () => {
    const onRemove = vi.fn();
    render(<InlineChangeRequest comment="Update this line" editLabel="Edit" deleteLabel="Delete" onEdit={vi.fn()} onRemove={onRemove} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onRemove).toHaveBeenCalledOnce();
  });
});
