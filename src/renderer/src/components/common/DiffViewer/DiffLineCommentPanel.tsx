import { useState, useRef, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/common/Button';
import { useClickOutside } from '@/hooks/useClickOutside';

type Props = {
  onSubmit: (comment: string) => void;
  onCancel: () => void;
  position: { top: number; left: number };
};

export const DiffLineCommentPanel = ({ onSubmit, onCancel, position }: Props) => {
  const { t } = useTranslation();
  const [comment, setComment] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useClickOutside(panelRef, onCancel);

  const handleSubmit = () => {
    if (comment.trim()) {
      onSubmit(comment.trim());
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      onCancel();
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      ref={panelRef}
      className="absolute z-20 left-5 right-5 bg-bg-primary-light border border-border-default rounded-md shadow-lg p-3"
      style={{ top: position.top }}
    >
      <textarea
        ref={textareaRef}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('diffViewer.lineComment.placeholder')}
        className="w-full h-20 px-2 py-1 border-2 border-border-default-dark rounded-md focus:outline-none focus:border-border-accent text-sm bg-bg-secondary text-text-primary placeholder-text-muted-dark resize-none scrollbar-thin scrollbar-track-bg-secondary-light scrollbar-thumb-bg-fourth hover:scrollbar-thumb-bg-fourth"
        autoFocus
      />

      <div className="flex justify-end gap-2 mt-2">
        <Button onClick={onCancel} variant="text" color="tertiary" size="xs">
          {t('common.cancel')}
        </Button>
        <Button onClick={handleSubmit} disabled={!comment.trim()} size="xs">
          {t('common.submit')}
        </Button>
      </div>
    </div>
  );
};
