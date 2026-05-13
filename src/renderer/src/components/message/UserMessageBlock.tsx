import { useState } from 'react';
import { FaRegUser } from 'react-icons/fa';
import { clsx } from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { UserMessage } from '@common/types';

import { MessageBar } from './MessageBar';

import { useParsedContent } from '@/hooks/useParsedContent';

type Props = {
  baseDir: string;
  message: UserMessage;
  allFiles: string[];
  renderMarkdown: boolean;
  compact?: boolean;
  onRemove?: () => void;
  onRedo?: () => void;
  onEdit?: (content: string, images?: string[]) => void;
  onFork?: () => void;
  onRemoveUpTo?: () => void;
};

const MessageImages = ({ images }: { images: string[] }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const handleImageClick = (index: number) => {
    setExpandedIndex(index);
  };

  const handleExpandedClick = () => {
    setExpandedIndex(null);
  };

  return (
    <>
      <div className="flex flex-wrap gap-2 mt-2">
        {images.map((src, index) => (
          <img
            key={index}
            src={src}
            alt={`Pasted image ${index + 1}`}
            className="max-h-40 max-w-[200px] rounded-md border border-border-dark-light cursor-pointer hover:opacity-80 transition-opacity object-contain"
            onClick={() => handleImageClick(index)}
          />
        ))}
      </div>
      <AnimatePresence>
        {expandedIndex !== null && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 cursor-pointer"
            onClick={handleExpandedClick}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <motion.img
              src={images[expandedIndex]}
              alt={`Expanded image ${expandedIndex + 1}`}
              className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-2xl object-contain"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export const UserMessageBlock = ({ baseDir, message, allFiles, renderMarkdown, compact = false, onRemove, onRedo, onEdit, onFork, onRemoveUpTo }: Props) => {
  const baseClasses = 'rounded-md p-3 max-w-full text-xs bg-bg-secondary border border-border-dark-light text-text-primary border-l-4 border-l-border-accent';
  const parsedContent = useParsedContent(baseDir, message.content, allFiles, renderMarkdown);

  const handleEdit = () => {
    if (onEdit) {
      onEdit(message.content, message.images);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        id={`user-message-${message.id}`}
        className={clsx(baseClasses, 'relative flex flex-col group', !renderMarkdown && 'break-words whitespace-pre-wrap')}
        initial={message.isOptimistic ? { opacity: 0, transform: 'translateY(50px)' } : undefined}
        animate={message.isOptimistic ? { opacity: 1, transform: 'translateY(0)' } : undefined}
        transition={{ duration: 0.1 }}
      >
        <div className="flex items-start gap-2">
          <div className="mt-[3px]">
            <FaRegUser className="text-text-tertiary w-3.5 h-3.5" />
          </div>
          <div className="flex-grow-1 w-full overflow-hidden">
            {parsedContent}
            {message.images && message.images.length > 0 && <MessageImages images={message.images} />}
          </div>
        </div>
        {!compact && (
          <MessageBar
            message={message}
            content={message.content}
            remove={onRemove}
            redo={onRedo}
            edit={onEdit ? handleEdit : undefined}
            onFork={onFork}
            onRemoveUpTo={onRemoveUpTo}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
};
