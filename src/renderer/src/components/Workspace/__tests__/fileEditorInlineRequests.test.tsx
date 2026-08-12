import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { createInlineChangeRequestsExtension } from '../fileEditorInlineRequests';

describe('createInlineChangeRequestsExtension', () => {
  let view: EditorView | null = null;

  afterEach(async () => {
    await act(async () => {
      view?.destroy();
      await Promise.resolve();
    });
    view = null;
    document.body.innerHTML = '';
  });

  it('renders an interactive block widget below the anchored line', async () => {
    const onEdit = vi.fn();
    const onRemove = vi.fn();
    const parent = document.createElement('div');
    document.body.appendChild(parent);

    await act(async () => {
      view = new EditorView({
        parent,
        state: EditorState.create({
          doc: 'first\nsecond',
          extensions: [
            createInlineChangeRequestsExtension({
              changeRequests: [{ id: 'request-1', position: 6, comment: 'Change the second line' }],
              editLabel: 'Edit',
              deleteLabel: 'Delete',
              onEdit,
              onRemove,
            }),
          ],
        }),
      });
    });

    await screen.findByText('Change the second line');
    expect(parent.querySelector('.cm-inline-change-request')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onEdit).toHaveBeenCalledWith('request-1', expect.objectContaining({ bottom: 0, left: 0 }));
    expect(onRemove).toHaveBeenCalledWith('request-1');
  });
});
