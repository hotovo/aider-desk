import { render as rtlRender, type RenderOptions, type RenderResult } from '@testing-library/react';

import type { ReactNode } from 'react';

import { TooltipProvider } from '@/components/ui/Tooltip';

export const render = (ui: React.ReactElement, options?: RenderOptions): RenderResult => {
  const { rerender: originalRerender, ...result } = rtlRender(<TooltipProvider>{ui}</TooltipProvider>, options);

  return {
    ...result,
    rerender: (newUi: ReactNode) => {
      return originalRerender(<TooltipProvider>{newUi}</TooltipProvider>);
    },
  };
};
