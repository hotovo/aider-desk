import { useEffect, useRef } from 'react';

import { useClickOutside } from '@/hooks/useClickOutside';

type Props = {
  items: string[];
  highlightedIndex: number;
  setHighlightedIndex: (index: number) => void;
  onSelect: (item: string) => void;
  onClose: () => void;
};

export const InputHistoryMenu = ({ items, highlightedIndex, setHighlightedIndex, onSelect, onClose }: Props) => {
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, onClose);

  useEffect(() => {
    if (menuRef.current) {
      menuRef.current.scrollTop = menuRef.current.scrollHeight;
    }
  }, []);

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full mb-1 bg-neutral-900 border border-neutral-700 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-track-neutral-800 scrollbar-thumb-neutral-700 hover:scrollbar-thumb-neutral-600 max-w-full"
    >
      {items.map((item, index) => (
        <div
          key={index}
          ref={index === highlightedIndex ? (el) => el?.scrollIntoView({ block: 'nearest' }) : null}
          className={`px-3 py-1 text-left text-xs cursor-pointer hover:bg-neutral-700 truncate ${index === highlightedIndex ? 'bg-neutral-700' : ''}`}
          onMouseEnter={() => setHighlightedIndex(index)}
          onClick={() => onSelect(item)}
        >
          {item}
        </div>
      ))}
    </div>
  );
};
