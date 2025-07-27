import { useEffect, useRef } from 'react';

import { useClickOutside } from '@/hooks/useClickOutside';

type Props = {
  items: string[];
  highlightedIndex: number;
  onSelect: (item: string) => void;
  onClose: () => void;
  onScrollTop?: () => void;
  keepHighlightAtTop?: boolean;
};

export const InputHistoryMenu = ({ items, highlightedIndex, onSelect, onClose, onScrollTop, keepHighlightAtTop = false }: Props) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const prevScrollTop = useRef(0);

  useClickOutside(menuRef, onClose);

  useEffect(() => {
    if (menuRef.current) {
      menuRef.current.scrollTop = menuRef.current.scrollHeight;
    }
  }, []);

  const handleScroll = () => {
    const el = menuRef.current;
    if (!el) {
      return;
    }
    if (el.scrollTop === 0 && prevScrollTop.current > 0) {
      onScrollTop?.();
    }
    prevScrollTop.current = el.scrollTop;
  };

  return (
    <div
      ref={menuRef}
      onScroll={handleScroll}
      className="absolute bottom-full mb-1 bg-neutral-900 border border-neutral-700 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-track-neutral-900 scrollbar-thumb-neutral-800 hover:scrollbar-thumb-neutral-700 w-full"
    >
      {items.reverse().map((item, index) => (
        <div
          key={index}
          ref={index === items.length - 1 - highlightedIndex ? (el) => el?.scrollIntoView({ block: keepHighlightAtTop ? 'start' : 'nearest' }) : null}
          className={`px-3 py-1 text-left text-xs cursor-pointer hover:bg-neutral-850 truncate ${index === items.length - 1 - highlightedIndex ? 'bg-neutral-800' : ''}`}
          onClick={() => onSelect(item)}
        >
          {item}
        </div>
      ))}
    </div>
  );
};
