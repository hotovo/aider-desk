import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BiSend } from 'react-icons/bi';
import { MdDragIndicator, MdEdit, MdPlaylistRemove, MdSave } from 'react-icons/md';
import { closestCenter, DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { QueuedPromptData } from '@common/types';

import { Tooltip } from '@/components/ui/Tooltip';

type QueuedPromptsListProps = {
  queuedPrompts: QueuedPromptData[];
  onRemove?: (id: string) => void;
  onSendNow?: (id: string) => void;
  onReorder?: (prompts: QueuedPromptData[]) => void;
  onEdit?: (id: string, newText: string) => void;
};

const SortableQueuedPromptItem = ({
  prompt,
  onRemove,
  onSendNow,
  onEdit,
}: {
  prompt: QueuedPromptData;
  onRemove?: (id: string) => void;
  onSendNow?: (id: string) => void;
  onEdit?: (id: string, newText: string) => void;
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(prompt.text);
  const inputRef = useRef<HTMLInputElement>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: prompt.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleStartEdit = () => {
    setEditText(prompt.text);
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSave = () => {
    if (editText.trim() && editText !== prompt.text) {
      onEdit?.(prompt.id, editText.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 mb-2 last:mb-0 p-2 bg-bg-secondary rounded border border-border-default-dark">
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-text-muted hover:text-text-primary transition-colors touch-none"
        aria-label="Drag to reorder"
      >
        <MdDragIndicator size={16} />
      </button>
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="flex-1 bg-bg-primary text-text-primary text-xs px-2 py-1 rounded border border-border-light outline-none focus:border-border-accent"
        />
      ) : (
        <div
          className="flex-1 truncate text-text-muted-light text-xs cursor-pointer hover:text-text-primary transition-colors"
          onClick={handleStartEdit}
          title={prompt.text}
        >
          {prompt.text}
        </div>
      )}
      {isEditing ? (
        <>
          <Tooltip content={t('promptField.saveQueuedPrompt')}>
            <button onClick={handleSave} className="text-text-muted hover:text-text-primary transition-colors">
              <MdSave size={14} />
            </button>
          </Tooltip>
          <Tooltip content={t('promptField.cancelEditQueuedPrompt')}>
            <button onClick={handleCancel} className="text-text-muted hover:text-text-primary transition-colors">
              <MdPlaylistRemove size={14} />
            </button>
          </Tooltip>
        </>
      ) : (
        <>
          <Tooltip content={t('promptField.editQueuedPrompt')}>
            <button onClick={handleStartEdit} className="text-text-muted hover:text-text-primary transition-colors">
              <MdEdit size={16} />
            </button>
          </Tooltip>
          <Tooltip content={t('promptField.removeQueuedPrompt')}>
            <button onClick={() => onRemove?.(prompt.id)} className="text-text-muted hover:text-text-primary transition-colors">
              <MdPlaylistRemove size={16} />
            </button>
          </Tooltip>
          <Tooltip content={t('promptField.sendQueuedPromptNow')}>
            <button
              onClick={() => onSendNow?.(prompt.id)}
              className="text-text-muted hover:text-text-primary transition-colors"
              title={t('promptField.sendQueuedPromptNow')}
            >
              <BiSend size={16} />
            </button>
          </Tooltip>
        </>
      )}
    </div>
  );
};

export const QueuedPromptsList = ({ queuedPrompts, onRemove, onSendNow, onReorder, onEdit }: QueuedPromptsListProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const oldIndex = queuedPrompts.findIndex((p) => p.id === active.id);
    const newIndex = queuedPrompts.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(queuedPrompts, oldIndex, newIndex);
    onReorder?.(reordered);
  };

  const promptIds = useMemo(() => queuedPrompts.map((p) => p.id), [queuedPrompts]);

  return (
    <div className="mb-2 p-3 bg-bg-primary-light from-bg-primary to-bg-primary-light rounded-md border border-border-default-dark text-sm max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-bg-tertiary scrollbar-track-bg-primary-light scrollbar-rounded">
      <div className="text-text-primary text-xs mb-2">{useTranslation().t('promptField.queueTitle')}</div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={promptIds} strategy={verticalListSortingStrategy}>
          {queuedPrompts.map((queuedPrompt) => (
            <SortableQueuedPromptItem key={queuedPrompt.id} prompt={queuedPrompt} onRemove={onRemove} onSendNow={onSendNow} onEdit={onEdit} />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
};
