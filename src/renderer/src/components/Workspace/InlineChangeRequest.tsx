import { type MouseEvent } from 'react';
import { HiPencil, HiTrash } from 'react-icons/hi';

type Props = {
  comment: string;
  editLabel: string;
  deleteLabel: string;
  onEdit: (rect: DOMRect) => void;
  onRemove: () => void;
};

export const InlineChangeRequest = ({ comment, editLabel, deleteLabel, onEdit, onRemove }: Props) => {
  const handleEdit = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const requestElement = event.currentTarget.closest('[data-file-editor-inline-request]');
    onEdit((requestElement ?? event.currentTarget).getBoundingClientRect());
  };

  const handleRemove = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onRemove();
  };

  const handleMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  return (
    <div
      data-file-editor-inline-request
      className="flex items-start justify-between gap-2 py-1.5 px-3 text-2xs text-text-secondary bg-bg-primary-light-strong border-t border-b border-border-accent group"
    >
      <span className="flex-1 min-w-0 whitespace-pre-wrap break-words">{comment}</span>
      <div className="sticky right-2 flex items-center gap-0.5 shrink-0 pl-1 bg-bg-primary-light-strong opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
        <button
          type="button"
          aria-label={editLabel}
          title={editLabel}
          className="p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-secondary transition-colors"
          onClick={handleEdit}
          onMouseDown={handleMouseDown}
        >
          <HiPencil size={14} />
        </button>
        <button
          type="button"
          aria-label={deleteLabel}
          title={deleteLabel}
          className="p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-error transition-colors"
          onClick={handleRemove}
          onMouseDown={handleMouseDown}
        >
          <HiTrash size={14} />
        </button>
      </div>
    </div>
  );
};
