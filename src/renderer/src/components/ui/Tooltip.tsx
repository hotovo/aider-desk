import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { ReactNode } from 'react';
import { clsx } from 'clsx';

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  delayDuration?: number;
  maxWidth?: number | string;
};

const borderColor = '#495057';

export const TooltipProvider = ({ children, ...props }: TooltipPrimitive.TooltipProviderProps) => (
  <TooltipPrimitive.Provider delayDuration={200} skipDelayDuration={100} {...props}>
    {children}
  </TooltipPrimitive.Provider>
);

// Simple arrow component using Radix's Arrow primitive
const Arrow = ({ side = 'top' }: { side?: string }) => (
  <TooltipPrimitive.Arrow
    asChild
    width={16}
    height={8}
    className={clsx(
      'overflow-visible',
      side === 'top' && 'data-[side=top]',
      side === 'bottom' && 'data-[side=bottom]',
      side === 'left' && 'data-[side=left]',
      side === 'right' && 'data-[side=right]',
    )}
  >
    <svg width="16" height="8" viewBox="0 0 16 8" preserveAspectRatio="none" className="overflow-visible">
      {/* Outer triangle with border color */}
      <polygon points="0,0 16,0 8,8" fill={borderColor} />
      {/* Inner triangle with background color to create border effect */}
      <polygon points="1,0 15,0 8,7" fill="var(--color-bg-primary-light)" />
    </svg>
  </TooltipPrimitive.Arrow>
);

export const Tooltip = ({ content, children, side, align, delayDuration, maxWidth = '300px' }: TooltipProps) => (
  <TooltipPrimitive.Root delayDuration={delayDuration}>
    <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        side={side}
        align={align}
        className={clsx(
          'relative',
          '!bg-bg-primary-light !text-text-secondary !text-2xs !py-1.5 !px-2.5 !opacity-100',
          '!rounded-md z-50 whitespace-pre-wrap select-none',
          // Use CSS border instead of outline
          'border',
        )}
        style={{ borderColor, maxWidth }}
        sideOffset={8}
      >
        {content}
        <Arrow side={side} />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  </TooltipPrimitive.Root>
);
