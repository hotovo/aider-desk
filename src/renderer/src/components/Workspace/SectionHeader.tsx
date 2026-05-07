import { HiChevronDown } from 'react-icons/hi';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { MdDragIndicator } from 'react-icons/md';
import { RiEyeLine, RiEyeOffLine } from 'react-icons/ri';

import type { SectionType } from './types';

type Props = {
  section: SectionType;
  title: string;
  count: number;
  totalCount?: number;
  isOpen: boolean;
  totalStats: { additions: number; deletions: number };
  actions?: React.ReactNode;
  onToggle: () => void;
  editMode?: boolean;
  isHidden?: boolean;
  onToggleHidden?: () => void;
};

export const SectionHeader = ({ section, title, count, totalCount, isOpen, totalStats, actions, onToggle, editMode, isHidden, onToggleHidden }: Props) => {
  return (
    <div
      className={clsx(
        'flex items-center px-2 select-none h-[40px] shrink-0 bg-bg-primary-light',
        !editMode && !isOpen && 'cursor-pointer',
        editMode && !isHidden && 'cursor-grab',
        editMode && isHidden && 'opacity-50',
      )}
      onClick={!editMode ? onToggle : undefined}
    >
      {editMode && (
        <div className="mr-1 text-text-muted cursor-grab active:cursor-grabbing touch-none">
          <MdDragIndicator className="w-4 h-4" />
        </div>
      )}

      {!editMode && (
        <motion.div initial={false} animate={{ rotate: isOpen ? 0 : -90 }} transition={{ duration: 0.1 }} className="mr-1">
          <HiChevronDown className="w-4 h-4 text-text-muted" />
        </motion.div>
      )}

      <span className="text-xs font-semibold uppercase flex-grow text-text-secondary">{title}</span>

      {!editMode && section === 'updated' ? (
        <span className="text-2xs mr-2 bg-bg-secondary-light px-1.5 rounded-full">
          <span className="text-success">+{totalStats.additions}</span>
          <span className="ml-0.5 text-error">-{totalStats.deletions}</span>
        </span>
      ) : null}

      {!editMode && section !== 'updated' && !isOpen && (
        <span className="text-2xs text-text-tertiary mr-2 bg-bg-secondary-light px-1.5 rounded-full">
          {totalCount != null && totalCount !== count ? `${count}/${totalCount}` : count}
        </span>
      )}

      <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
        {!editMode && isOpen && actions}
        {editMode && onToggleHidden && (
          <button onClick={onToggleHidden} className="p-1 hover:bg-bg-tertiary rounded transition-colors">
            {isHidden ? <RiEyeOffLine className="w-4 h-4 text-text-muted" /> : <RiEyeLine className="w-4 h-4 text-text-primary" />}
          </button>
        )}
      </div>
    </div>
  );
};
