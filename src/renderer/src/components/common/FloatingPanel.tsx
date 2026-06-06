import { ReactNode, useCallback, useState } from 'react';
import { clsx } from 'clsx';
import { Rnd } from 'react-rnd';
import { IoMdClose } from 'react-icons/io';
import { VscChevronRight } from 'react-icons/vsc';
import { useLocalStorage } from '@reactuses/core';

import { IconButton } from '@/components/common/IconButton';

type Props = {
  title: string;
  children: ReactNode;
  onClose?: () => void;
  storageKey?: string;
  defaultPosition?: { x: number; y: number };
  defaultSize?: { width: number; height: number };
  minWidth?: number;
  minHeight?: number;
  className?: string;
};

const DEFAULT_POSITION = { x: 100, y: 50 };
const DEFAULT_SIZE = { width: 400, height: 350 };
const MIN_WIDTH = 50;
const MIN_HEIGHT = 50;

export const FloatingPanel = ({
  title,
  children,
  onClose,
  storageKey,
  defaultPosition = DEFAULT_POSITION,
  defaultSize = DEFAULT_SIZE,
  minWidth = MIN_WIDTH,
  minHeight = MIN_HEIGHT,
  className,
}: Props) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [storedPosition, setStoredPosition] = useLocalStorage(`floating-panel-pos-${storageKey}`, defaultPosition);
  const [storedSize, setStoredSize] = useLocalStorage(`floating-panel-size-${storageKey}`, defaultSize);

  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const position = storedPosition ?? defaultPosition;
  const size = isCollapsed ? { width: 50, height: 'auto' as const } : (storedSize ?? defaultSize);

  return (
    <Rnd
      position={{ x: position.x, y: position.y }}
      size={size}
      onDragStop={(_e, d) => {
        setStoredPosition({ x: d.x, y: d.y });
      }}
      onResizeStop={(_e, _dir, ref, _delta, pos) => {
        setStoredSize({
          width: parseInt(ref.style.width),
          height: parseInt(ref.style.height),
        });
        setStoredPosition(pos);
      }}
      minWidth={minWidth}
      minHeight={minHeight}
      bounds="parent"
      dragHandleClassName="floating-panel-title-bar"
      className="pointer-events-auto"
    >
      <div
        className={`flex flex-col bg-bg-primary border border-border-dark rounded-md shadow-lg overflow-hidden ${className ?? ''}`}
        style={{ height: isCollapsed ? 'auto' : '100%' }}
      >
        <div className="floating-panel-title-bar flex items-center justify-between bg-bg-primary-light min-h-[36px] pl-3 pr-1 cursor-move select-none">
          <span className="text-xs uppercase font-medium text-text-primary truncate">{title}</span>
          <div className="flex items-center flex-shrink-0">
            <IconButton
              icon={<VscChevronRight className={clsx('h-4 w-4 text-text-secondary transition-transform duration-200', !isCollapsed && 'rotate-90')} />}
              onClick={handleToggleCollapse}
              className="p-1 hover:bg-bg-tertiary-emphasis transition-colors duration-200 rounded"
            />
            {onClose && (
              <IconButton
                icon={<IoMdClose className="h-4 w-4 text-text-secondary" />}
                onClick={onClose}
                className="px-2 py-1.5 hover:bg-bg-tertiary-emphasis transition-colors duration-200"
              />
            )}
          </div>
        </div>
        <div
          className={clsx(
            'flex-1 overflow-auto scrollbar-thin scrollbar-track-bg-primary scrollbar-thumb-bg-secondary-light scrollbar-thumb-rounded-full',
            isCollapsed && 'max-h-0 max-w-0 overflow-hidden',
          )}
        >
          {children}
        </div>
      </div>
    </Rnd>
  );
};
