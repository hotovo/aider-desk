import { memo, useCallback, useState } from 'react';
import { HiPencil, HiTrash } from 'react-icons/hi';
import { RiMenuUnfold4Line } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';
import { useLocalStorage } from '@reactuses/core';
import { clsx } from 'clsx';

import { IconButton } from '@/components/common/IconButton';
import { TextArea } from '@/components/common/TextArea';
import { Checkbox } from '@/components/common/Checkbox';
import { Button } from '@/components/common/Button';

type PendingComment = {
  id: string;
  filePath: string;
  lineNumber: number;
  comment: string;
};

type Props = {
  pendingComments: PendingComment[];
  onRemoveComment: (id: string) => void;
  onUpdateComment: (id: string, comment: string) => void;
  onSubmitAll: () => void;
  isSubmitting: boolean;
  createNewTask: boolean;
  onCreateNewTaskChange: (value: boolean) => void;
};

const CommentItem = memo(
  ({
    pc,
    isEditing,
    onStartEdit,
    onCancelEdit,
    onSaveEdit,
    onRemove,
  }: {
    pc: PendingComment;
    isEditing: boolean;
    onStartEdit: () => void;
    onCancelEdit: () => void;
    onSaveEdit: (id: string, text: string) => void;
    onRemove: (id: string) => void;
  }) => {
    const { t } = useTranslation();
    const [editText, setEditText] = useState(pc.comment);

    const handleSave = useCallback(() => {
      if (!editText.trim()) {
        return;
      }
      onSaveEdit(pc.id, editText.trim());
    }, [editText, pc.id, onSaveEdit]);

    const handleCancel = useCallback(() => {
      setEditText(pc.comment);
      onCancelEdit();
    }, [pc.comment, onCancelEdit]);

    const handleEditTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setEditText(e.target.value);
    }, []);

    return (
      <div className="px-3 py-2.5 group">
        <div className="flex items-start justify-between gap-1 mb-1.5">
          <span className="text-3xs font-medium text-accent-primary truncate" title={`${pc.filePath}:${pc.lineNumber}`}>
            {pc.filePath.split('/').pop()}:{pc.lineNumber}
          </span>
          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={onStartEdit}
              className="p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-secondary transition-colors"
            >
              <HiPencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onRemove(pc.id)}
              className="p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-error transition-colors"
            >
              <HiTrash className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-1.5">
            <TextArea value={editText} onChange={handleEditTextChange} rows={3} className="text-xs" wrapperClassName="w-full" autoFocus />
            <div className="flex justify-end gap-1.5">
              <Button onClick={handleCancel} variant="text" color="tertiary" size="xs">
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSave} disabled={!editText.trim()} size="xs">
                {t('common.save')}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-2xs text-text-primary whitespace-pre-wrap break-words leading-relaxed">{pc.comment}</p>
        )}
      </div>
    );
  },
);

export const CommentsPanel = memo(
  ({ pendingComments, onRemoveComment, onUpdateComment, onSubmitAll, isSubmitting, createNewTask, onCreateNewTaskChange }: Props) => {
    const { t } = useTranslation();
    const [isCollapsed, setIsCollapsed] = useLocalStorage('diff-modal-comments-collapsed', false);
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);

    const handleStartEdit = useCallback((id: string) => {
      setEditingCommentId(id);
    }, []);

    const handleCancelEdit = useCallback(() => {
      setEditingCommentId(null);
    }, []);

    const handleSaveEdit = useCallback(
      (id: string, comment: string) => {
        onUpdateComment(id, comment);
        setEditingCommentId(null);
      },
      [onUpdateComment],
    );

    return (
      <div className={clsx('flex-shrink-0 bg-bg-primary-light', isCollapsed ? '' : 'w-80')}>
        <div className="p-4">
          <div className="bg-bg-secondary border border-border-default rounded-lg overflow-hidden flex flex-col max-h-[calc(100vh-190px)]">
            {/* Panel header */}
            <div className={clsx('flex items-center justify-between p-2 shrink-0', !isCollapsed && 'border-b border-border-default')}>
              {!isCollapsed && (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-medium text-text-primary truncate">
                    {t('contextFiles.commentsPanel')}
                    {pendingComments.length > 0 && <span className="ml-1.5 text-text-secondary font-normal">({pendingComments.length})</span>}
                  </span>
                </div>
              )}
              <IconButton
                icon={<RiMenuUnfold4Line className={clsx('w-4 h-4 transition-transform', isCollapsed ? '' : 'rotate-180')} />}
                onClick={() => setIsCollapsed((prev) => !prev)}
                tooltip={isCollapsed ? t('contextFiles.expandComments') : t('contextFiles.collapseComments')}
                className="p-1 rounded transition-colors hover:bg-bg-tertiary text-text-secondary"
              />
            </div>

            {!isCollapsed && (
              <>
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-bg-secondary scrollbar-thumb-bg-fourth hover:scrollbar-thumb-bg-tertiary">
                  {pendingComments.length === 0 ? (
                    <div className="px-3 py-6 text-center">
                      <p className="text-2xs text-text-muted leading-relaxed">{t('contextFiles.noComments')}</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border-default">
                      {pendingComments.map((pc) => (
                        <CommentItem
                          key={pc.id}
                          pc={pc}
                          isEditing={editingCommentId === pc.id}
                          onStartEdit={() => handleStartEdit(pc.id)}
                          onCancelEdit={handleCancelEdit}
                          onSaveEdit={handleSaveEdit}
                          onRemove={onRemoveComment}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Submit change requests */}
                {pendingComments.length > 0 && (
                  <div className="border-t border-border-default p-2 gap-1 flex items-center justify-between shrink-0">
                    <Checkbox label={t('diffViewer.lineComment.createNewTask')} checked={createNewTask} onChange={onCreateNewTaskChange} size="xs" />
                    <Button onClick={onSubmitAll} disabled={isSubmitting} variant="contained" color="primary" size="xs">
                      {isSubmitting ? t('contextFiles.submittingRequests') : t('contextFiles.submitAllRequests')}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  },
);

CommentItem.displayName = 'CommentItem';
CommentsPanel.displayName = 'CommentsPanel';
