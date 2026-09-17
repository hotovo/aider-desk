import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import {
  CSSProperties,
  FocusEvent,
  PointerEvent,
  ReactElement,
  Ref,
  ReactNode,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { clsx } from 'clsx';

type TooltipSide = 'top' | 'right' | 'bottom' | 'left';
type TooltipAlign = 'start' | 'center' | 'end';

type TooltipState = {
  content: ReactNode;
  anchorEl: Element;
  side: TooltipSide;
  align: TooltipAlign;
  maxWidth: number | string;
};

const store = {
  state: null as TooltipState | null,
  lastHiddenAt: 0,
};

const listeners = new Set<() => void>();

const emitChange = () => {
  for (const listener of listeners) {
    listener();
  }
};

export const showTooltip = (next: Omit<TooltipState, 'side' | 'align'> & { side?: TooltipSide; align?: TooltipAlign }) => {
  store.state = {
    content: next.content,
    anchorEl: next.anchorEl,
    side: next.side ?? 'top',
    align: next.align ?? 'center',
    maxWidth: next.maxWidth ?? '300px',
  };
  emitChange();
};

export const hideTooltip = (anchorEl?: Element) => {
  if (!store.state || (anchorEl && store.state.anchorEl !== anchorEl)) {
    return;
  }
  store.state = null;
  store.lastHiddenAt = Date.now();
  emitChange();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => store.state;
const getServerSnapshot = () => null;

const SIDE_OFFSET = 8;
const BUBBLE_GAP = 12;
const SKIP_DELAY_DURATION = 100;

type Placement = {
  top: number;
  left: number;
  side: TooltipSide;
  arrowOffset: number;
};

const computePosition = (anchorRect: DOMRect, side: TooltipSide, align: TooltipAlign, bubbleSize: { width: number; height: number }): Placement => {
  const { width: bw, height: bh } = bubbleSize;

  const placementFor = (s: TooltipSide): { top: number; left: number } => {
    let top: number;
    let left: number;

    switch (s) {
      case 'top':
        top = anchorRect.top - bh - BUBBLE_GAP;
        left = anchorRect.left + anchorRect.width / 2 - bw / 2;
        break;
      case 'bottom':
        top = anchorRect.bottom + BUBBLE_GAP;
        left = anchorRect.left + anchorRect.width / 2 - bw / 2;
        break;
      case 'right':
        top = anchorRect.top + anchorRect.height / 2 - bh / 2;
        left = anchorRect.right + BUBBLE_GAP;
        break;
      case 'left':
        top = anchorRect.top + anchorRect.height / 2 - bh / 2;
        left = anchorRect.left - bw - BUBBLE_GAP;
        break;
    }

    if (align === 'start') {
      if (s === 'top' || s === 'bottom') {
        left = anchorRect.left;
      } else {
        top = anchorRect.top;
      }
    } else if (align === 'end') {
      if (s === 'top' || s === 'bottom') {
        left = anchorRect.right - bw;
      } else {
        top = anchorRect.bottom - bh;
      }
    }

    return { top, left };
  };

  let resolvedSide = side;
  let position = placementFor(side);

  // Flip to the opposite side when the bubble would overflow the viewport.
  if (side === 'top' && position.top < 0) {
    resolvedSide = 'bottom';
    position = placementFor('bottom');
  } else if (side === 'bottom' && position.top + bh > window.innerHeight) {
    resolvedSide = 'top';
    position = placementFor('top');
  } else if (side === 'left' && position.left < 0) {
    resolvedSide = 'right';
    position = placementFor('right');
  } else if (side === 'right' && position.left + bw > window.innerWidth) {
    resolvedSide = 'left';
    position = placementFor('left');
  }

  let arrowOffset: number;
  if (resolvedSide === 'top' || resolvedSide === 'bottom') {
    position.left = Math.min(Math.max(position.left, SIDE_OFFSET), window.innerWidth - bw - SIDE_OFFSET);
    const anchorCenter = anchorRect.left + anchorRect.width / 2;
    arrowOffset = Math.min(Math.max(anchorCenter - position.left, 16), bw - 16);
  } else {
    position.top = Math.min(Math.max(position.top, SIDE_OFFSET), window.innerHeight - bh - SIDE_OFFSET);
    const anchorCenter = anchorRect.top + anchorRect.height / 2;
    arrowOffset = Math.min(Math.max(anchorCenter - position.top, 16), bh - 16);
  }

  return { ...position, side: resolvedSide, arrowOffset };
};

const borderColor = '#495057';

type ArrowProps = { side: TooltipSide; offset: number };

const Arrow = ({ side, offset }: ArrowProps) => {
  const isVerticalSide = side === 'left' || side === 'right';
  const rotation = side === 'top' ? 0 : side === 'bottom' ? 180 : side === 'left' ? -90 : 90;

  const wrapperStyle: CSSProperties = isVerticalSide
    ? { left: side === 'left' ? '100%' : -SIDE_OFFSET, top: offset, width: SIDE_OFFSET, height: 16, transform: 'translateY(-50%)' }
    : { top: side === 'top' ? '100%' : -SIDE_OFFSET, left: offset, width: 16, height: SIDE_OFFSET, transform: 'translateX(-50%)' };

  return (
    <div className="absolute overflow-visible" style={wrapperStyle}>
      <svg
        width="16"
        height="8"
        viewBox="0 0 16 8"
        preserveAspectRatio="none"
        className="absolute overflow-visible"
        style={{ left: '50%', top: '50%', transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}
      >
        {/* Outer triangle with border color */}
        <polygon points="0,0 16,0 8,8" fill={borderColor} />
        {/* Inner triangle with background color to create border effect */}
        <polygon points="1,0 15,0 8,7" fill="var(--color-bg-primary-light)" />
      </svg>
    </div>
  );
};

const TooltipHost = () => {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);

  const updatePosition = useCallback(() => {
    if (!store.state) {
      setPlacement(null);
      return;
    }
    const bubble = bubbleRef.current;
    if (!bubble) {
      return;
    }
    const anchorRect = store.state.anchorEl.getBoundingClientRect();
    const bubbleRect = bubble.getBoundingClientRect();
    setPlacement(computePosition(anchorRect, store.state.side, store.state.align, { width: bubbleRect.width, height: bubbleRect.height }));
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(updatePosition);
    if (!state) {
      return () => cancelAnimationFrame(frame);
    }
    const handleReposition = () => updatePosition();
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);
    const interval = window.setInterval(handleReposition, 500);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
      window.clearInterval(interval);
    };
  }, [state, updatePosition]);

  if (!state) {
    return null;
  }

  return (
    <div
      ref={bubbleRef}
      role="tooltip"
      className={clsx(
        'fixed',
        '!bg-bg-primary-light !text-text-secondary !text-2xs !py-1.5 !px-2.5 !opacity-100',
        '!rounded-md z-[10001] whitespace-pre-wrap select-none',
        'border',
        !placement && 'opacity-0',
      )}
      style={{ borderColor, maxWidth: state.maxWidth, top: placement?.top ?? -9999, left: placement?.left ?? -9999 }}
    >
      {state.content}
      <Arrow side={placement?.side ?? state.side} offset={placement?.arrowOffset ?? 0} />
    </div>
  );
};

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  side?: TooltipSide;
  align?: TooltipAlign;
  delayDuration?: number;
  maxWidth?: number | string;
};

const DEFAULT_DELAY = 200;

export const TooltipProvider = ({ children, ...props }: TooltipPrimitive.TooltipProviderProps) => (
  <TooltipPrimitive.Provider delayDuration={200} skipDelayDuration={100} {...props}>
    <TooltipHost />
    {children}
  </TooltipPrimitive.Provider>
);

export const Tooltip = ({ content, children, side, align, delayDuration, maxWidth = '300px' }: TooltipProps) => {
  const anchorRef = useRef<HTMLElement | null>(null);
  const delayTimeoutRef = useRef<number | undefined>(undefined);

  const clearDelay = useCallback(() => {
    if (delayTimeoutRef.current !== undefined) {
      window.clearTimeout(delayTimeoutRef.current);
      delayTimeoutRef.current = undefined;
    }
  }, []);

  const handleShow = useCallback(() => {
    clearDelay();
    const delay = Date.now() - store.lastHiddenAt < SKIP_DELAY_DURATION ? 0 : (delayDuration ?? DEFAULT_DELAY);
    delayTimeoutRef.current = window.setTimeout(() => {
      if (anchorRef.current) {
        showTooltip({ content, anchorEl: anchorRef.current, side, align, maxWidth });
      }
    }, delay);
  }, [align, clearDelay, content, delayDuration, maxWidth, side]);

  const handleHide = useCallback(() => {
    clearDelay();
    if (anchorRef.current) {
      hideTooltip(anchorRef.current);
    }
  }, [clearDelay]);

  const showFromEvent = (e: PointerEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
    anchorRef.current = e.currentTarget;
    handleShow();
  };

  useEffect(
    () => () => {
      clearDelay();
      if (anchorRef.current) {
        hideTooltip(anchorRef.current);
      }
    },
    [clearDelay],
  );

  const child = isValidElement(children) ? children : null;

  if (!child) {
    return (
      <span
        ref={anchorRef as unknown as Ref<HTMLSpanElement>}
        className="contents"
        onPointerEnter={handleShow}
        onPointerLeave={handleHide}
        onFocus={handleShow}
        onBlur={handleHide}
      >
        {children}
      </span>
    );
  }

  const childProps = child.props as {
    onPointerEnter?: (e: PointerEvent<HTMLElement>) => void;
    onPointerLeave?: (e: PointerEvent<HTMLElement>) => void;
    onFocus?: (e: FocusEvent<HTMLElement>) => void;
    onBlur?: (e: FocusEvent<HTMLElement>) => void;
  };

  const handleChildPointerEnter = (e: PointerEvent<HTMLElement>) => {
    childProps.onPointerEnter?.(e);
    showFromEvent(e);
  };

  const handleChildPointerLeave = (e: PointerEvent<HTMLElement>) => {
    childProps.onPointerLeave?.(e);
    handleHide();
  };

  const handleChildFocus = (e: FocusEvent<HTMLElement>) => {
    childProps.onFocus?.(e);
    showFromEvent(e);
  };

  const handleChildBlur = (e: FocusEvent<HTMLElement>) => {
    childProps.onBlur?.(e);
    handleHide();
  };

  // Handlers only touch anchorRef at event time; the rule cannot see this through cloneElement's props argument.
  // eslint-disable-next-line react-hooks/refs
  return cloneElement(child as ReactElement<Record<string, unknown>>, {
    onPointerEnter: handleChildPointerEnter,
    onPointerLeave: handleChildPointerLeave,
    onFocus: handleChildFocus,
    onBlur: handleChildBlur,
  });
};
